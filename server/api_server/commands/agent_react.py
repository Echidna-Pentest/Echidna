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
                temperature=0.3
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
                temperature=0.1
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
                    temperature=0.1,
                    timeout=10  # Add timeout for LocalAI connections
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
            
            context_parts = [
                f"TARGET VULNERABILITY ANALYSIS:",
                f"- Severity: {vuln_severity} {'' if vuln_severity in ['HIGH', 'CRITICAL'] else '' if vuln_severity == 'MEDIUM' else ''}",
                f"- Description: {vuln_description}",
                f"- Analysis Provider: {vuln_provider}",
                f"- Exploitation Status: ACTIVE_EXPLOITATION_PHASE"
            ]
            
            suggested_commands = vulnerability_info.get('suggestedCommands', [])
            if suggested_commands:
                context_parts.append("\nPRIORITY EXPLOITATION COMMANDS (EXECUTE THESE FIRST):")
                for i, cmd in enumerate(suggested_commands[:5], 1):  # Top 5 commands
                    command = cmd.get('command', 'Unknown')
                    explanation = cmd.get('explanation', 'No explanation')
                    confidence = cmd.get('confidence', 0.5)
                    
                    # Prioritize by confidence and severity
                    priority_score = confidence * (1.5 if vuln_severity in ['HIGH', 'CRITICAL'] else 1.0)
                    
                    context_parts.append(f"  {i}. [{priority_score:.2f}] {command}")
                    context_parts.append(f"     └─ Purpose: {explanation}")
                    
                    exploitation_targets.append({
                        "command": command,
                        "explanation": explanation,
                        "priority": i,
                        "confidence": confidence,
                        "priority_score": priority_score,
                        "vulnerability_severity": vuln_severity
                    })
                
                # Sort by priority score
                exploitation_targets.sort(key=lambda x: x["priority_score"], reverse=True)
                exploitation_status = "ACTIVE_EXPLOITATION_PHASE"
            
            # Add exploitation success criteria
            context_parts.extend([
                "\nEXPLOITATION SUCCESS CRITERIA:",
                "- Gain shell access (whoami, id showing successful login)",
                "- Verify each step before proceeding to next"
            ])
            
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
        
        # Create system prompt for exploitation-focused agent
        system_prompt = """You are a PENETRATION TESTING AGENT. Your mission:

GOAL: Execute the suggested exploitation commands and analyze if they are effective.

STRATEGY:
1. Execute the suggested commands in order of priority
2. Analyze each command's output to determine success or failure
3. If a command succeeds, verify the success with follow-up commands
4. If a command fails, explain why and move to the next suggested command
5. Document all results clearly

AVAILABLE TOOLS: {tools}

EXECUTION RULES:
- Execute each suggested command exactly as provided
- Analyze command output for exploitation success indicators
- Use verification commands (whoami, id) only after successful exploitation
- Provide clear analysis of what each result means"""

        # Create user prompt with current context
        user_prompt_template = """PENETRATION TESTING TASK:

TARGET: {current_host}

SUGGESTED COMMANDS TO TEST:
{vulnerability_context}

PREVIOUS OUTPUT:
{terminal_output}

TASK: Execute the suggested commands and analyze their effectiveness.

AVAILABLE TOOLS: {tool_names}

Use this format:

Question: Which suggested command should I execute and test?
Thought: [Select the next suggested command to execute]
Action: shell
Action Input: [exact_command_from_suggestions]
Observation: [command output]
Thought: [Analyze if this command was successful for exploitation]
Final Answer: [Summary of results - was the exploitation successful?]

Question: Which suggested command should I execute and test?
Thought:{agent_scratchpad}"""

        # Combine system and user prompts
        full_template = system_prompt + "\n\n" + user_prompt_template
        prompt = PromptTemplate.from_template(full_template)
        
        logger.debug(f"DEBUG: Exploitation-focused prompt template created")
        
        # Create agent with exploitation focus - allow more iterations for comprehensive testing
        agent = create_react_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=False,  # Disable verbose output to avoid JSON parsing issues
            max_iterations=max_iterations * 3,  # Allow more iterations for execution and verification
            handle_parsing_errors=True,
            return_intermediate_steps=True
        )
        
        logger.debug(f"DEBUG: Exploitation agent and executor created successfully")
        logger.debug(f"DEBUG: Calling AI service for exploitation planning...")
        
        # Run agent with exploitation focus - execute and analyze iteratively
        result = agent_executor.invoke({
            "input": "Execute the next exploitation command and analyze its results",
            "current_host": env.get('currenthost', 'unknown_target'),
            "terminal_output": last_output[-4000:],  # Last 4000 chars for more context
            "vulnerability_context": vulnerability_context
        })
        
        logger.debug(f"DEBUG: AI service call completed")
        logger.debug(f"DEBUG: Agent result keys: {list(result.keys())}")
        
        # Extract comprehensive results from agent execution
        final_answer = result.get('output', '')
        intermediate_steps = result.get('intermediate_steps', [])
        
        logger.debug(f"DEBUG: Final answer from AI: {final_answer[:500]}...")
        logger.debug(f"DEBUG: Number of intermediate steps: {len(intermediate_steps)}")
        
        # Analyze all executed commands and their results
        executed_commands = []
        for step in intermediate_steps:
            if len(step) >= 2:
                action = step[0]
                observation = step[1]
                if hasattr(action, 'tool_input'):
                    executed_commands.append({
                        'command': action.tool_input,
                        'output': observation,
                        'tool': getattr(action, 'tool', 'shell')
                    })
        
        # Create simple result focused on what agent did and found
        comprehensive_result = {
            'commands_executed': executed_commands,
            'final_analysis': final_answer,
            'exploitation_attempts': len(executed_commands),
            'vulnerability_info': vulnerability_info
        }
        
        logger.debug(f"DEBUG: Comprehensive result: {len(executed_commands)} commands executed")
        
        return comprehensive_result
        
    except Exception as e:
        logger.error(f"DEBUG: ReAct exploitation agent error: {e}")
        import traceback
        logger.debug(f"DEBUG: Full traceback:")
        traceback.print_exc(file=sys.stderr)
        return None



# All static analysis functions removed - let AI handle everything intelligently!

def main():
    logger.debug(f"DEBUG: Starting ReAct agent...")
    
    try:
        # Read input
        logger.debug(f"DEBUG: Reading input from stdin...")
        raw = sys.stdin.read()
        payload = json.loads(raw or '{}')
        
        logger.debug(f"DEBUG: Input payload keys: {list(payload.keys())}")
        logger.debug(f"DEBUG: Payload: {json.dumps(payload, indent=2)[:500]}...")
        
        # Load config
        config_path = os.path.join(os.path.dirname(__file__), '..', 'echidna.json')
        logger.debug(f"DEBUG: Loading config from: {config_path}")
        
        if not os.path.exists(config_path):
            logger.error(f"DEBUG: Config file not found at {config_path}")
            config = {}
        else:
            with open(config_path, 'r') as f:
                config = json.load(f)
            logger.debug(f"DEBUG: Config loaded successfully")
        
        # Create LLM client
        logger.debug(f"DEBUG: Creating LLM client...")
        llm = create_llm_client(config)
        
        if not llm:
            logger.warning(f"DEBUG: No LLM available, executing all suggested commands directly")
            # Execute ALL suggested commands directly without AI analysis
            vuln_info = payload.get('vulnerabilityInfo', {})
            suggested_commands = vuln_info.get('suggestedCommands', [])
            
            executed_commands = []
            successful_commands = 0
            failed_commands = 0
            analysis_parts = []
            
            if suggested_commands:
                analysis_parts.append(f"No LLM available, executing {len(suggested_commands)} suggested commands directly:")
                
                for i, cmd_info in enumerate(suggested_commands, 1):
                    cmd = cmd_info.get('command', '')
                    explanation = cmd_info.get('explanation', 'No explanation')
                    
                    if not cmd:
                        continue
                        
                    try:
                        logger.debug(f"DEBUG: Executing suggested command {i}: {cmd}")
                        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
                        
                        output_parts = []
                        if result.stdout:
                            output_parts.append(f"STDOUT:\n{result.stdout}")
                        if result.stderr:
                            output_parts.append(f"STDERR:\n{result.stderr}")
                        if result.returncode != 0:
                            output_parts.append(f"EXIT_CODE: {result.returncode}")
                        
                        output = "\n".join(output_parts) if output_parts else "Command executed (no output)"
                        
                        executed_commands.append({
                            'command': cmd,
                            'output': output,
                            'tool': 'direct'
                        })
                        
                        if result.returncode == 0:
                            successful_commands += 1
                            analysis_parts.append(f"  Command {i} ({cmd}): SUCCESS")
                            analysis_parts.append(f"  Purpose: {explanation}")
                        else:
                            failed_commands += 1
                            analysis_parts.append(f"  Command {i} ({cmd}): FAILED (exit code {result.returncode})")
                            analysis_parts.append(f"  Purpose: {explanation}")
                            
                    except Exception as e:
                        failed_commands += 1
                        executed_commands.append({
                            'command': cmd,
                            'output': f'ERROR: {str(e)}',
                            'tool': 'direct'
                        })
                        analysis_parts.append(f"✗ Command {i} ({cmd}): ERROR - {str(e)}")
                
                final_analysis = "\n".join(analysis_parts)
                
                agent_result = {
                    'commands_executed': executed_commands,
                    'final_analysis': final_analysis,
                    'exploitation_attempts': len(executed_commands),
                    'vulnerability_info': vuln_info
                }
            else:
                agent_result = {
                    'commands_executed': [],
                    'final_analysis': 'No LLM client available and no suggested commands provided',
                    'exploitation_attempts': 0,
                    'vulnerability_info': vuln_info
                }
        else:
            logger.debug(f"DEBUG: LLM client created, proceeding with ReAct agent")
            # Use ReAct agent with shell access
            max_iterations = config.get('agentMaxIterations', 5)
            logger.debug(f"DEBUG: Agent max iterations: {max_iterations}")
            
            try:
                # Set a timeout for the entire agent execution
                import signal
                def timeout_handler(signum, frame):
                    raise TimeoutError("Agent execution timed out")
                
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(25)  # 25 second timeout for agent execution (shorter to avoid Node.js timeout)
                
                agent_result = create_react_agent(
                    llm, 
                    payload.get('lastOutput', ''),
                    payload.get('env', {}),
                    payload.get('vulnerabilityInfo', {}), # Pass vulnerability info
                    max_iterations
                )
                
                signal.alarm(0)  # Cancel the alarm
                
            except TimeoutError:
                logger.error("DEBUG: Agent execution timed out, executing all suggested commands directly")
                # Fallback to direct execution of ALL suggested commands
                vuln_info = payload.get('vulnerabilityInfo', {})
                suggested_commands = vuln_info.get('suggestedCommands', [])
                
                executed_commands = []
                successful_commands = 0
                failed_commands = 0
                analysis_parts = []
                
                if suggested_commands:
                    analysis_parts.append(f"Agent timed out, executing {len(suggested_commands)} suggested commands directly:")
                    
                    for i, cmd_info in enumerate(suggested_commands, 1):
                        cmd = cmd_info.get('command', '')
                        explanation = cmd_info.get('explanation', 'No explanation')
                        
                        if not cmd:
                            continue
                            
                        try:
                            logger.debug(f"DEBUG: Executing suggested command {i}: {cmd}")
                            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
                            
                            output_parts = []
                            if result.stdout:
                                output_parts.append(f"STDOUT:\n{result.stdout}")
                            if result.stderr:
                                output_parts.append(f"STDERR:\n{result.stderr}")
                            if result.returncode != 0:
                                output_parts.append(f"EXIT_CODE: {result.returncode}")
                            
                            output = "\n".join(output_parts) if output_parts else "Command executed (no output)"
                            
                            executed_commands.append({
                                'command': cmd,
                                'output': output,
                                'tool': 'timeout_direct'
                            })
                            
                            if result.returncode == 0:
                                successful_commands += 1
                                analysis_parts.append(f"✓ Command {i} ({cmd}): SUCCESS")
                                analysis_parts.append(f"  Purpose: {explanation}")
                            else:
                                failed_commands += 1
                                analysis_parts.append(f"✗ Command {i} ({cmd}): FAILED (exit code {result.returncode})")
                                analysis_parts.append(f"  Purpose: {explanation}")
                                
                        except Exception as e:
                            failed_commands += 1
                            executed_commands.append({
                                'command': cmd,
                                'output': f'ERROR: {str(e)}',
                                'tool': 'timeout_direct'
                            })
                            analysis_parts.append(f"✗ Command {i} ({cmd}): ERROR - {str(e)}")
                    
                    final_analysis = "\n".join(analysis_parts)
                    final_analysis += f"\n\nSUMMARY: {successful_commands} successful, {failed_commands} failed"
                    
                    agent_result = {
                        'commands_executed': executed_commands,
                        'final_analysis': final_analysis,
                        'exploitation_attempts': len(executed_commands),
                        'vulnerability_info': vuln_info
                    }
                else:
                    agent_result = {
                        'commands_executed': [],
                        'final_analysis': 'Agent execution timed out and no suggested commands available',
                        'exploitation_attempts': 0,
                        'vulnerability_info': vuln_info
                    }
            except Exception as e:
                logger.error(f"DEBUG: Agent execution failed: {e}")
                # Don't set agent_result to None, let it fall through to final fallback
                agent_result = None
        
        if not agent_result:
            logger.warning(f"DEBUG: Agent returned no result, executing suggested commands as final fallback")
            # Final fallback: execute suggested commands directly
            vuln_info = payload.get('vulnerabilityInfo', {})
            suggested_commands = vuln_info.get('suggestedCommands', [])
            
            executed_commands = []
            successful_commands = 0
            failed_commands = 0
            analysis_parts = []
            
            if suggested_commands:
                analysis_parts.append(f"Agent execution failed, executing {len(suggested_commands)} suggested commands as final fallback:")
                
                for i, cmd_info in enumerate(suggested_commands, 1):
                    cmd = cmd_info.get('command', '')
                    explanation = cmd_info.get('explanation', 'No explanation')
                    
                    if not cmd:
                        continue
                        
                    try:
                        logger.debug(f"DEBUG: Final fallback - executing command {i}: {cmd}")
                        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
                        
                        output_parts = []
                        if result.stdout:
                            output_parts.append(f"STDOUT:\n{result.stdout}")
                        if result.stderr:
                            output_parts.append(f"STDERR:\n{result.stderr}")
                        if result.returncode != 0:
                            output_parts.append(f"EXIT_CODE: {result.returncode}")
                        
                        output = "\n".join(output_parts) if output_parts else "Command executed (no output)"
                        
                        executed_commands.append({
                            'command': cmd,
                            'output': output,
                            'tool': 'final_fallback'
                        })
                        
                        if result.returncode == 0:
                            successful_commands += 1
                            analysis_parts.append(f"✓ Command {i} ({cmd}): SUCCESS")
                            analysis_parts.append(f"  Purpose: {explanation}")
                        else:
                            failed_commands += 1
                            analysis_parts.append(f"✗ Command {i} ({cmd}): FAILED (exit code {result.returncode})")
                            analysis_parts.append(f"  Purpose: {explanation}")
                            
                    except Exception as e:
                        failed_commands += 1
                        executed_commands.append({
                            'command': cmd,
                            'output': f'ERROR: {str(e)}',
                            'tool': 'final_fallback'
                        })
                        analysis_parts.append(f"✗ Command {i} ({cmd}): ERROR - {str(e)}")
                
                final_analysis = "\n".join(analysis_parts)
                final_analysis += f"\n\nFINAL FALLBACK SUMMARY: {successful_commands} successful, {failed_commands} failed"
                
                agent_result = {
                    'commands_executed': executed_commands,
                    'final_analysis': final_analysis,
                    'exploitation_attempts': len(executed_commands),
                    'vulnerability_info': vuln_info
                }
            else:
                agent_result = {
                    'commands_executed': [],
                    'final_analysis': 'Agent execution failed and no suggested commands available',
                    'exploitation_attempts': 0,
                    'vulnerability_info': vuln_info
                }
        
        logger.debug(f"DEBUG: Agent execution completed")
        
        # Generate simple response focused on what agent did and found
        result = {
            "execution_complete": True,
            "commands_executed": len(agent_result.get('commands_executed', [])),
            "final_analysis": agent_result.get('final_analysis', ''),
            "detailed_results": agent_result.get('commands_executed', []),
            "vulnerability_info": agent_result.get('vulnerability_info', {}),
            "allowed": True
        }
        
        logger.debug(f"DEBUG: Returning simple execution result")
        logger.debug(f"DEBUG: Commands executed: {result['commands_executed']}")
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"DEBUG: Main function error: {e}")
        import traceback
        logger.debug(f"DEBUG: Full traceback:")
        traceback.print_exc(file=sys.stderr)
        
        # Fallback on error
        result = {
            "execution_complete": False,
            "commands_executed": 0,
            "final_analysis": "Error occurred during agent execution",
            "detailed_results": [],
            "error": str(e),
            "allowed": True
        }
        print(json.dumps(result))

if __name__ == '__main__':
    main() 