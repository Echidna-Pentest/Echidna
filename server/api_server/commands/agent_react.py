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
            from langchain_openai import ChatOpenAI
            client = ChatOpenAI(
                model=localai_config.get('model', 'auto'),
                base_url=localai_config.get('baseUrl'),
                api_key='sk-local',
                temperature=0.1
            )
            logger.debug(f"DEBUG: Local LLM client created successfully")
            return client
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
            
            # Analyze output for exploitation success indicators
            success_analysis = analyze_exploitation_success(command, command_output)
            if success_analysis:
                command_output += f"\n\nEXPLOITATION ANALYSIS:\n{success_analysis}"
            
            logger.debug(f"DEBUG: Command completed. Success indicators: {bool(success_analysis)}")
            return command_output
            
        except subprocess.TimeoutExpired:
            return "ERROR: Command timed out after 60 seconds"
        except Exception as e:
            return f"ERROR: {str(e)}"
    
    return Tool(
        name="shell",
        description="Execute shell commands for penetration testing and exploitation. This tool automatically analyzes output for exploitation success indicators.",
        func=execute_shell_command
    )

def analyze_exploitation_success(command: str, output: str) -> str:
    """Analyze command output for exploitation success indicators"""
    command_lower = command.lower()
    output_lower = output.lower()
    
    success_indicators = []
    
    # Check for successful shell access
    if any(cmd in command_lower for cmd in ["whoami", "id"]) and output_lower.strip():
        if "root" in output_lower or "uid=0" in output_lower:
            success_indicators.append("ROOT ACCESS ACHIEVED!")
        elif any(user in output_lower for user in ["www-data", "apache", "nginx", "mysql"]):
            success_indicators.append("Service account access gained")
        else:
            success_indicators.append("User shell access confirmed")
    
    # Check for successful file system access
    if any(cmd in command_lower for cmd in ["ls", "cat", "find"]) and "permission denied" not in output_lower and output_lower.strip():
        success_indicators.append("File system access verified")
    
    # Check for successful network service exploitation
    if "ftp" in command_lower and ("login successful" in output_lower or "230" in output_lower):
        success_indicators.append("FTP login successful")
    elif "ssh" in command_lower and "password" in output_lower and "failed" not in output_lower:
        success_indicators.append("SSH access potentially gained")
    elif "mysql" in command_lower and "mysql>" in output_lower:
        success_indicators.append("MySQL database access gained")
    elif "smbmap" in command_lower and "read" in output_lower:
        success_indicators.append("SMB shares accessible")
    
    # Check for vulnerability scanner results
    if any(scanner in command_lower for scanner in ["nmap", "nikto", "dirb", "wpscan"]):
        if "vulnerable" in output_lower or "exploit" in output_lower:
            success_indicators.append("Vulnerabilities detected - ready for exploitation")
        elif "found" in output_lower and any(item in output_lower for item in ["directory", "file", "path"]):
            success_indicators.append("Attack surface expanded - new targets found")
    
    # Check for successful privilege escalation
    if "sudo" in command_lower and ("all" in output_lower or "nopasswd" in output_lower):
        success_indicators.append("Privilege escalation path found")
    
    # Check for successful exploit execution
    if any(exploit in command_lower for exploit in ["exploit", "payload", "reverse", "shell"]):
        if "session" in output_lower or "connected" in output_lower:
            success_indicators.append("Exploit executed successfully")
    
    return "\n".join(success_indicators) if success_indicators else ""

def create_react_agent(llm, last_output: str, env: Dict[str, Any], vulnerability_info: Dict[str, Any] = None, max_iterations: int = 5) -> Optional[str]:
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
                "- Access sensitive files (/etc/passwd, config files)",
                "- Escalate privileges (sudo access, root shell)",
                "- Establish persistence (reverse shells, backdoors)",
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
        system_prompt = """You are an EXPERT PENETRATION TESTING AGENT with a SPECIFIC MISSION:

PRIMARY GOAL: EXPLOIT DISCOVERED VULNERABILITIES AND VERIFY SUCCESS

CORE METHODOLOGY:
1. RECONNAISSANCE → SERVICE ENUMERATION → VULNERABILITY SCANNING → EXPLOITATION → VERIFICATION
2. When vulnerabilities are detected, IMMEDIATELY attempt exploitation
3. After exploitation attempts, VERIFY if the attack succeeded
4. Document success/failure for each exploitation attempt

EXPLOITATION PRIORITIES:
- If AI-suggested exploitation commands are provided, PRIORITIZE them
- Focus on HIGH and CRITICAL severity vulnerabilities first
- Attempt multiple exploitation techniques for the same vulnerability
- Verify each exploitation attempt immediately after execution

SUCCESS VERIFICATION METHODS:
- Check for shell access (whoami, id, pwd)
- Verify file system access (ls, cat sensitive files)
- Test privilege escalation (sudo -l, find SUID binaries)
- Confirm network access (netstat, ss)
- Validate service exploitation (service-specific verification)

AVAILABLE TOOLS: {tools}

CRITICAL RULES:
- Be AGGRESSIVE in exploitation attempts (this is ethical testing)
- NEVER skip exploitation when vulnerabilities are found
- ALWAYS verify if attacks succeeded
- Provide clear success/failure indicators
- Follow up failed attempts with alternative methods"""

        # Create user prompt with current context
        user_prompt_template = """CURRENT PENETRATION TESTING CONTEXT:

PREVIOUS TERMINAL OUTPUT:
{terminal_output}

VULNERABILITY ANALYSIS RESULTS:
{vulnerability_context}

TARGET HOST: {current_host}

YOUR MISSION:
Based on the above context, you must provide the NEXT EXPLOITATION COMMAND that will:
1. **PRIORITIZE AI-SUGGESTED COMMANDS** (if provided above - ALWAYS choose these first!)
2. Exploit any discovered vulnerabilities 
3. Verify the success of previous exploitation attempts
4. Continue the penetration testing methodology if no vulnerabilities are ready for exploitation

🚨 CRITICAL EXPLOITATION STRATEGY:
- **FIRST PRIORITY**: If vulnerability analysis shows "PRIORITY EXPLOITATION COMMANDS" above, YOU MUST select one of those commands. DO NOT ignore them!
- **SECOND PRIORITY**: If previous output shows exploitation opportunities, exploit them intelligently
- **THIRD PRIORITY**: If exploitation was attempted, verify the results


Use this format:

Question: What exploitation command should I execute next?
Thought: [Analysis of vulnerabilities and previous results - focus on exploitation opportunities]
Action: the action to take, should be one of [{tool_names}]
Action Input: [specific_exploitation_command_to_execute]
Observation: [tool will provide this]
Thought: [Analysis of exploitation results and next steps]
Final Answer: [exact_exploitation_command_to_run]

Question: What exploitation command should I execute next?
Thought:{agent_scratchpad}"""

        # Combine system and user prompts
        full_template = system_prompt + "\n\n" + user_prompt_template
        prompt = PromptTemplate.from_template(full_template)
        
        logger.debug(f"DEBUG: Exploitation-focused prompt template created")
        
        # Create agent with exploitation focus
        agent = create_react_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=True,
            max_iterations=max_iterations,
            handle_parsing_errors=True,
            return_intermediate_steps=True
        )
        
        logger.debug(f"DEBUG: Exploitation agent and executor created successfully")
        logger.debug(f"DEBUG: Calling AI service for exploitation planning...")
        
        # Run agent with exploitation focus
        result = agent_executor.invoke({
            "input": "What exploitation command should I execute next?",
            "current_host": env.get('currenthost', 'unknown_target'),
            "terminal_output": last_output[-4000:],  # Last 4000 chars for more context
            "vulnerability_context": vulnerability_context
        })
        
        logger.debug(f"DEBUG: AI service call completed")
        logger.debug(f"DEBUG: Agent result keys: {list(result.keys())}")
        
        # Extract command from final answer
        final_answer = result.get('output', '')
        logger.debug(f"DEBUG: Final answer from AI: {final_answer[:500]}...")
        
        # Enhanced command extraction for exploitation
        cmd = extract_exploitation_command(final_answer, result, last_output, exploitation_targets)
        
        logger.debug(f"DEBUG: Extracted exploitation command: {cmd}")
        
        return cmd
        
    except Exception as e:
        logger.error(f"DEBUG: ReAct exploitation agent error: {e}")
        import traceback
        logger.debug(f"DEBUG: Full traceback:")
        traceback.print_exc(file=sys.stderr)
        return None

def extract_exploitation_command(final_answer: str, result: dict, last_output: str, exploitation_targets: list) -> str:
    """Extract exploitation command with enhanced logic - prioritize AI suggestions"""
    logger.debug(f"DEBUG: Extracting exploitation command...")
    
    # ALWAYS prioritize suggested exploitation commands if available
    if exploitation_targets:
        cmd = exploitation_targets[0]["command"]  # Use highest priority command
        logger.debug(f"DEBUG: Using priority suggested exploitation command: {cmd}")
        logger.debug(f"DEBUG: Command explanation: {exploitation_targets[0].get('explanation', 'No explanation')}")
        return cmd
    
    # Check if agent hit iteration limit
    if "iteration limit" in final_answer.lower() or "time limit" in final_answer.lower():
        logger.warning(f"DEBUG: Agent hit iteration limit, but no suggested commands available")
        
        # Try to extract command from intermediate steps
        intermediate_steps = result.get('intermediate_steps', [])
        if intermediate_steps:
            logger.debug(f"DEBUG: Found {len(intermediate_steps)} intermediate steps")
            last_step = intermediate_steps[-1]
            if len(last_step) >= 2:
                action = last_step[0]
                if hasattr(action, 'tool_input'):
                    cmd = action.tool_input
                    logger.debug(f"DEBUG: Extracted command from intermediate step: {cmd}")
                    return cmd
        
        # Final fallback - basic network discovery
        logger.debug(f"DEBUG: No intermediate steps found, using basic discovery fallback")
        return "nmap -sn 192.168.1.0/24"  # Simple network discovery
    
    # Clean up the command normally from LLM response
    cmd = final_answer.strip()
    cmd = re.sub(r'^[>\$#]\s*', '', cmd)  # Remove shell prompts
    cmd = cmd.strip('`"\'')  # Remove quotes/backticks
    
    logger.debug(f"DEBUG: Cleaned LLM command: {cmd}")
    return cmd

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
            logger.warning(f"DEBUG: No LLM available, using fallback command")
            cmd = "whoami"
        else:
            logger.debug(f"DEBUG: LLM client created, proceeding with ReAct agent")
            # Use ReAct agent with shell access
            max_iterations = config.get('agentMaxIterations', 5)
            logger.debug(f"DEBUG: Agent max iterations: {max_iterations}")
            
            cmd = create_react_agent(
                llm, 
                payload.get('lastOutput', ''),
                payload.get('env', {}),
                payload.get('vulnerabilityInfo', {}), # Pass vulnerability info
                max_iterations
            )
        
        if not cmd:
            logger.warning(f"DEBUG: Agent returned no command, using fallback")
            cmd = "whoami"
        
        # Final safety check
        if not safe_command_check(cmd):
            logger.warning(f"DEBUG: Command '{cmd}' blocked for safety, using fallback")
            cmd = "echo 'Command blocked for safety'"
        
        logger.debug(f"DEBUG: Final command: {cmd}")
        
        # Simple response - let AI handle all intelligence 
        result = {
            "next_command": cmd,
            "reason": "AI-driven exploitation command selection",
            "confidence": 0.9 if payload.get('vulnerabilityInfo', {}).get('suggestedCommands') else 0.7,
            "allowed": True,
            "exploitation_focused": True
        }
        
        logger.debug(f"DEBUG: Returning AI-driven result: {json.dumps(result, indent=2)}")
        print(json.dumps(result))
        
    except Exception as e:
        logger.error(f"DEBUG: Main function error: {e}")
        import traceback
        logger.debug(f"DEBUG: Full traceback:")
        traceback.print_exc(file=sys.stderr)
        
        # Fallback
        result = {
            "next_command": "whoami",
            "reason": "Error fallback",
            "confidence": 0.1,
            "allowed": True
        }
        print(json.dumps(result))

if __name__ == '__main__':
    main() 