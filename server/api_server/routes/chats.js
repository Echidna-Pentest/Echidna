const express = require('express');
const fs = require('fs');
const notifier = require('routes/notifier');
const axios = require('axios');
const config = require('../echidna.json');
const { Configuration, OpenAIApi } = require("openai");
const OpenAIClient = require('openai'); 

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

async function checkApiKey() {
  try {
    const response = await axios.get("https://api.openai.com/v1/engines", {
      headers: {
        "Authorization": `Bearer ${config.apiKey}`
      }
    });
    return true; // You might want to add further checks on the 'response'.
  } catch (error) {
    console.error("Error checking API key:", error.message);
    return false;
  }
}

async function getAiResponse(topic) {
  if (!await checkApiKey()) {
    console.error("Invalid API Key");
    create("text", "chatbot", "Invalid API Key");
    return;
  }

  const openai = new OpenAIClient({ apiKey: config.apiKey });

  const messages = [
    { role: "system", content: "You are a penetration test assistant. Please find the vulnerability or exploit code or attack vector\n" },
    { role: "user", content: topic }
  ];

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 250,
      temperature: 0.5,
    });

    create("text", "chatbot", chatCompletion.choices[0].message.content);
  } catch (error) {
    create("text", "chatbot", "Error during AI response retrieval:" + error);
    console.error("Error during AI response retrieval:", error);
  }
}

function analysis(scanresult, isRequestedAnalysis = false) {
  if (config.AIAnalysis || isRequestedAnalysis) {
    if (scanresult != null && scanresult != '') {
      try {
        getAiResponse(scanresult);
      } catch (err) {
        console.error(err.name + ': ' + err.message);
      }
    }
  }
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

