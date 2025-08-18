#!/usr/bin/env python3
import sys
import json
import os
import re
import subprocess
import time
from typing import Dict, Any, Optional

def create_llm_client(config: Dict[str, Any]):
    """Create LLM client based on config"""
    print("🔍 DEBUG: Creating LLM client...", file=sys.stderr)
    print(f"🔍 DEBUG: Config keys: {list(config.keys())}", file=sys.stderr)
    
    try:
        # Try Gemini first (preferred for agent)
        gemini_config = config.get('gemini', {})
        if gemini_config.get('enabled') and gemini_config.get('apiKey'):
            print("🔍 DEBUG: Trying Gemini configuration...", file=sys.stderr)
            print(f"🔍 DEBUG: Gemini enabled: {gemini_config.get('enabled')}", file=sys.stderr)
            print(f"🔍 DEBUG: Gemini API key present: {'Yes' if gemini_config.get('apiKey') else 'No'}", file=sys.stderr)
            print(f"🔍 DEBUG: Gemini model: {gemini_config.get('model', 'gemini-1.5-flash')}", file=sys.stderr)
            from langchain_google_genai import ChatGoogleGenerativeAI
            client = ChatGoogleGenerativeAI(
                model=gemini_config.get('model', 'gemini-1.5-flash'),
                google_api_key=gemini_config.get('apiKey'),
                temperature=0.1
            )
            print("✅ DEBUG: Gemini client created successfully", file=sys.stderr)
            return client
        
        # Try OpenAI second (new config structure)
        openai_config = config.get('openai', {})
        if openai_config.get('enabled') and openai_config.get('apiKey'):
            print("🔍 DEBUG: Trying OpenAI configuration...", file=sys.stderr)
            print(f"🔍 DEBUG: OpenAI enabled: {openai_config.get('enabled')}", file=sys.stderr)
            print(f"🔍 DEBUG: API key present: {'Yes' if openai_config.get('apiKey') else 'No'}", file=sys.stderr)
            print(f"🔍 DEBUG: OpenAI model: {openai_config.get('model', 'gpt-4o-mini')}", file=sys.stderr)
            from langchain_openai import ChatOpenAI
            client = ChatOpenAI(
                model=openai_config.get('model', 'gpt-4o-mini'),
                api_key=openai_config.get('apiKey'),
                temperature=0.1
            )
            print("✅ DEBUG: OpenAI client created successfully", file=sys.stderr)
            return client
        
        # Try local LLM last (fallback)
        localai_config = config.get('localAI', {})
        if localai_config.get('enabled') and localai_config.get('baseUrl'):
            print("🔍 DEBUG: Trying local LLM configuration...", file=sys.stderr)
            print(f"🔍 DEBUG: Local enabled: {localai_config.get('enabled')}", file=sys.stderr)
            print(f"🔍 DEBUG: Local base URL: {localai_config.get('baseUrl')}", file=sys.stderr)
            print(f"🔍 DEBUG: Local model: {localai_config.get('model', 'auto')}", file=sys.stderr)
            from langchain_openai import ChatOpenAI
            client = ChatOpenAI(
                model=localai_config.get('model', 'auto'),
                base_url=localai_config.get('baseUrl'),
                api_key='sk-local',
                temperature=0.1
            )
            print("✅ DEBUG: Local LLM client created successfully", file=sys.stderr)
            return client
        
        else:
            print("❌ DEBUG: No LLM configuration found", file=sys.stderr)
            print("🔍 DEBUG: Available config options:", file=sys.stderr)
            
            # Check new config structure
            openai_config = config.get('openai', {})
            gemini_config = config.get('gemini', {})
            localai_config = config.get('localAI', {})
            
            print(f"  - openai.enabled: {openai_config.get('enabled', 'Not set')}", file=sys.stderr)
            print(f"  - openai.apiKey: {'Present' if openai_config.get('apiKey') else 'Not set'}", file=sys.stderr)
            print(f"  - gemini.enabled: {gemini_config.get('enabled', 'Not set')}", file=sys.stderr)
            print(f"  - gemini.apiKey: {'Present' if gemini_config.get('apiKey') else 'Not set'}", file=sys.stderr)
            print(f"  - localAI.enabled: {localai_config.get('enabled', 'Not set')}", file=sys.stderr)
            print(f"  - localAI.baseUrl: {localai_config.get('baseUrl', 'Not set')}", file=sys.stderr)
            return None
            
    except ImportError as e:
        print(f"❌ DEBUG: Missing dependency: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"❌ DEBUG: LLM setup error: {e}", file=sys.stderr)
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
        """Execute a shell command and return the output"""
        try:
            # Safety check
            if not safe_command_check(command):
                return "ERROR: Command blocked for safety reasons"
            
            # Execute command with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                cwd=os.path.expanduser("~")  # Run from home directory
            )
            
            output = []
            if result.stdout:
                output.append(f"STDOUT:\n{result.stdout}")
            if result.stderr:
                output.append(f"STDERR:\n{result.stderr}")
            if result.returncode != 0:
                output.append(f"EXIT_CODE: {result.returncode}")
            
            return "\n".join(output) if output else "Command executed successfully (no output)"
            
        except subprocess.TimeoutExpired:
            return "ERROR: Command timed out after 30 seconds"
        except Exception as e:
            return f"ERROR: {str(e)}"
    
    return Tool(
        name="shell",
        description="Execute shell commands. Use this to run any command like nmap, dirb, nikto, etc. Be careful with destructive commands.",
        func=execute_shell_command
    )

def create_react_agent(llm, last_output: str, env: Dict[str, Any], vulnerability_info: Dict[str, Any] = None, max_iterations: int = 5) -> Optional[str]:
    """Create and run ReAct agent with shell access"""
    print("🔍 DEBUG: Creating ReAct agent...", file=sys.stderr)
    print(f"🔍 DEBUG: LLM client: {type(llm).__name__ if llm else 'None'}", file=sys.stderr)
    print(f"🔍 DEBUG: Max iterations: {max_iterations}", file=sys.stderr)
    print(f"🔍 DEBUG: Terminal output length: {len(last_output)} chars", file=sys.stderr)
    print(f"🔍 DEBUG: Vulnerability info provided: {'Yes' if vulnerability_info else 'No'}", file=sys.stderr)
    
    try:
        from langchain.agents import create_react_agent, AgentExecutor
        from langchain.prompts import PromptTemplate
        
        print("🔍 DEBUG: LangChain imports successful", file=sys.stderr)
        
        # Create shell tool
        shell_tool = create_shell_tool()
        tools = [shell_tool]
        
        print(f"🔍 DEBUG: Tools created: {[tool.name for tool in tools]}", file=sys.stderr)
        
        # Format vulnerability context
        vulnerability_context = "No specific vulnerability information available."
        if vulnerability_info:
            context_parts = [
                f"- Severity: {vulnerability_info.get('severity', 'Unknown')}",
                f"- Description: {vulnerability_info.get('description', 'Not available')}",
                f"- Analysis Provider: {vulnerability_info.get('provider', 'Unknown')}"
            ]
            
            suggested_commands = vulnerability_info.get('suggestedCommands', [])
            if suggested_commands:
                context_parts.append("- AI-Suggested Exploitation Commands:")
                for i, cmd in enumerate(suggested_commands[:3], 1):  # Limit to top 3 commands
                    command = cmd.get('command', 'Unknown')
                    explanation = cmd.get('explanation', 'No explanation')
                    context_parts.append(f"  {i}. {command} ({explanation})")
            
            vulnerability_context = "\n".join(context_parts)
        
        print(f"🔍 DEBUG: Formatted vulnerability context: {vulnerability_context[:200]}...", file=sys.stderr)
        
        # Create ReAct prompt template
        template = """You are an expert penetration testing agent. Analyze the terminal output and suggest the NEXT logical command for ethical penetration testing.

AVAILABLE TOOLS:
{tools}

CURRENT CONTEXT:
- Current host: {current_host}
- Previous terminal output: {terminal_output}

VULNERABILITY ANALYSIS RESULTS:
{vulnerability_context}

METHODOLOGY:
1. Reconnaissance → Service enumeration → Vulnerability scanning → Exploitation

YOUR TASK:
Analyze the previous output and provide exactly ONE command that logically follows. Be direct and decisive.
Consider the vulnerability information provided and the AI-suggested exploitation commands as guidance.

EXAMPLES OF GOOD RESPONSES:
- If nmap shows FTP port 21 open: suggest "ftp 172.20.10.10" to test anonymous login
- If nmap shows web ports: suggest "dirb http://target/" for directory enumeration  
- If nmap shows SMB: suggest "smbmap -H target" for share enumeration
- If service versions found: suggest specific vulnerability checks
- If specific vulnerability detected: prioritize exploitation commands that match the vulnerability

Use this format:

Question: What should I do next based on the previous terminal output?
Thought: [Brief analysis of what was discovered and what to do next]
Action: the action to take, should be one of [{tool_names}]
Action Input: [specific_command_to_execute]
Observation: [tool will provide this]
Thought: Based on my analysis, the next logical command is clear
Final Answer: [exact_command_to_run]

Question: What should I do next based on the previous terminal output?
Thought:{agent_scratchpad}"""

        prompt = PromptTemplate.from_template(template)
        
        print("🔍 DEBUG: Prompt template created", file=sys.stderr)
        
        # Create agent
        agent = create_react_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(
            agent=agent, 
            tools=tools, 
            verbose=True,
            max_iterations=max_iterations,
            handle_parsing_errors=True,
            return_intermediate_steps=True
        )
        
        print("🔍 DEBUG: Agent and executor created successfully", file=sys.stderr)
        print("🔍 DEBUG: Calling AI service...", file=sys.stderr)
        
        # Run agent
        result = agent_executor.invoke({
            "input": "What should I do next based on the previous terminal output?",
            "current_host": env.get('currenthost', 'default'),
            "terminal_output": last_output[-3000:],  # Last 3000 chars
            "vulnerability_context": vulnerability_context
        })
        
        print("✅ DEBUG: AI service call completed", file=sys.stderr)
        print(f"🔍 DEBUG: Agent result keys: {list(result.keys())}", file=sys.stderr)
        
        # Extract command from final answer
        final_answer = result.get('output', '')
        print(f"🔍 DEBUG: Final answer from AI: {final_answer}", file=sys.stderr)
        
        # Check if agent hit iteration limit
        if "iteration limit" in final_answer.lower() or "time limit" in final_answer.lower():
            print("⚠️  DEBUG: Agent hit iteration limit, checking intermediate steps", file=sys.stderr)
            intermediate_steps = result.get('intermediate_steps', [])
            print(f"🔍 DEBUG: Found {len(intermediate_steps)} intermediate steps", file=sys.stderr)
            
            # Try to extract command from the last action in intermediate steps
            if intermediate_steps:
                last_step = intermediate_steps[-1]
                if len(last_step) >= 2:
                    action, observation = last_step[0], last_step[1]
                    if hasattr(action, 'tool_input'):
                        cmd = action.tool_input
                        print(f"🔍 DEBUG: Extracted command from intermediate step: {cmd}", file=sys.stderr)
                    else:
                        cmd = None
                else:
                    cmd = None
            else:
                cmd = None
                
            # If no command found in intermediate steps, provide a logical fallback
            if not cmd:
                print("🔍 DEBUG: No command in intermediate steps, analyzing terminal output for fallback", file=sys.stderr)
                if "ftp" in last_output.lower() and "21/tcp open" in last_output.lower():
                    # Extract IP from nmap output
                    import re
                    ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', last_output)
                    if ip_match:
                        target_ip = ip_match.group(1)
                        cmd = f"ftp {target_ip}"
                        print(f"🔍 DEBUG: Generated FTP connection fallback: {cmd}", file=sys.stderr)
                    else:
                        cmd = "whoami"
                else:
                    cmd = "whoami"
        else:
            # Clean up the command normally
            cmd = final_answer.strip()
            cmd = re.sub(r'^[>\$#]\s*', '', cmd)  # Remove shell prompts
            cmd = cmd.strip('`"\'')  # Remove quotes/backticks
        
        print(f"🔍 DEBUG: Cleaned command: {cmd}", file=sys.stderr)
        
        return cmd
        
    except Exception as e:
        print(f"❌ DEBUG: ReAct agent error: {e}", file=sys.stderr)
        import traceback
        print(f"🔍 DEBUG: Full traceback:", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None

def main():
    print("🚀 DEBUG: Starting ReAct agent...", file=sys.stderr)
    
    try:
        # Read input
        print("🔍 DEBUG: Reading input from stdin...", file=sys.stderr)
        raw = sys.stdin.read()
        payload = json.loads(raw or '{}')
        
        print(f"🔍 DEBUG: Input payload keys: {list(payload.keys())}", file=sys.stderr)
        print(f"🔍 DEBUG: Payload: {json.dumps(payload, indent=2)[:500]}...", file=sys.stderr)
        
        # Load config
        config_path = os.path.join(os.path.dirname(__file__), '..', 'echidna.json')
        print(f"🔍 DEBUG: Loading config from: {config_path}", file=sys.stderr)
        
        if not os.path.exists(config_path):
            print(f"❌ DEBUG: Config file not found at {config_path}", file=sys.stderr)
            config = {}
        else:
            with open(config_path, 'r') as f:
                config = json.load(f)
            print(f"✅ DEBUG: Config loaded successfully", file=sys.stderr)
        
        # Create LLM client
        print("🔍 DEBUG: Creating LLM client...", file=sys.stderr)
        llm = create_llm_client(config)
        
        if not llm:
            print("⚠️  DEBUG: No LLM available, using fallback command", file=sys.stderr)
            cmd = "whoami"
        else:
            print("✅ DEBUG: LLM client created, proceeding with ReAct agent", file=sys.stderr)
            # Use ReAct agent with shell access
            max_iterations = config.get('agentMaxIterations', 5)
            print(f"🔍 DEBUG: Agent max iterations: {max_iterations}", file=sys.stderr)
            
            cmd = create_react_agent(
                llm, 
                payload.get('lastOutput', ''),
                payload.get('env', {}),
                payload.get('vulnerabilityInfo', {}), # Pass vulnerability info
                max_iterations
            )
        
        if not cmd:
            print("⚠️  DEBUG: Agent returned no command, using fallback", file=sys.stderr)
            cmd = "whoami"
        
        # Final safety check
        if not safe_command_check(cmd):
            print(f"⚠️  DEBUG: Command '{cmd}' blocked for safety, using fallback", file=sys.stderr)
            cmd = "echo 'Command blocked for safety'"
        
        print(f"🎯 DEBUG: Final command: {cmd}", file=sys.stderr)
        
        # Return JSON response
        result = {
            "next_command": cmd,
            "reason": "ReAct agent with shell access",
            "confidence": 0.95,
            "allowed": True
        }
        
        print(f"📤 DEBUG: Returning result: {json.dumps(result)}", file=sys.stderr)
        print(json.dumps(result))
        
    except Exception as e:
        print(f"❌ DEBUG: Main function error: {e}", file=sys.stderr)
        import traceback
        print(f"🔍 DEBUG: Full traceback:", file=sys.stderr)
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