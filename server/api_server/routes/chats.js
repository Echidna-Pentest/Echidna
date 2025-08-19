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
const SYSTEM_PROMPT = "You are a penetration test assistant. Your role is to analyze security findings and identify vulnerabilities that require immediate exploitation.\n\nResponse Format Rules:\n- ONLY respond when you find HIGH or CRITICAL severity vulnerabilities\n- For low-risk findings, informational output, or normal system behavior, respond with 'NONE'\n- When HIGH/CRITICAL vulnerability is found, respond in JSON format:\n\n{\n  \"severity\": \"HIGH\" or \"CRITICAL\",\n  \"vulnerability\": \"Clear description of the vulnerability and its impact\",\n  \"commands\": [\n    {\n      \"command\": \"specific exploitation command\",\n      \"explanation\": \"what this command exploits and expected outcome\"\n    }\n  ]\n}\n\nProvide exactly 3 exploitation commands that directly target the vulnerability.";

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
  
  // Fix the script path - resolve relative to the api_server directory, not routes
  const scriptPath = path.resolve(__dirname, '..', script);
  
  // Prepare payload with vulnerability information for ReactAgent
  const inputPayload = JSON.stringify({
    lastOutput: "Recent vulnerability analysis detected: " + (aiData.vulnerability || "Unknown vulnerability"),
    env: { currenthost: "default" }, // We don't have access to shell env here, use default
    maxCommands: config.agent?.maxCommands || 1,
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
    shell.executeCommand(aiTerminalId, `echo "[Agent] Analysis timed out, executing direct exploitation..."\n`, false);
    
    // Use the first suggested command from the AI analysis as fallback
    if (aiData.commands && aiData.commands.length > 0) {
      const exploitCmd = aiData.commands[0].command;
      shell.executeCommand(aiTerminalId, `echo "[Agent] Executing AI-suggested command: ${exploitCmd}"\n`, false);
      shell.executeCommand(aiTerminalId, `${exploitCmd}\n`, false);
    } else {
      shell.executeCommand(aiTerminalId, `echo "[Agent] No AI commands available, using basic reconnaissance..."\n`, false);
      shell.executeCommand(aiTerminalId, `whoami\n`, false);
    }
    
    try { py.kill('SIGKILL'); } catch(e){}
  }, timeoutMs);
  
  py.stdin.write(inputPayload);
  py.stdin.end();
  
  py.stdout.on('data', (d) => agentOut += d.toString());
  py.stderr.on('data', (d) => {
    agentErr += d.toString();
    // Show agent progress in AI terminal using echo commands
    if (d.toString().includes('DEBUG:')) {
      const debugLines = d.toString().trim().split('\n');
      debugLines.forEach(line => {
        if (line.includes('LLM client created') || line.includes('Creating ReAct agent') || line.includes('Tools created')) {
          const cleanMsg = line.replace(/.*DEBUG:\s*/, '').replace(/['"]/g, '\\"').replace(/\s+/g, ' ').trim();
          if (cleanMsg) {
            shell.executeCommand(aiTerminalId, `echo "[Agent] ${cleanMsg}"\n`, false);
          }
        }
      });
    }
  });
  
  py.on('close', (code) => {
    clearTimeout(timer);
    console.log(`[Agent] ReactAgent process closed with code: ${code}`);
    console.log(`[Agent] Output length: ${agentOut.length}, Error length: ${agentErr.length}`);
    
    // Update AI terminal with agent completion status
    if (code === 0) {
      shell.executeCommand(aiTerminalId, `echo "[Agent] Analysis completed successfully (exit code: ${code})"\n`, false);
    } else {
      shell.executeCommand(aiTerminalId, `echo "[Agent] Analysis failed (exit code: ${code})"\n`, false);
    }
    
    if (agentErr && agentErr.trim()) {
      console.error('[Agent][stderr]', agentErr);
    }
    
    if (agentOut && agentOut.trim()) {
      console.log(`[Agent] Raw output: ${agentOut.substring(0, 200)}...`);
      try {
        // Try to parse JSON response from ReactAgent
        const result = JSON.parse(agentOut.trim());
        const cmd = result.next_command;
        const reason = result.reason || 'ReactAgent suggestion';
        
        if (cmd && result.allowed && cmd.length < 4096) {
          console.log(`[Agent] Executing ReactAgent command: ${cmd}`);
          shell.executeCommand(aiTerminalId, `echo "[Agent] ${reason}: ${cmd}"\n`, false);
          shell.executeCommand(aiTerminalId, cmd + "\n", false);
        }
      } catch (parseErr) {
        // Fallback: treat first line as command (backward compatibility)
        const cmd = agentOut.split(/\r?\n/)[0].trim();
        if (cmd && cmd.length < 4096) {
          console.log(`[Agent] Executing ReactAgent fallback command: ${cmd}`);
          shell.executeCommand(aiTerminalId, `echo "[Agent] executing: ${cmd}"\n`, false);
          shell.executeCommand(aiTerminalId, cmd + "\n", false);
        }
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
    
    // If CRITICAL vulnerability detected, trigger ReactAgent immediately
    if (['HIGH', 'CRITICAL'].includes(aiData.severity?.toUpperCase()) && config.agent?.enabled) {
      console.log('[Agent] HIGH/CRITICAL vulnerability detected, triggering ReactAgent...');
      
      // Create AI terminal for command execution
      const aiTerminalId = getOrCreateAITerminal();
      console.log(`[Agent] Created/found AI terminal: ${aiTerminalId}`);
      
      // Ensure shell exists for the AI terminal
      shell.create(aiTerminalId);
      
      // Display initial message
      shell.executeCommand(aiTerminalId, 'echo "[Agent] Starting analysis of CRITICAL vulnerability..."\n', false);
      
      // Call ReactAgent with vulnerability information
      callReactAgent(aiData, provider, aiTerminalId);
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
    { role: "user", content: `Analyze the following console output for HIGH or CRITICAL security vulnerabilities that can be exploited.\n\nHIGH/CRITICAL vulnerabilities include:\n- Remote code execution opportunities\n- Authentication bypasses\n- Privilege escalation paths\n- SQL injection vulnerabilities\n- Exposed sensitive services (FTP with anonymous access, unprotected databases, etc.)\n- Default credentials on critical services\n- Buffer overflow possibilities\n- Directory traversal vulnerabilities\n\nOnly respond if you find serious vulnerabilities that require immediate exploitation attempts. Console output to analyze:\n\n${topic}` }
  ];
  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || config.openai?.model || "gpt-4o-mini",
      messages,
      max_tokens: 3000, // Increased for complete JSON response
      temperature: 0.3, // Lower temperature for more consistent JSON
    });
    const content = resp.choices?.[0]?.message?.content || "";
    if (content) {
      // Parse the AI response and create commands
      const aiData = parseAIResponse(content, "openai");
      if (aiData) {
        createCommandsFromAI(aiData, "openai");
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
    { role: "user", content: `Analyze the following console output for HIGH or CRITICAL security vulnerabilities that can be exploited.\n\nHIGH/CRITICAL vulnerabilities include:\n- Remote code execution opportunities\n- Authentication bypasses\n- Privilege escalation paths\n- SQL injection vulnerabilities\n- Exposed sensitive services (FTP with anonymous access, unprotected databases, etc.)\n- Default credentials on critical services\n- Buffer overflow possibilities\n- Directory traversal vulnerabilities\n\nOnly respond if you find serious vulnerabilities that require immediate exploitation attempts. Console output to analyze:\n\n${topic}` }
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

