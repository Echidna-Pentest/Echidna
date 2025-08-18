const express = require('express');
const fs = require('fs');
const notifier = require('routes/notifier');
const axios = require('axios');
const config = require('../echidna.json');
const { Configuration, OpenAIApi } = require("openai");
const OpenAIClient = require('openai'); 
const commands = require('routes/commands');

/**
* @type {string}
*/
const SAVE_FILE = './data/chats.json';

/**
* @type {Array<Object>}
*/
let _chats = [];

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
  try {
    // Try to extract JSON from the response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, check for NONE response
      if (content.trim().toUpperCase() === 'NONE') {
        console.log(`[Chats] ${provider}: No HIGH/CRITICAL vulnerabilities found - skipping`);
        return null; // No commands to create
      }
      throw new Error('No valid JSON found in response');
    }

    const jsonData = JSON.parse(jsonMatch[0]);
    
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
    return null;
  }
}

function createCommandsFromAI(aiData, provider) {
  // Create chat message for HIGH/CRITICAL vulnerability information
  if (aiData && aiData.vulnerability && aiData.severity) {
    const message = `${aiData.severity.toUpperCase()} VULNERABILITY: ${aiData.vulnerability}`;
    create("text", provider, message);
    console.log(`[Chats] Added ${aiData.severity} vulnerability info to chat from ${provider}`);
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
  const apiKey = process.env.OPENAI_API_KEY || config.apiKey;
  if (!apiKey) return "";
  const client = new OpenAIClient({ apiKey });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyze the following console output for HIGH or CRITICAL security vulnerabilities that can be exploited.\n\nHIGH/CRITICAL vulnerabilities include:\n- Remote code execution opportunities\n- Authentication bypasses\n- Privilege escalation paths\n- SQL injection vulnerabilities\n- Exposed sensitive services (FTP with anonymous access, unprotected databases, etc.)\n- Default credentials on critical services\n- Buffer overflow possibilities\n- Directory traversal vulnerabilities\n\nOnly respond if you find serious vulnerabilities that require immediate exploitation attempts. Console output to analyze:\n\n${topic}` }
  ];
  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || config.openaiModel || config.model || "gpt-4o-mini",
      messages,
      max_tokens: 500, // Increased for JSON response
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
  const baseURL = process.env.LOCAL_LLM_BASEURL || config.localBaseUrl;
  if (!baseURL) return "";
  const apiKey = process.env.OPENAI_API_KEY || 'sk-local';
  const client = new OpenAIClient({ apiKey, baseURL });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Analyze the following console output for HIGH or CRITICAL security vulnerabilities that can be exploited.\n\nHIGH/CRITICAL vulnerabilities include:\n- Remote code execution opportunities\n- Authentication bypasses\n- Privilege escalation paths\n- SQL injection vulnerabilities\n- Exposed sensitive services (FTP with anonymous access, unprotected databases, etc.)\n- Default credentials on critical services\n- Buffer overflow possibilities\n- Directory traversal vulnerabilities\n\nOnly respond if you find serious vulnerabilities that require immediate exploitation attempts. Console output to analyze:\n\n${topic}` }
  ];
  try {
    const resp = await client.chat.completions.create({
      model: process.env.LOCAL_LLM_MODEL || config.localModel || 'auto',
      messages,
      max_tokens: 500, // Increased for JSON response
      temperature: 0.3, // Lower temperature for more consistent JSON
    });
    const content = resp.choices?.[0]?.message?.content || "";
    if (content) {
      // Parse the AI response and create commands
      const aiData = parseAIResponse(content, "local");
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
  const key = process.env.GEMINI_API_KEY || config.geminiApiKey;
  let model = process.env.GEMINI_MODEL || config.geminiModel || 'gemini-1.5-flash';
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
  if (name === 'openai') return (process.env.ENABLE_OPENAI?.toLowerCase() === 'true') || (config.openaiEnabled ?? true);
  if (name === 'local')  return (process.env.ENABLE_LOCAL?.toLowerCase() === 'true')  || (config.localEnabled ?? !!(process.env.LOCAL_LLM_BASEURL || config.localBaseUrl));
  if (name === 'gemini') return (process.env.ENABLE_GEMINI?.toLowerCase() === 'true') || (config.geminiEnabled ?? false);
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

