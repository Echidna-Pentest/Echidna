#!/usr/bin/env python3
"""
Command Validation Agent for Echidna

This agent uses LangChain's official Shell tool and AgentExecutor to validate
whether suggested commands are valid (i.e., can be executed / are enabled).

Unlike the complex ReactAgent, this focuses solely on command validation.
"""

import sys
import json
import os
import logging
from typing import Dict, Any, Optional, List

# Configure logging to file instead of stderr to avoid terminal noise
def setup_logging():
    """Setup logging to file instead of flooding stderr"""
    log_dir = os.path.dirname(__file__)
    log_file = os.path.join(log_dir, 'agent_validation.log')
    
    # Create logger
    logger = logging.getLogger('echidna_validation_agent')
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
            try:
                from langchain_openai import ChatOpenAI
                client = ChatOpenAI(
                    model=localai_config.get('model', 'auto'),
                    base_url=localai_config.get('baseUrl'),
                    api_key='sk-local',
                    temperature=0.1,
                    timeout=60,
                    max_retries=2
                    # Removed request_timeout and max_tokens for compatibility
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
        return None
            
    except ImportError as e:
        logger.error(f"DEBUG: Missing dependency: {e}")
        return None
    except Exception as e:
        logger.error(f"DEBUG: LLM setup error: {e}")
        return None

def build_validation_shell_tool():
    """Build shell tool for command validation using LangChain's interface"""
    # Try to import official ShellTool first
    shell_tool = None
    
    try:
        from langchain_community.tools.shell.tool import ShellTool
        shell_tool = ShellTool(name="shell_command", ask_human_input=False)
        logger.debug("DEBUG: Using LangChain community ShellTool")
        return [shell_tool]
    except ImportError:
        pass
    
    try:
        from langchain_experimental.tools import ShellTool
        shell_tool = ShellTool(name="shell_command", ask_human_input=False)
        logger.debug("DEBUG: Using LangChain experimental ShellTool")
        return [shell_tool]
    except ImportError:
        pass
    
    # If no official ShellTool available, create custom implementation that matches ShellTool interface
    logger.debug("DEBUG: Using custom shell tool implementation (ShellTool not available)")
    from langchain.tools import tool
    import subprocess
    
    @tool("shell_command") 
    def custom_shell_command(commands) -> str:
        """Execute shell commands for penetration testing validation. 
        
        Args:
            commands: The shell command to execute (string or dict with 'commands' key)
        
        Returns:
            The output of the command execution
        """
        # Handle both string and dict input formats
        if isinstance(commands, dict) and 'commands' in commands:
            command_str = commands['commands']
        elif isinstance(commands, str):
            command_str = commands
        else:
            command_str = str(commands)
        
        logger.debug(f"DEBUG: Shell tool executing command: {command_str}")
        
        # Safety check - block only the most dangerous commands
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
            r'chmod\s+777\s+/',
            r'chown.*\s+/',
            r'passwd\s+',
            r'sudo\s+.*rm\s+-rf',
            r'wget.*\|\s*sh',
            r'curl.*\|\s*sh'
        ]
        
        # Check if command contains dangerous patterns
        import re
        for pattern in dangerous_patterns:
            if re.search(pattern, command_str, re.IGNORECASE):
                return f"ERROR: Command '{command_str}' blocked for safety reasons (dangerous pattern detected)"
        
        try:
            result = subprocess.run(
                command_str, 
                shell=True,
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            # Format output similar to ShellTool
            output_parts = []
            if result.stdout:
                output_parts.append(result.stdout.strip())
            if result.stderr:
                output_parts.append(f"STDERR: {result.stderr.strip()}")
            if result.returncode != 0:
                output_parts.append(f"Return code: {result.returncode}")
            
            return "\n".join(output_parts) if output_parts else "Command executed successfully (no output)"
            
        except subprocess.TimeoutExpired:
            return "ERROR: Command timed out after 30 seconds"
        except Exception as e:
            return f"ERROR: {str(e)}"
    
    return [custom_shell_command]

def run_validation_agent(llm, commands_to_validate: List[str], max_iterations: int = 3) -> Optional[Dict[str, Any]]:
    """Run command validation agent using AgentExecutor"""
    logger.debug(f"DEBUG: Starting Command Validation Agent")
    logger.debug(f"DEBUG: LLM client: {type(llm).__name__ if llm else 'None'}")
    logger.debug(f"DEBUG: Commands to validate: {len(commands_to_validate)}")
    
    try:
        # Import LangChain agent components
        from langchain.agents import create_tool_calling_agent, AgentExecutor
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        
        # Build validation tools
        tools = build_validation_shell_tool()
        logger.debug(f"DEBUG: Created {len(tools)} validation tools: {[t.name for t in tools]}")

        # Create prompt for command validation
        prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "You validate whether suggested penetration testing commands work correctly by executing them directly.\n\n"
             "Available tools: {tools}\n"
             "Tool names: {tool_names}\n\n"
             "Use ONLY the tool 'shell_command'.\n\n"
             "TOOL USAGE: When calling shell_command, pass the command as a plain string parameter named 'commands'.\n"
             "CORRECT: shell_command(commands=\"nmap -sV 192.168.1.1\")\n"
             "WRONG: shell_command(commands={{\"commands\": \"nmap -sV 192.168.1.1\"}})\n\n"
             "For each command:\n"
             "1) Execute the suggested command directly using shell_command\n"
             "2) Analyze the output to determine if it worked as expected for penetration testing\n"
             "3) Report whether the command is functional and appropriate for pentesting\n\n"
             "IMPORTANT: You may execute penetration testing commands, but be responsible.\n"
             "Analyze command outputs to determine success/failure and pentesting effectiveness.\n"
             "Example: For 'nmap -sV target', call shell_command with commands=\"nmap -sV target\""),
            ("human", 
             "Execute and validate the following penetration testing commands:\n{commands_list}\n\n"
             "For each command, run it directly using the shell_command tool and analyze the output to determine:\n"
             "- Did the command execute successfully?\n"
             "- Does the output indicate it's working for penetration testing?\n"
             "- Is the command functional and appropriate?\n\n"
             "Remember: Call shell_command(commands=\"actual_command_here\") for each command.\n"
             "Report: command execution result, output analysis, verdict (Functional/Non-functional)."),
            MessagesPlaceholder("agent_scratchpad"),
        ])
        
        # Log the prompt for debugging
        logger.debug("DEBUG: Created validation prompt template")
        logger.debug("DEBUG: Prompt template system message:")
        logger.debug(prompt.messages[0].prompt.template)
        logger.debug("DEBUG: Prompt template human message:")
        logger.debug(prompt.messages[1].prompt.template)

        # Create tool-calling agent
        agent = create_tool_calling_agent(llm, tools, prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=tools,
            return_intermediate_steps=True,
            handle_parsing_errors=True,
            max_iterations=max_iterations,
            verbose=True,
        )

        # Format commands for validation
        commands_text = "\n".join([f"{i+1}. {cmd}" for i, cmd in enumerate(commands_to_validate)])
        
        # Prepare input parameters
        input_params = {
            "commands_list": commands_text,
            "tools": "\n".join(f"{tool.name}: {tool.description}" for tool in tools),
            "tool_names": ", ".join(tool.name for tool in tools),
        }
        
        # Log the full prompt that will be sent to LLM for debugging
        logger.debug("DEBUG: Input parameters for prompt:")
        logger.debug(f"  - commands_list: {input_params['commands_list']}")
        logger.debug(f"  - tools: {input_params['tools']}")
        logger.debug(f"  - tool_names: {input_params['tool_names']}")
        
        # Try to format and log the actual prompt  
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            # Format system message
            system_msg = prompt.messages[0].format(**input_params)
            human_msg = prompt.messages[1].format(**input_params)
            
            logger.debug("DEBUG: Formatted prompt that will be sent to LLM:")
            logger.debug("=" * 80)
            logger.debug("SYSTEM MESSAGE:")
            logger.debug(system_msg.content if hasattr(system_msg, 'content') else str(system_msg))
            logger.debug("-" * 40)
            logger.debug("HUMAN MESSAGE:")
            logger.debug(human_msg.content if hasattr(human_msg, 'content') else str(human_msg))
            logger.debug("=" * 80)
        except Exception as e:
            logger.debug(f"DEBUG: Could not format prompt for logging: {e}")
        
        # Execute validation
        logger.debug("DEBUG: Starting command validation execution...")
        
        result = executor.invoke(input_params)
        
        logger.debug("DEBUG: Validation agent execution completed")
        logger.debug(f"DEBUG: Result keys: {list(result.keys())}")

        # Process results
        validation_output = result.get("output", "").strip()
        intermediate_steps = result.get("intermediate_steps", [])
        
        validated_commands = []
        for idx, (action, observation) in enumerate(intermediate_steps, 1):
            logger.debug(f"DEBUG: Step {idx}: action.tool = {getattr(action, 'tool', 'N/A')}")
            if hasattr(action, 'tool') and action.tool == "shell_command":
                # Extract the actual command from tool_input
                if isinstance(action.tool_input, dict) and 'commands' in action.tool_input:
                    actual_command = action.tool_input['commands']
                elif isinstance(action.tool_input, str):
                    actual_command = action.tool_input
                else:
                    actual_command = str(action.tool_input)
                
                logger.debug(f"DEBUG: Step {idx} extracted command: {actual_command}")
                
                validated_commands.append({
                    "step": idx,
                    "command_checked": actual_command,
                    "validation_result": observation,
                    "tool_used": "shell_command"
                })

        validation_result = {
            "validation_complete": True,
            "total_commands": len(commands_to_validate),
            "commands_validated": len(validated_commands),
            "validation_summary": validation_output,
            "detailed_checks": validated_commands,
            "original_commands": commands_to_validate
        }
        
        logger.debug(f"DEBUG: Validation completed for {len(commands_to_validate)} commands")
        return validation_result

    except Exception as e:
        logger.error(f"DEBUG: Command validation agent execution failed: {e}")
        import traceback
        logger.debug("Full traceback:")
        traceback.print_exc()
        return None

def simple_command_validation(commands_to_validate: List[str]) -> Dict[str, Any]:
    """Simple command validation without LLM - fallback method"""
    logger.debug(f"Running simple validation for {len(commands_to_validate)} commands")
    
    validated_commands = []
    
    for i, cmd in enumerate(commands_to_validate):
        cmd_parts = cmd.strip().split()
        if not cmd_parts:
            validated_commands.append({
                "step": i + 1,
                "command_checked": cmd,
                "validation_result": "ERROR: Empty command",
                "tool_used": "simple_check"
            })
            continue
        
        cmd_name = cmd_parts[0]
        
        # Use 'which' to check if command exists
        try:
            import subprocess
            result = subprocess.run(
                ['which', cmd_name], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode == 0:
                validation_msg = f"Command '{cmd_name}' is available at: {result.stdout.strip()}"
            else:
                validation_msg = f"Command '{cmd_name}' is not available or not in PATH"
            
            validated_commands.append({
                "step": i + 1,
                "command_checked": cmd,
                "validation_result": validation_msg,
                "tool_used": "simple_check"
            })
        except Exception as e:
            validated_commands.append({
                "step": i + 1,
                "command_checked": cmd,
                "validation_result": f"Error checking command '{cmd_name}': {str(e)}",
                "tool_used": "simple_check"
            })
    
    # Generate summary
    available_count = sum(1 for v in validated_commands if "is available at" in v["validation_result"])
    summary = f"Simple validation completed: {available_count}/{len(commands_to_validate)} commands are available on this system."
    
    return {
        "validation_complete": True,
        "total_commands": len(commands_to_validate),
        "commands_validated": len(validated_commands),
        "validation_summary": summary,
        "detailed_checks": validated_commands,
        "original_commands": commands_to_validate
    }

def main():
    """Main function for command validation agent"""
    logger.debug("Starting Command Validation Agent...")
    
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
        
        # Get commands to validate from payload
        vulnerability_info = payload.get('vulnerabilityInfo', {})
        suggested_commands = vulnerability_info.get('suggestedCommands', [])
        
        # Extract command strings from command objects
        commands_to_validate = []
        for cmd in suggested_commands:
            if isinstance(cmd, dict):
                if 'command' in cmd:
                    commands_to_validate.append(cmd['command'])
                elif 'template' in cmd:
                    commands_to_validate.append(cmd['template'])
                else:
                    commands_to_validate.append(str(cmd))
            else:
                commands_to_validate.append(str(cmd))
        
        if not commands_to_validate:
            # If no specific commands provided, create some generic validation
            commands_to_validate = ['nmap', 'nc', 'curl', 'wget', 'ssh']
            logger.debug("No specific commands provided, validating common security tools")
        
        logger.debug(f"Commands to validate: {commands_to_validate}")
        
        # Try LLM-based validation first, fallback to simple validation
        validation_result = None
        try:
            # Create LLM client
            logger.debug("Creating LLM client...")
            llm = create_llm_client(config)
            
            if llm:
                logger.debug("LLM client created successfully, proceeding with AI validation agent")
                
                # Get agent configuration
                max_iterations = config.get('agentMaxIterations', 3)
                logger.debug(f"Agent max iterations: {max_iterations}")
                
                # Run validation agent
                validation_result = run_validation_agent(
                    llm, 
                    commands_to_validate,
                    max_iterations
                )
            else:
                logger.warning("Failed to create LLM client, falling back to simple validation")
        except Exception as llm_error:
            logger.warning(f"LLM validation failed: {llm_error}, falling back to simple validation")
        
        # If LLM validation failed, use simple validation
        if not validation_result:
            logger.debug("Using simple command validation fallback")
            validation_result = simple_command_validation(commands_to_validate)
        
        logger.debug("Validation execution completed successfully")
        
        # Generate response
        result = {
            "validation_complete": validation_result.get('validation_complete', False),
            "commands_validated": validation_result.get('commands_validated', 0),
            "validation_summary": validation_result.get('validation_summary', ''),
            "detailed_validation": validation_result.get('detailed_checks', []),
            "original_commands": validation_result.get('original_commands', []),
            "allowed": True
        }
        
        logger.debug(f"Returning validation result for {result['commands_validated']} commands")
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"Main function error: {e}")
        import traceback
        logger.debug("Full traceback:")
        traceback.print_exc(file=sys.stderr)
        
        # Return error response
        result = {
            "validation_complete": False,
            "commands_validated": 0,
            "validation_summary": f"Error occurred during validation: {str(e)}",
            "detailed_validation": [],
            "error": str(e),
            "allowed": True
        }
        print(json.dumps(result))

if __name__ == '__main__':
    main()
