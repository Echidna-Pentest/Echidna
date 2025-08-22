const express = require('express');
const fs = require('fs');
const notifier = require('routes/notifier');
const axios = require('axios');
const config = require('../echidna.json');
const { Configuration, OpenAIApi } = require("openai");
const OpenAIClient = require('openai'); 
const commands = require('routes/commands');
const terminals = require('routes/terminals');
const shell = require('routes/shell');

/**
* @type {string}
*/
const SAVE_FILE = './data/chats.json';

/**
* @type {Array<Object>}
*/
let _chats = [];

/**
 * Get or create AI terminal for agent command execution
 * @returns {number} AI terminal ID
 */
function getOrCreateAITerminal() {
  // Check if AI terminal already exists
  const aiTerminals = terminals.getAll().filter(t => t.name === 'AI');
  if (aiTerminals.length > 0) {
    return aiTerminals[0].id;
  }
  
  // Create new AI terminal
  const aiTerminal = terminals.create('AI');
  if (aiTerminal) {
    console.log(`[Agent] Created AI terminal with ID: ${aiTerminal.id}`);
    return aiTerminal.id;
  }
  
  // Fallback to terminal 1 if creation fails
  console.warn('[Agent] Failed to create AI terminal, falling back to terminal 1');
  return 1;
}

/**
* Chats class
*/
class Chats {
  /**
  * Constructor
  * @param {string} name
  */
  constructor(chatId, type='text', author='OpenAI', data) {
    if (!data){
      this.data = data;
    }
    this.chatId = chatId;
    this.type=type;
    this.author=author;
    this.data = data;
//    console.log(`[chats] created from "${this.author}" data is "${data}"`);
  }

  /**
  * Get chat information
  * @returns {object}
  */
  info() {
    return { type: this.type, author: this.author, data: this.data };
  }
}

// System prompt for role and format definition
const SYSTEM_PROMPT = `
You analyze a pentester's terminal.

Analyze ONLY outputs that clearly come from an attack command or a remote session. 

Report ONLY CRITICAL/HIGH vulnerabilities. If no CRITICAL/HIGH vulnerabilities are found, reply exactly: NONE. If you find a vulnerability, provide up to 2 exploitation commands that directly target the vulnerability.

When reporting, output ONLY this JSON (no extra text):
{
  "severity": "CRITICAL" | "HIGH",
  "vulnerability": "short description & impact tied to the target",
  "commands": [
    {"command": "...", "explanation": "what is this command"},
    {"command": "...", "explanation": "..."},
  ]
}
`;

// postChat function removed - AI analysis results are handled via CandidateCommands only

function parseAIResponse(content, provider) {
  console.log(`[Debug] ${provider} parsing content: ${content ? content.substring(0, 200) : 'empty'}...`);
  console.log(`[Debug] ${provider} FULL content: "${content}"`);
  try {
    // Try to extract JSON from the response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    console.log(`[Debug] ${provider} JSON match found: ${jsonMatch ? 'Yes' : 'No'}`);
    if (!jsonMatch) {
      // If no JSON found, check for NONE response
      if (content.trim().toUpperCase() === 'NONE') {
        console.log(`[Chats] ${provider}: No HIGH/CRITICAL vulnerabilities found - skipping`);
        return null; // No commands to create
      }
      console.log(`[Debug] ${provider} no JSON and not NONE, content: "${content.trim()}"`);
      throw new Error('No valid JSON found in response');
    }

    const jsonData = JSON.parse(jsonMatch[0]);
    console.log(`[Debug] ${provider} parsed JSON severity: ${jsonData.severity}`);
    
    // Check if severity is HIGH or CRITICAL
    if (!jsonData.severity || !['HIGH', 'CRITICAL'].includes(jsonData.severity.toUpperCase())) {
      console.log(`[Chats] ${provider}: Vulnerability severity not HIGH/CRITICAL - skipping`);
      return null;
    }
    
    if (!jsonData.commands || !Array.isArray(jsonData.commands)) {
      console.log(`[Chats] No valid commands array found in ${provider} response`);
      return null;
    }

    if (jsonData.commands.length === 0) {
      console.log(`[Chats] ${provider}: No exploitation commands provided - skipping`);
      return null;
    }

    console.log(`[Chats] ${provider}: Found ${jsonData.severity} severity vulnerability - processing`);
    return jsonData;
  } catch (error) {
    console.error(`[Chats] Failed to parse ${provider} response as JSON:`, error.message);
    if (content.includes('"severity"') && content.includes('CRITICAL')) {
      console.log(`[Chats] ${provider}: Found truncated CRITICAL response, attempting recovery...`);
      // Try to extract just the severity for agent triggering
      return { severity: 'CRITICAL', vulnerability: 'Truncated response detected', commands: [] };
    }
    return null;
  }
}

/**
 * Call Validation Agent for command validation
 * @param {Object} aiData - AI analysis data with vulnerability info
 * @param {string} provider - AI provider name
 * @param {number} aiTerminalId - AI terminal ID for validation output
 */
function callValidationAgent(aiData, provider, aiTerminalId) {
  const { spawn } = require('child_process');
  const path = require('path');
  const script = config.agent?.validationScript || './commands/agent_validation.py';
  const timeoutMs = config.agent?.timeoutMs || 30000; // Shorter timeout for validation
  const pythonPath = config.agent?.pythonPath || 'python3';
  
  // Fix the script path - resolve relative to the api_server directory, not routes
  const scriptPath = path.resolve(__dirname, '..', script);
  
  // Prepare payload with vulnerability information for ValidationAgent
  const inputPayload = JSON.stringify({
    vulnerabilityInfo: {
      severity: aiData.severity,
      description: aiData.vulnerability,
      provider: provider,
      suggestedCommands: aiData.commands || []
    }
  });
  
  console.log(`[ValidationAgent] Spawning ValidationAgent: ${pythonPath} ${scriptPath} with timeout ${timeoutMs}ms`);
  const py = spawn(pythonPath, [scriptPath], { 
    cwd: path.resolve(__dirname, '..'), 
    env: process.env 
  });
  
  let agentOut = '';
  let agentErr = '';
  const timer = setTimeout(() => {
    console.log(`[ValidationAgent] Timeout after ${timeoutMs}ms, killing process...`);
    try { py.kill('SIGKILL'); } catch(e){}
  }, timeoutMs);
  
  py.stdin.write(inputPayload);
  py.stdin.end();
  
  py.stdout.on('data', (d) => agentOut += d.toString());
  py.stderr.on('data', (d) => {
    agentErr += d.toString();
    // Debug output is captured but not displayed in terminal
  });
  
  py.on('close', (code) => {
    clearTimeout(timer);
    console.log(`[ValidationAgent] ValidationAgent process completed with code: ${code}`);
    
    if (agentErr && agentErr.trim()) {
      console.error('[ValidationAgent][stderr]', agentErr);
    }
    
    if (agentOut && agentOut.trim()) {
      try {
        // Extract JSON from the end of the output
        const lines = agentOut.trim().split('\n');
        let jsonLine = '';
        
        // Look for the JSON response at the end of the output
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.includes('"validation_complete"')) {
            jsonLine = line;
            break;
          }
        }
        
        if (!jsonLine) {
          throw new Error('No valid JSON response found in validation agent output');
        }
        
        console.log(`[ValidationAgent] Extracted JSON: ${jsonLine.substring(0, 200)}...`);
        
        // Parse the validation result from ValidationAgent
        const result = JSON.parse(jsonLine);
        
        if (result.validation_complete) {
          console.log(`[ValidationAgent] Agent validated ${result.commands_validated} commands`);
          
          // Display validation results in terminal
          let validationMessage = `Command Validation Results:\n`;
          validationMessage += `Validated ${result.commands_validated} commands\n\n`;
          
          if (result.detailed_validation && result.detailed_validation.length > 0) {
            result.detailed_validation.forEach((validation, index) => {
              validationMessage += `${index + 1}. ${validation.command_checked}\n`;
              validationMessage += `   Result: ${validation.validation_result}\n\n`;
            });
          }
          
          if (result.validation_summary) {
            validationMessage += `Summary: ${result.validation_summary}\n`;
          }
          
          // Show validation results in terminal
          shell.executeCommand(aiTerminalId, validationMessage, false);
          
          // Post validation summary to chat
          if (result.validation_summary && result.validation_summary.trim()) {
            let chatMessage = `Validation completed for ${result.commands_validated} commands:\n\n`;
            chatMessage += result.validation_summary;
            
            create("text", `ValidationAgent-${provider}`, chatMessage);
            console.log(`[ValidationAgent] Posted validation results to chat from ${provider}`);
          }
        } else {
          if (result.error) {
            console.error(`[ValidationAgent] Error: ${result.error}`);
          }
        }
      } catch (parseErr) {
        console.error(`[ValidationAgent] Failed to parse validation agent output: ${parseErr.message}`);
      }
    }
  });
}

/**
 * Call ReactAgent for vulnerability analysis and command execution
 * @param {Object} aiData - AI analysis data with vulnerability info
 * @param {string} provider - AI provider name
 * @param {number} aiTerminalId - AI terminal ID for command execution
 */
function callReactAgent(aiData, provider, aiTerminalId) {
  const { spawn } = require('child_process');
  const path = require('path');
  const script = config.agent?.script || './commands/agent_react.py';
  const timeoutMs = config.agent?.timeoutMs || 60000;
  const pythonPath = config.agent?.pythonPath || 'python3';
  const maxCommands = config.agent?.maxCommands || 1;
  
  // Fix the script path - resolve relative to the api_server directory, not routes
  const scriptPath = path.resolve(__dirname, '..', script);
  
  // Prepare payload with vulnerability information for ReactAgent
  const inputPayload = JSON.stringify({
    lastOutput: "Recent vulnerability analysis detected: " + (aiData.vulnerability || "Unknown vulnerability"),
    env: { currenthost: "default" }, // We don't have access to shell env here, use default
    maxCommands: maxCommands,
    vulnerabilityInfo: {
      severity: aiData.severity,
      description: aiData.vulnerability,
      provider: provider,
      suggestedCommands: aiData.commands || []
    }
  });
  
  console.log(`[Agent] Spawning ReactAgent: ${pythonPath} ${scriptPath} with timeout ${timeoutMs}ms`);
  const py = spawn(pythonPath, [scriptPath], { 
    cwd: path.resolve(__dirname, '..'), 
    env: process.env 
  });
  
  let agentOut = '';
  let agentErr = '';
  const timer = setTimeout(() => {
    console.log(`[Agent] Timeout after ${timeoutMs}ms, killing process...`);
    try { py.kill('SIGKILL'); } catch(e){}
  }, timeoutMs);
  
  py.stdin.write(inputPayload);
  py.stdin.end();
  
  py.stdout.on('data', (d) => agentOut += d.toString());
  py.stderr.on('data', (d) => {
    agentErr += d.toString();
    // Debug output is captured but not displayed in terminal
  });
  
  py.on('close', (code) => {
    clearTimeout(timer);
    console.log(`[Agent] ReactAgent process completed with code: ${code}`);
    
    if (agentErr && agentErr.trim()) {
      console.error('[Agent][stderr]', agentErr);
    }
    
    if (agentOut && agentOut.trim()) {
      try {
        // Extract JSON from the end of the output (after all the LangChain verbose output)
        const lines = agentOut.trim().split('\n');
        let jsonLine = '';
        
        // Look for the JSON response at the end of the output
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.includes('"execution_complete"')) {
            jsonLine = line;
            break;
          }
        }
        
        if (!jsonLine) {
          throw new Error('No valid JSON response found in agent output');
        }
        
        console.log(`[Agent] Extracted JSON: ${jsonLine.substring(0, 200)}...`);
        
        // Parse the comprehensive result from ReactAgent
        const result = JSON.parse(jsonLine);
        
        if (result.execution_complete) {
          console.log(`[Agent] Agent executed ${result.commands_executed} commands`);
          console.log(`[Agent] Exploitation successful: ${result.exploitation_successful}`);
          
          // Display actual commands and their complete results in terminal
          if (result.detailed_results && result.detailed_results.length > 0) {
            result.detailed_results.forEach((cmdResult, index) => {
              // Show the command as it would appear in a real terminal
              shell.executeCommand(aiTerminalId, `${cmdResult.command}\n`, false);
              // Show the complete output without formatting
              if (cmdResult.output && cmdResult.output.trim()) {
                shell.executeCommand(aiTerminalId, `${cmdResult.output}\n`, false);
              }
            });
          }
          
          // Post detailed summary to chat about what agent did and found
          if (result.final_analysis && result.final_analysis.trim()) {
            let detailedMessage = `Agent executed ${result.commands_executed} command(s):\n\n`;
            
            // Add executed commands to the message
            if (result.detailed_results && result.detailed_results.length > 0) {
              result.detailed_results.forEach((cmdResult, index) => {
                detailedMessage += `${index + 1}. ${cmdResult.command}\n`;
              });
              detailedMessage += `\nFindings: ${result.final_analysis}`;
            } else {
              detailedMessage += `Commands: (details not available)\nFindings: ${result.final_analysis}`;
            }
            
            create("text", `ReactAgent-${provider}`, detailedMessage);
            console.log(`[Agent] Posted detailed findings to chat from ${provider}`);
          }
        } else {
          if (result.error) {
            console.error(`[Agent] Error: ${result.error}`);
          }
        }
      } catch (parseErr) {
        console.error(`[Agent] Failed to parse agent output: ${parseErr.message}`);
      }
    }
  });
}

function createCommandsFromAI(aiData, provider) {
  // Create chat message for HIGH/CRITICAL vulnerability information
  if (aiData && aiData.vulnerability && aiData.severity) {
    const message = `${aiData.severity.toUpperCase()} VULNERABILITY: ${aiData.vulnerability}`;
    create("text", provider, message);
    console.log(`[Chats] Added ${aiData.severity} vulnerability info to chat from ${provider}`);
    
    // If HIGH/CRITICAL vulnerability detected, trigger validation and optionally ReactAgent
    if (['HIGH', 'CRITICAL'].includes(aiData.severity?.toUpperCase()) && config.agent?.enabled) {
      console.log('[Agent] HIGH/CRITICAL vulnerability detected, triggering validation...');
      
      // Create AI terminal for command validation/execution
      const aiTerminalId = getOrCreateAITerminal();
      console.log(`[Agent] Created/found AI terminal: ${aiTerminalId}`);
      
      // Ensure shell exists for the AI terminal
      shell.create(aiTerminalId);
      
      // First run validation agent to check if suggested commands are valid
      callValidationAgent(aiData, provider, aiTerminalId);
      
      // Optionally still run ReactAgent if configured (you can disable this by setting config.agent.useReactAgent to false)
      if (config.agent?.useReactAgent !== false) {
        console.log('[Agent] Also triggering ReactAgent for exploitation...');
        // Add a small delay to let validation complete first
        setTimeout(() => {
          callReactAgent(aiData, provider, aiTerminalId);
        }, 2000);
      }
    }
  }

  // Create candidate commands for exploitation commands
  if (!aiData || !aiData.commands || aiData.commands.length === 0) {
    console.log(`[Chats] No exploitation commands to create from ${provider}`);
    return;
  }

  aiData.commands.forEach((cmdData, index) => {
    if (!cmdData.command || !cmdData.explanation) {
      console.log(`[Chats] Skipping invalid command data from ${provider}`);
      return;
    }

    const commandConfig = {
      name: `Exploit (${provider.toUpperCase()}) ${index + 1}: ${cmdData.explanation.substring(0, 50)}${cmdData.explanation.length > 50 ? '...' : ''}`,
      template: cmdData.command,
      pattern: ".*", // Match any command input for exploitation
      group: provider,
      output: { script: "" }
    };
    
    try {
      const newCommand = commands.add(commandConfig);
      console.log(`[Chats] Added AI command from ${provider}: ${cmdData.command}`);
    } catch (error) {
      console.error(`[Chats] Failed to add AI suggested command: ${error.message}`);
    }
  });
}

async function analyzeWithOpenAI(topic) {
  const apiKey = process.env.OPENAI_API_KEY || config.openai?.apiKey;
  if (!apiKey) return "";
  const client = new OpenAIClient({ apiKey });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyze the following attacking command output and find HIGH or CRITICAL security vulnerabilities that can be exploited.
    
    If you find a Critical or High vulnerability, provide up to 1 exploitation commands that directly target the vulnerability.

    When reporting, output ONLY this JSON (no extra text):
    {
      "severity": "HIGH" | "CRITICAL",
      "vulnerability": "short description & impact tied to the target",
      "commands": [
        {"command": "...", "explanation": "what is this command"},
        {"command": "...", "explanation": "..."}
      ]
    }

    Console output to analyze:\n\n${topic}` }
  ];
  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || config.openai?.model || "gpt-4o-mini",
      messages,
//      max_tokens: 3000, // Increased for complete JSON response
//      temperature: 0.3, // Lower temperature for more consistent JSON
    });
    const content = resp.choices?.[0]?.message?.content || "";
    if (content) {
      // Parse the AI response and create commands
      const aiData = parseAIResponse(content, "openai");
      if (aiData) {
        createCommandsFromAI(aiData, "open-AI");
      }
    }
    return content ? `[openai] ${content}` : "";
  } catch (error) {
    const msg = `OpenAI error: ${error}`;
    return msg;
  }
}

async function analyzeWithLocal(topic) {
  const baseURL = process.env.LOCAL_LLM_BASEURL || config.localAI?.baseUrl;
  if (!baseURL) return "";
  const apiKey = process.env.OPENAI_API_KEY || 'sk-local';
  const client = new OpenAIClient({ apiKey, baseURL });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyze the following attacking command output and find HIGH or CRITICAL security vulnerabilities that can be exploited.
    
    If you find a Critical or High vulnerability, provide up to 2 exploitation commands that directly target the vulnerability.

    When reporting, output ONLY this JSON (no extra text):
    {
      "severity": "HIGH" | "CRITICAL",
      "vulnerability": "short description & impact tied to the target",
      "commands": [
        {"command": "...", "explanation": "what is this command"},
        {"command": "...", "explanation": "..."}
      ]
    }

    Console output to analyze:\n\n${topic}` }
  ];
  try {
    const resp = await client.chat.completions.create({
      model: process.env.LOCAL_LLM_MODEL || config.localAI?.model || 'auto',
      messages,
      max_tokens: 3000, // Increased for complete JSON response
      temperature: 0.3, // Lower temperature for more consistent JSON
    });
    const content = resp.choices?.[0]?.message?.content || "";
    console.log(`[Debug] Local AI raw response: ${content ? content.substring(0, 300) : 'empty'}...`);
    if (content) {
      // Parse the AI response and create commands
      const aiData = parseAIResponse(content, "local");
      console.log(`[Debug] Local AI parsed data:`, aiData ? 'Valid JSON found' : 'No valid data');
      if (aiData) {
        createCommandsFromAI(aiData, "Local-AI");
      }
    }
    return content ? `[local] ${content}` : "";
  } catch (error) {
    const msg = `Local LLM error: ${error}`;
    return msg;
  }
}

async function analyzeWithGemini(topic) {
  const key = process.env.GEMINI_API_KEY || config.gemini?.apiKey;
  let model = process.env.GEMINI_MODEL || config.gemini?.model || 'gemini-1.5-flash';
  if (!key) return "";
  const userPrompt = `Analyze the following console output for HIGH or CRITICAL security vulnerabilities that can be exploited.\n\nHIGH/CRITICAL vulnerabilities include:\n- Remote code execution opportunities\n- Authentication bypasses\n- Privilege escalation paths\n- SQL injection vulnerabilities\n- Exposed sensitive services (FTP with anonymous access, unprotected databases, etc.)\n- Default credentials on critical services\n- Buffer overflow possibilities\n- Directory traversal vulnerabilities\n\nOnly respond if you find serious vulnerabilities that require immediate exploitation attempts. Console output to analyze:\n\n${topic}`;
  
  const body = {
    contents: [
      { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }] }
    ]
  };
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const resp = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        timeout: 15000,
      });
      const parts = resp.data?.candidates?.[0]?.content?.parts || [];
      const content = parts.map(p => p.text || "").join("") || "";
      if (content) {
        // Parse the AI response and create commands
        const aiData = parseAIResponse(content, "Gemini-AI");
        if (aiData) {
          createCommandsFromAI(aiData, "Gemini-AI");
        }
      }
      return content ? `[gemini] ${content}` : "";
    } catch (error) {
      const status = error?.response?.status;
      const retriable = status >= 500 || status === 429 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET';
      // on first failure, try the '-latest' alias once
      if (attempt === 0 && !model.endsWith('-latest')) {
        model = `${model}-latest`;
      } else if (!retriable) {
        const msg = `Gemini error: ${error}`;
        return msg;
      }
      attempt++;
      if (attempt >= maxRetries) {
        const msg = `Gemini error: ${error}`;
        return msg;
      }
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  return "";
}

function providerEnabled(name) {
  if (name === 'openai') return (process.env.ENABLE_OPENAI?.toLowerCase() === 'true') || (config.openai?.enabled ?? true);
  if (name === 'local')  return (process.env.ENABLE_LOCAL?.toLowerCase() === 'true')  || (config.localAI?.enabled ?? !!(process.env.LOCAL_LLM_BASEURL || config.localAI?.baseUrl));
  if (name === 'gemini') return (process.env.ENABLE_GEMINI?.toLowerCase() === 'true') || (config.gemini?.enabled ?? false);
  return false;
}

function analysis(scanresult, isRequestedAnalysis = false) {
  if (!(config.AIAnalysis || isRequestedAnalysis)) {
    return Promise.resolve("");
  }
  if (!scanresult) return Promise.resolve("");
  const tasks = [];
  if (providerEnabled('openai')) tasks.push(analyzeWithOpenAI(scanresult));
  if (providerEnabled('local'))  tasks.push(analyzeWithLocal(scanresult));
  if (providerEnabled('gemini')) tasks.push(analyzeWithGemini(scanresult));
  if (tasks.length === 0) return Promise.resolve("");
  return Promise.allSettled(tasks).then(results => {
    const texts = results.filter(r => r.status === 'fulfilled').map(r => r.value).filter(Boolean);
    return texts.join("\n");
  });
}

function store() {
  const chatsJson = JSON.stringify(_chats);
  fs.writeFileSync(SAVE_FILE, chatsJson);
}

/**
 * Chats creation
 * @param {string} name
 * @returns {Object}
 */
function create(type, author, data) {
  let logid;
  if (_chats.length === 0){
    logid = 0;
  } else{
    logid = _chats[_chats.length -1].chatId + 1;
  }
  const chat = new Chats(logid, type, author, data);
  _chats.push(chat);
  store();
  notify();
  return chat;
}

/**
 * Load chats data
 */
 async function setup() {
  if (!fs.existsSync(SAVE_FILE)) {
    return;
  }
  const chatsJson = fs.readFileSync(SAVE_FILE);
  if (!chatsJson) {
    return;
  }
  _chats = JSON.parse(chatsJson);
}

function getChats() {
  return _chats[_chats.length -1];
}

function getAllChats() {
  return _chats;
}

/**
 * Notify chats update
 */
 function notify() {
  const message = JSON.stringify({ type: 'chats' });
  notifier.send(message);
}

function router() {
  const router = express.Router();

  /**
  * REST API routing
  * GET - list chats
  */
  router.get('/', function (req, res, next) {
    const chats = getChats();
    res.send(JSON.stringify(chats));
  });

  router.get('/getall', function (req, res, next) {
    const chats = getAllChats();
    res.send(JSON.stringify(chats));
  });

    /**
   * REST API routing
   * POST - send a message
   */
    router.post('/', function (req, res, next) {
//      console.log("req.body.message=", req.body.message);
      if (req.body.message.data === 'OFF'){
        config.AIAnalysis = false;
      }else if (req.body.message.data === 'ON'){
        config.AIAnalysis = true;
      }
      if (_chats.length === 0){
        create(req.body.message.type, req.body.message.author, req.body.message.data);
      }else{
        create(req.body.message.type, req.body.message.author, req.body.message.data);
      }
      if (req.body.message.data.substring(0,3) == "@AI"){
        analysis(req.body.message.data.substring(3), true);
      }
   });

  /**
  * REST API routing
  * Routing to shell
  */
 //   shell.route(router);

  return router;
}

module.exports.router = router;
module.exports.create = create;
module.exports.analysis = analysis;
module.exports.setup = setup;

