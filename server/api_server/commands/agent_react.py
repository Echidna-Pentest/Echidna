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
                    temperature=0.2,
                    timeout=120,  # Increased timeout for LocalAI ReAct chains
                    streaming=False,  # Disable streaming for ReAct compatibility
                    max_retries=2,  # Allow more retries for stability
                    request_timeout=120,  # HTTP request timeout
                    max_tokens=4096  # Ensure enough tokens for ReAct reasoning
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

def build_shell_tool():
    """Prefer the built-in ShellTool; fall back to @tool wrapper if unavailable."""
    try:
        # Try LangChain 0.2+ community package first
        from langchain_community.tools.shell.tool import ShellTool
        base_shell = ShellTool()
        logger.debug("DEBUG: Using LangChain community ShellTool")
    except ImportError:
        try:
            # Try experimental package for older versions
            from langchain_experimental.tools import ShellTool
            base_shell = ShellTool()
            logger.debug("DEBUG: Using LangChain experimental ShellTool")
        except ImportError:
            # Fallback to custom implementation
            logger.debug("DEBUG: Using fallback custom shell tool")
            from langchain.tools import tool
            
            @tool("shell_command")
            def _fallback_shell(command: str) -> str:
                """Execute shell commands for penetration testing and vulnerability exploitation."""
                if not safe_command_check(command):
                    return "ERROR: Command blocked for safety reasons"
                try:
                    result = subprocess.run(
                        command, shell=True, capture_output=True, text=True, timeout=60,
                        cwd=os.path.expanduser("~")
                    )
                    out = []
                    if result.stdout: 
                        out.append(f"STDOUT:\n{result.stdout}")
                    if result.stderr: 
                        out.append(f"STDERR:\n{result.stderr}")
                    if result.returncode != 0: 
                        out.append(f"EXIT_CODE: {result.returncode}")
                    return "\n".join(out) if out else "Command executed successfully (no output)"
                except subprocess.TimeoutExpired:
                    return "ERROR: Command timed out after 60 seconds"
                except Exception as e:
                    return f"ERROR: {str(e)}"
            return [_fallback_shell]
    
    # If we have ShellTool, wrap it with safety guard and ensure consistent naming
    from langchain.tools import tool
    
    @tool("shell_command")
    def guarded_shell(command: str) -> str:
        """Execute shell commands for penetration testing and vulnerability exploitation."""
        if not safe_command_check(command):
            return "ERROR: Command blocked for safety reasons"
        try:
            return base_shell.run(command)
        except Exception as e:
            return f"ERROR: {str(e)}"
    
    return [guarded_shell]





def run_langchain_react_agent(llm, last_output: str, env: Dict[str, Any], vulnerability_info: Dict[str, Any] = None, max_iterations: int = 5) -> Optional[Dict[str, Any]]:
    """Run proper LangChain ReAct agent using create_react_agent + AgentExecutor"""
    logger.debug(f"DEBUG: Starting LangChain ReAct Agent")
    logger.debug(f"DEBUG: LLM client: {type(llm).__name__ if llm else 'None'}")
    logger.debug(f"DEBUG: Max iterations: {max_iterations}")
    
    try:
        # Import proper ReAct agent components
        from langchain.agents import create_react_agent, AgentExecutor
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        
        # Add stop tokens for LocalAI/LM Studio compatibility
        try:
            llm = llm.bind(stop=["\nObservation:", "Observation:"])
            logger.debug("DEBUG: Added stop tokens for ReAct parsing")
        except Exception as e:
            logger.debug(f"DEBUG: Could not bind stop tokens: {e}")

        # --- Tool preparation (official ShellTool or fallback) ---
        tools = build_shell_tool()
        logger.debug(f"DEBUG: Created {len(tools)} tools: {[t.name for t in tools]}")

        # --- Build vulnerability context (optional) ---
        vuln_ctx = ""
        if vulnerability_info:
            cmds = vulnerability_info.get("suggestedCommands", [])
            cmd_list = [c.get("command", str(c)) if isinstance(c, dict) else str(c) for c in cmds]
            vuln_ctx = (
                "VULNERABILITY CONTEXT:\n"
                f"- Severity: {vulnerability_info.get('severity','Unknown')}\n"
                f"- Description: {vulnerability_info.get('description','N/A')}\n"
                f"- Suggested Commands: {cmd_list}\n"
            )

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are a penetration testing agent using the ReAct pattern.\n"
             "You have access to these tools: {tools}\n"
             "Tool names: {tool_names}\n\n"
             "Follow this EXACT format, repeating as needed:\n"
             "Thought: <what you will do next>\n"
             "Action: shell_command\n"
             "Action Input: <ONLY the raw shell command, no quotes, no markdown>\n"
             "Observation: <result will be inserted by the system>\n\n"
             "Rules:\n"
             "- Start with Thought.\n"
             "- Action must be exactly 'shell_command' (from available tools: {tool_names}).\n"
             "- Action Input must be ONLY the command string (no backticks / code fences / JSON).\n"
             "- Never output code fences or JSON anywhere.\n"
             "- After each Observation, continue with another Thought.\n"
             "- When finished:\n"
             "Thought: I now have enough information to provide my final analysis\n"
             "Final Answer: <concise summary>\n\n"
             "Example step:\n"
             "Thought: Check if the target FTP port is reachable\n"
             "Action: shell_command\n"
             "Action Input: nc -zv 192.0.2.10 21\n"
             "Observation: <...>"),
            ("human",
             "Context:\n{vuln_ctx}\n"
             "LAST TERMINAL OUTPUT:\n{last_output}\n\n"
#             "Goal:\n- Validate the finding methodically and report a concise final analysis.\n"
             "Goal:\n- Validate the suggested commands works or not and report a concise final analysis.\n"
             "Begin now."),
            ("ai", "{agent_scratchpad}"),
        ])

        # --- ReAct Agent construction ---
        agent = create_react_agent(llm, tools, prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=tools,
            return_intermediate_steps=True,
            handle_parsing_errors=True,
            max_iterations=max_iterations,
            early_stopping_method="generate",
            verbose=True,
        )

        # --- Execution ---
        logger.debug("DEBUG: Starting LangChain ReAct agent execution...")
        logger.debug("="*80)
#        logger.debug(f"VULNERABILITY CONTEXT: {vuln_ctx}")
#        logger.debug(f"LAST OUTPUT: {last_output[:200]}...")
        logger.debug(f"prompt: {prompt}")
        logger.debug("="*80)
        
        res = executor.invoke({
            "input": "",  # human message is complete in template
            "vuln_ctx": vuln_ctx,
            "last_output": last_output,
        })
        logger.debug("DEBUG: ReAct agent execution completed")
        logger.debug(f"DEBUG: Result keys: {list(res.keys())}")

        final_text = res.get("output", "").strip()
        executed_commands = []
        intermediate_steps = res.get("intermediate_steps", [])
        logger.debug(f"DEBUG: Found {len(intermediate_steps)} intermediate steps")
        
        for idx, (action, observation) in enumerate(intermediate_steps, 1):
            logger.debug(f"DEBUG: Step {idx}: action.tool = {getattr(action, 'tool', 'N/A')}")
            if getattr(action, "tool", "") == "shell_command":
                cmd = action.tool_input if isinstance(action.tool_input, str) else str(action.tool_input)
                executed_commands.append({
                    "step": idx,
                    "tool": "shell_command",
                    "command": cmd,
                    "output": observation,
                })
                logger.debug(f"DEBUG: Captured command {idx}: {cmd[:100]}...")

        agent_result = {
            "commands_executed": executed_commands,
            "final_analysis": final_text,
            "exploitation_attempts": len(executed_commands),
            "vulnerability_info": vulnerability_info or {},
            "total_steps": len(intermediate_steps),
        }
        
        logger.debug(f"DEBUG: LangChain ReAct agent completed with {len(executed_commands)} commands executed")
        return agent_result

    except Exception as e:
        logger.error(f"DEBUG: LangChain ReAct agent execution failed: {e}")
        import traceback
        logger.debug("Full traceback:")
        traceback.print_exc()
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
        max_iterations = config.get('agentMaxIterations', 9)
        logger.debug(f"Agent max iterations: {max_iterations}")
        
        # Run REAL LangChain ReAct agent
        agent_result = run_langchain_react_agent(
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