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

// Enhanced system prompt for structured command suggestions
const SYSTEM_PROMPT = "You are a penetration test assistant. Analyze the provided console output and suggest up to 3 relevant commands that might be used to exploit the vulnerabilities or weaknesses discovered. If no vulnerabilities are found or no action is required, simply respond with 'NONE'. Return the result as a JSON object with two keys: 'commands' and 'vulnerability'. The 'commands' key should contain an array of commands, where each entry contains the command as a string and a brief explanation as another string, like this:\n{\n  \"commands\": [\n    {\n      \"command\": \"example command\",\n      \"explanation\": \"brief explanation\"\n    },\n    ...\n  ],\n  \"vulnerability\": \"Brief description of the most concerning vulnerability\"\n}\nIf no commands are applicable, return an empty array for 'commands'.";

// postChat function removed - AI analysis results are handled via CandidateCommands only

function parseAIResponse(content, provider) {
  try {
    // Try to extract JSON from the response
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, check for NONE response
      if (content.trim().toUpperCase() === 'NONE') {
        return null; // No commands to create
      }
      throw new Error('No valid JSON found in response');
    }

    const jsonData = JSON.parse(jsonMatch[0]);
    
    if (!jsonData.commands || !Array.isArray(jsonData.commands)) {
      console.log(`[Chats] No valid commands array found in ${provider} response`);
      return null;
    }

    return jsonData;
  } catch (error) {
    console.error(`[Chats] Failed to parse ${provider} response as JSON:`, error.message);
    return null;
  }
}

function createCommandsFromAI(aiData, provider) {
  if (!aiData || !aiData.commands || aiData.commands.length === 0) {
    return;
  }

  aiData.commands.forEach((cmdData, index) => {
    if (!cmdData.command || !cmdData.explanation) {
      console.log(`[Chats] Skipping invalid command data from ${provider}`);
      return;
    }

    const commandConfig = {
      name: `AI Suggested (${provider.toUpperCase()}) ${index + 1}: ${cmdData.explanation.substring(0, 50)}${cmdData.explanation.length > 50 ? '...' : ''}`,
      template: cmdData.command,
      pattern: ".*", // Match any command input for AI suggestions
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

  // Commands and vulnerabilities are handled via CandidateCommands interface only
}

async function analyzeWithOpenAI(topic) {
  const apiKey = process.env.OPENAI_API_KEY || config.apiKey;
  if (!apiKey) return "";
  const client = new OpenAIClient({ apiKey });
  const messages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" },
    { role: "user", content: topic }
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
        createCommandsFromAI(aiData, "OPENAI");
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
    { role: "system", content: SYSTEM_PROMPT + "\n" },
    { role: "user", content: topic }
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
        createCommandsFromAI(aiData, "LocalAI");
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
  const body = {
    contents: [
      { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\n${topic}` }] }
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
        const aiData = parseAIResponse(content, "gemini");
        if (aiData) {
          createCommandsFromAI(aiData, "GEMINI");
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

