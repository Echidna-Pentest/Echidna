#!/usr/bin/env python3
import sys
import json
import os
import re
import subprocess
import time
import logging
from typing import Dict, Any, Optional

# Configure logging to file instead of stderr to avoid terminal noise
def setup_logging():
    """Setup logging to file instead of flooding stderr"""
    log_dir = os.path.dirname(__file__)
    log_file = os.path.join(log_dir, 'agent_debug.log')
    
    # Create logger
    logger = logging.getLogger('echidna_agent')
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # File handler for detailed debugging
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    return logger

# Initialize logger
logger = setup_logging()

def create_llm_client(config: Dict[str, Any]):
    """Create LLM client based on config with model preference support"""
    logger.debug(f"DEBUG: Creating LLM client...")
    logger.debug(f"DEBUG: Config keys: {list(config.keys())}")
    
    # Get agent configuration for model preference
    agent_config = config.get('agent', {})
    preferred_model = agent_config.get('preferredModel', 'auto').lower()
    model_fallback = agent_config.get('modelFallback', True)
    
    logger.debug(f"DEBUG: Preferred model: {preferred_model}")
    logger.debug(f"DEBUG: Model fallback enabled: {model_fallback}")
    
    # Define model creation functions
    def try_gemini():
        gemini_config = config.get('gemini', {})
        if gemini_config.get('enabled') and gemini_config.get('apiKey'):
            logger.debug(f"DEBUG: Trying Gemini configuration...")
            logger.debug(f"DEBUG: Gemini enabled: {gemini_config.get('enabled')}")
            logger.debug(f"DEBUG: Gemini API key present: {'Yes' if gemini_config.get('apiKey') else 'No'}")
            logger.debug(f"DEBUG: Gemini model: {gemini_config.get('model', 'gemini-1.5-flash')}")
            from langchain_google_genai import ChatGoogleGenerativeAI
            client = ChatGoogleGenerativeAI(
                model=gemini_config.get('model', 'gemini-1.5-flash'),
                google_api_key=gemini_config.get('apiKey'),
                temperature=0.0
            )
            logger.debug(f"DEBUG: Gemini client created successfully")
            return client
        return None
    
    def try_openai():
        openai_config = config.get('openai', {})
        if openai_config.get('enabled') and openai_config.get('apiKey'):
            logger.debug(f"DEBUG: Trying OpenAI configuration...")
            logger.debug(f"DEBUG: OpenAI enabled: {openai_config.get('enabled')}")
            logger.debug(f"DEBUG: API key present: {'Yes' if openai_config.get('apiKey') else 'No'}")
            logger.debug(f"DEBUG: OpenAI model: {openai_config.get('model', 'gpt-4o-mini')}")
            from langchain_openai import ChatOpenAI
            client = ChatOpenAI(
                model=openai_config.get('model', 'gpt-4o-mini'),
                api_key=openai_config.get('apiKey'),
                temperature=0.0
            )
            logger.debug(f"DEBUG: OpenAI client created successfully")
            return client
        return None
    
    def try_localai():
        localai_config = config.get('localAI', {})
        if localai_config.get('enabled') and localai_config.get('baseUrl'):
            logger.debug(f"DEBUG: Trying local LLM configuration...")
            logger.debug(f"DEBUG: Local enabled: {localai_config.get('enabled')}")
            logger.debug(f"DEBUG: Local base URL: {localai_config.get('baseUrl')}")
            logger.debug(f"DEBUG: Local model: {localai_config.get('model', 'auto')}")
            try:
                from langchain_openai import ChatOpenAI
                client = ChatOpenAI(
                    model=localai_config.get('model', 'auto'),
                    base_url=localai_config.get('baseUrl'),
                    api_key='sk-local',
                    temperature=0.0,
                    timeout=10,  # Add timeout for LocalAI connections
                    streaming=False,  # Disable streaming to avoid stop parameter issues
                    max_retries=1
                )
                logger.debug(f"DEBUG: Local LLM client created successfully")
                return client
            except Exception as e:
                logger.error(f"DEBUG: Failed to create LocalAI client: {e}")
                return None
        return None
    
    # Model selection map
    model_functions = {
        'gemini': try_gemini,
        'openai': try_openai,
        'localai': try_localai,
        'local': try_localai  # Alias for localai
    }
    
    try:
        # Try preferred model first
        if preferred_model in model_functions:
            logger.debug(f"DEBUG: Trying preferred model: {preferred_model}")
            client = model_functions[preferred_model]()
            if client:
                logger.debug(f"DEBUG: Successfully created {preferred_model} client")
                return client
            else:
                logger.warning(f"DEBUG: Failed to create {preferred_model} client")
        
        # If preferred model failed or not specified, try fallback models
        if model_fallback or preferred_model == 'auto':
            logger.debug(f"DEBUG: Trying fallback models in order...")
            
            # Define fallback order (excluding the already tried preferred model)
            fallback_order = ['gemini', 'openai', 'localai']
            if preferred_model in fallback_order:
                fallback_order.remove(preferred_model)
                fallback_order.insert(0, preferred_model)  # Keep preferred first, but others as fallback
            
            for model_name in fallback_order:
                if model_name == preferred_model:
                    continue  # Skip already tried preferred model
                
                logger.debug(f"DEBUG: Trying fallback model: {model_name}")
                client = model_functions[model_name]()
                if client:
                    logger.debug(f"DEBUG: Successfully created fallback {model_name} client")
                    return client
        
        # If we get here, no models worked
        logger.error(f"DEBUG: No LLM configuration found or all models failed")
        logger.debug(f"DEBUG: Available config options:")
        
        # Check new config structure
        openai_config = config.get('openai', {})
        gemini_config = config.get('gemini', {})
        localai_config = config.get('localAI', {})
        
        logger.debug(f"  - openai.enabled: {openai_config.get('enabled', 'Not set')}")
        logger.debug(f"  - openai.apiKey: {'Present' if openai_config.get('apiKey') else 'Not set'}")
        logger.debug(f"  - gemini.enabled: {gemini_config.get('enabled', 'Not set')}")
        logger.debug(f"  - gemini.apiKey: {'Present' if gemini_config.get('apiKey') else 'Not set'}")
        logger.debug(f"  - localAI.enabled: {localai_config.get('enabled', 'Not set')}")
        logger.debug(f"  - localAI.baseUrl: {localai_config.get('baseUrl', 'Not set')}")
        return None
            
    except ImportError as e:
        logger.error(f"DEBUG: Missing dependency: {e}")
        return None
    except Exception as e:
        logger.error(f"DEBUG: LLM setup error: {e}")
        return None

def safe_command_check(cmd: str) -> bool:
    """Safety check for shell commands"""
    # Allow most commands but block dangerous ones
    dangerous_patterns = [
        r'rm\s+-rf\s+/',
        r'rm\s+-rf\s+\*',
        r'>\s*/dev/sd',
        r'dd\s+if=.*of=/dev/',
        r'mkfs',
        r'fdisk',
        r'parted',
        r'shutdown',
        r'reboot',
        r'halt',
        r'init\s+[06]',
        r'killall\s+-9',
        r':\(\)\{.*\}',  # Fork bomb
        r'wget.*\|\s*sh',
        r'curl.*\|\s*sh',
        r'chmod\s+777\s+/',
        r'chown.*\s+/',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, cmd, re.IGNORECASE):
            return False
    
    return len(cmd) < 1000

def create_shell_tool():
    """Create shell execution tool for the agent"""
    from langchain.tools import Tool
    
    def execute_shell_command(command: str) -> str:
        """Execute a shell command and return the output with exploitation analysis"""
        try:
            # Safety check
            if not safe_command_check(command):
                return "ERROR: Command blocked for safety reasons"
            
            logger.debug(f"DEBUG: Executing exploitation command: {command}")
            
            # Execute command with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,  # Extended timeout for exploitation tools
                cwd=os.path.expanduser("~")  # Run from home directory
            )
            
            output = []
            if result.stdout:
                output.append(f"STDOUT:\n{result.stdout}")
            if result.stderr:
                output.append(f"STDERR:\n{result.stderr}")
            if result.returncode != 0:
                output.append(f"EXIT_CODE: {result.returncode}")
            
            command_output = "\n".join(output) if output else "Command executed successfully (no output)"
            
            logger.debug(f"DEBUG: Command completed.")
            return command_output
            
        except subprocess.TimeoutExpired:
            return "ERROR: Command timed out after 60 seconds"
        except Exception as e:
            return f"ERROR: {str(e)}"
    
    return Tool(
        name="shell",
        description="Execute shell commands for penetration testing and exploitation. Output will be provided to AI for analysis.",
        func=execute_shell_command
    )



def create_react_agent(llm, last_output: str, env: Dict[str, Any], vulnerability_info: Dict[str, Any] = None, max_iterations: int = 5) -> Optional[Dict[str, Any]]:
    """Create and run ReAct agent with shell access and exploitation goals"""
    logger.debug(f"DEBUG: Creating ReAct agent with exploitation focus...")
    logger.debug(f"DEBUG: LLM client: {type(llm).__name__ if llm else 'None'}")
    logger.debug(f"DEBUG: Max iterations: {max_iterations}")
    logger.debug(f"DEBUG: Terminal output length: {len(last_output)} chars")
    logger.debug(f"DEBUG: Vulnerability info provided: {'Yes' if vulnerability_info else 'No'}")
    
    try:
        from langchain.agents import create_react_agent, AgentExecutor
        from langchain.prompts import PromptTemplate
        from langchain.schema import SystemMessage, HumanMessage
        
        logger.debug(f"DEBUG: LangChain imports successful")
        
        # Create shell tool
        shell_tool = create_shell_tool()
        tools = [shell_tool]
        
        logger.debug(f"DEBUG: Tools created: {[tool.name for tool in tools]}")
        
        # Format vulnerability context for exploitation
        vulnerability_context = "No specific vulnerability information available."
        exploitation_targets = []
        exploitation_status = "RECONNAISSANCE_PHASE"
        
        if vulnerability_info:
            # Enhanced vulnerability analysis
            vuln_severity = vulnerability_info.get('severity', 'Unknown').upper()
            vuln_description = vulnerability_info.get('description', 'Not available')
            vuln_provider = vulnerability_info.get('provider', 'Unknown')
            
            suggested_commands = vulnerability_info.get('suggestedCommands', [])
            logger.debug(f"DEBUG: Found {len(suggested_commands)} suggested commands")
            for idx, cmd in enumerate(suggested_commands):
                logger.debug(f"DEBUG: Command {idx + 1}: {cmd}")
            
            if suggested_commands:
                context_parts = [f"Available commands:"]
                for i, cmd in enumerate(suggested_commands[:3], 1):  # Top 3 commands only
                    command = cmd.get('command', 'Unknown')
                    context_parts.append(f"{i}. {command}")
                    
                    exploitation_targets.append({
                        "command": command,
                        "explanation": cmd.get('explanation', 'No explanation'),
                        "priority": i,
                        "confidence": cmd.get('confidence', 0.5),
                        "priority_score": 0.75,
                        "vulnerability_severity": vuln_severity
                    })
                
                exploitation_status = "ACTIVE_EXPLOITATION_PHASE"
            else:
                context_parts = ["No commands available"]
            
            vulnerability_context = "\n".join(context_parts)
        else:
            # No specific vulnerability, focus on discovery
            context_parts = [
                "RECONNAISSANCE AND DISCOVERY PHASE:",
                "- No specific vulnerabilities identified yet",
                "- Focus on service enumeration and vulnerability scanning",
                "- Look for common misconfigurations and weak services",
                "- Prepare for exploitation once vulnerabilities are found"
            ]
            vulnerability_context = "\n".join(context_parts)
            exploitation_status = "RECONNAISSANCE_PHASE"
        
        logger.debug(f"DEBUG: Exploitation status: {exploitation_status}")
        logger.debug(f"DEBUG: Formatted vulnerability context: {vulnerability_context[:300]}...")
        logger.debug(f"DEBUG: Exploitation targets: {len(exploitation_targets)}")
        
        if exploitation_targets:
            logger.debug(f"DEBUG: Top exploitation targets:")
            for i, target in enumerate(exploitation_targets[:3], 1):
                logger.debug(f"  {i}. {target['command']} (score: {target['priority_score']:.2f})")
        
        # *** EARLY DEBUG: Print prompts here before LLM creation ***
        logger.debug("="*80)
        logger.debug("EARLY DEBUG - VULNERABILITY CONTEXT:")
        logger.debug(vulnerability_context)
        logger.debug("="*80)
        
        # Create system prompt with few-shot example
        system_prompt = """You have access to tools: {tools}

You MUST follow this exact format:
Question: What command should I run?
Thought: I need to pick a command from the list
Action: shell
Action Input: [exact command]
Observation: [result]
Thought: [analysis]
Final Answer: [summary]

Example:
Question: What command should I run?
Thought: I need to execute the first command from the list
Action: shell
Action Input: whoami
Observation: root
Thought: Command executed successfully, I am root
Final Answer: Successfully executed whoami command and confirmed root access"""

        # Create user prompt with mandatory first action
        user_prompt_template = """Commands to test:
{vulnerability_context}

Available tools: {tool_names}

MANDATORY FIRST ACTION:
On your first turn, you MUST output exactly:
Action: shell
Action Input: <the top-1 command from the list above>
Then wait for Observation before any further thoughts.

Question: What command should I run?
Thought:{agent_scratchpad}"""

        # *** EARLY DEBUG: Print system and user prompts here before any LLM operations ***
        logger.debug("="*80)
        logger.debug("EARLY DEBUG - SYSTEM PROMPT:")
        logger.debug(system_prompt)
        logger.debug("="*80)
        logger.debug("EARLY DEBUG - USER PROMPT TEMPLATE:")
        logger.debug(user_prompt_template)
        logger.debug("="*80)

        # Combine system and user prompts
        full_template = system_prompt + "\n\n" + user_prompt_template
        prompt = PromptTemplate.from_template(full_template)
        
        # Debug: Print the prompts for debugging
        logger.debug("="*80)
        logger.debug("SYSTEM PROMPT:")
        logger.debug(system_prompt)
        logger.debug("="*80)
        logger.debug("USER PROMPT TEMPLATE:")
        logger.debug(user_prompt_template)
        logger.debug("="*80)
        logger.debug("VULNERABILITY CONTEXT:")
        logger.debug(vulnerability_context)
        logger.debug("="*80)
        
        logger.debug(f"DEBUG: Exploitation-focused prompt template created")
        
        # Since LangChain ReAct agent has streaming issues with LocalAI, 
        # let's use direct LLM calls to avoid the stop parameter problem
        logger.debug(f"DEBUG: Using direct LLM approach to avoid streaming issues")
        
        # Format the complete prompt manually
        final_prompt = system_prompt.replace("{tools}", str([tool.name for tool in tools])) + "\n\n" + \
                      user_prompt_template.replace("{vulnerability_context}", vulnerability_context) \
                                          .replace("{tool_names}", str([tool.name for tool in tools])) \
                                          .replace("{agent_scratchpad}", "")
        
        logger.debug("="*80)
        logger.debug("FINAL PROMPT TO LLM:")
        logger.debug(final_prompt)
        logger.debug("="*80)
        
        try:
            # Make direct LLM call without streaming
            from langchain.schema import HumanMessage
            response = llm.invoke([HumanMessage(content=final_prompt)])
            logger.debug(f"DEBUG: LLM Response: {response.content}")
            
            # Parse the response to extract Action and Action Input
            response_text = response.content
            executed_commands = []
            
            # Look for Action: shell and Action Input: patterns
            lines = response_text.split('\n')
            current_command = None
            
            for line in lines:
                line = line.strip()
                if line.startswith('Action Input:'):
                    current_command = line[len('Action Input:'):].strip()
                    if current_command and len(current_command) > 0:
                        # Execute the command using our shell tool
                        logger.debug(f"DEBUG: Executing command: {current_command}")
                        shell_tool = create_shell_tool()
                        command_output = shell_tool.func(current_command)
                        
                        executed_commands.append({
                            'command': current_command,
                            'output': command_output,
                            'tool': 'shell'
                        })
            
            if not executed_commands:
                # If no Action Input found, try to extract any commands from the response
                suggested_commands = vulnerability_info.get('suggestedCommands', [])
                if suggested_commands:
                    first_command = suggested_commands[0].get('command', '')
                    if first_command:
                        logger.debug(f"DEBUG: No Action Input found, executing first suggested command: {first_command}")
                        shell_tool = create_shell_tool()
                        command_output = shell_tool.func(first_command)
                        
                        executed_commands.append({
                            'command': first_command,
                            'output': command_output,
                            'tool': 'shell'
                        })
            
            # Create result similar to what AgentExecutor would return
            result = {
                'commands_executed': executed_commands,
                'final_analysis': response_text,
                'exploitation_attempts': len(executed_commands),
                'vulnerability_info': vulnerability_info
            }
            
        except Exception as e:
            logger.error(f"DEBUG: Direct LLM call failed: {e}")
            return None
        
        logger.debug(f"DEBUG: Direct LLM call completed")
        logger.debug(f"DEBUG: Result keys: {list(result.keys())}")
        
        # The result is already in the format we need
        executed_commands = result.get('commands_executed', [])
        final_analysis = result.get('final_analysis', '')
        
        logger.debug(f"DEBUG: Final analysis from AI: {final_analysis[:500]}...")
        logger.debug(f"DEBUG: Number of executed commands: {len(executed_commands)}")
        
        for i, cmd in enumerate(executed_commands):
            logger.debug(f"DEBUG: Command {i+1}: {cmd.get('command', 'N/A')}")
        
        logger.debug(f"DEBUG: Direct approach result: {len(executed_commands)} commands executed")
        
        return result
        
    except Exception as e:
        logger.error(f"DEBUG: ReAct exploitation agent error: {e}")
        import traceback
        logger.debug(f"DEBUG: Full traceback:")
        traceback.print_exc(file=sys.stderr)
        return None



# All static analysis functions removed - let AI handle everything intelligently!

def main():
    """Simplified main function that assumes LLM is always available"""
    logger.debug("Starting ReAct agent...")
    
    try:
        # Read input
        logger.debug("Reading input from stdin...")
        raw = sys.stdin.read()
        payload = json.loads(raw or '{}')
        
        logger.debug(f"Input payload keys: {list(payload.keys())}")
        
        # Load config
        config_path = os.path.join(os.path.dirname(__file__), '..', 'echidna.json')
        logger.debug(f"Loading config from: {config_path}")
        
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Config file not found at {config_path}")
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        logger.debug("Config loaded successfully")
        
        # Create LLM client - assume it will always work
        logger.debug("Creating LLM client...")
        llm = create_llm_client(config)
        
        if not llm:
            raise RuntimeError("Failed to create LLM client")
        
        logger.debug("LLM client created successfully, proceeding with ReAct agent")
        
        # Get agent configuration
        max_iterations = config.get('agentMaxIterations', 5)
        logger.debug(f"Agent max iterations: {max_iterations}")
        
        # Run ReAct agent
        agent_result = create_react_agent(
            llm, 
            payload.get('lastOutput', ''),
            payload.get('env', {}),
            payload.get('vulnerabilityInfo', {}),
            max_iterations
        )
        
        if not agent_result:
            raise RuntimeError("ReAct agent returned no result")
        
        logger.debug("Agent execution completed successfully")
        
        # Generate response
        result = {
            "execution_complete": True,
            "commands_executed": len(agent_result.get('commands_executed', [])),
            "final_analysis": agent_result.get('final_analysis', ''),
            "detailed_results": agent_result.get('commands_executed', []),
            "vulnerability_info": agent_result.get('vulnerability_info', {}),
            "allowed": True
        }
        
        logger.debug(f"Returning execution result with {result['commands_executed']} commands")
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Main function error: {e}")
        import traceback
        logger.debug("Full traceback:")
        traceback.print_exc(file=sys.stderr)
        
        # Return error response
        result = {
            "execution_complete": False,
            "commands_executed": 0,
            "final_analysis": f"Error occurred during agent execution: {str(e)}",
            "detailed_results": [],
            "error": str(e),
            "allowed": True
        }
        print(json.dumps(result))

if __name__ == '__main__':
    main() 