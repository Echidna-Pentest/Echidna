const express = require('express');
const fs = require('fs');
const notifier = require('routes/notifier');
const axios = require('axios');
const config = require('../echidna.json');
const { Configuration, OpenAIApi } = require("openai");

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

function analysis(scanresult, isRequestedAnalysis = false){
  if (config.AIAnalysis || isRequestedAnalysis){
    if (scanresult!=null && scanresult != ''){
      async function checkApiKey() {
        try {
          const response = await axios.get("https://api.openai.com/v1/engines", {
            headers: {
              "Authorization": `Bearer ${config.apiKey}`
            }
          });
          return true;
        } catch (error) {
          console.error("Error checking API key:", error.message);
          return false;
        }finally {
          console.log("check API Key done");
//          return false;
        }
      }


      async function getAiResponse(topic) {
        const configuration = new Configuration({
          apiKey: config.apiKey,
        });
        const openai = new OpenAIApi(configuration);
        if (await checkApiKey()==false){
          return;
        };
        const completion = await openai.createCompletion({
          model: "text-davinci-003",
  //        model: "text-ada-001",
          prompt: topic,
          max_tokens: 700,
          n: 1,
          temperature: 0
        });
//        console.log("AIAnalysis result=", completion.data.choices[0].text);
          create("text", "chatbot", completion.data.choices[0].text);
      }
      try {
//        getAiResponse("Please analyze the text below and let me know if you find something vulnerable. If not, please response with \"No\" \n"+scanresult);
        getAiResponse("Please analyze the scan result below and let me know if you find something vulnerable. \n"+scanresult);
      }catch (err) {
        console.log(err.name + ': ' + err.message);
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

