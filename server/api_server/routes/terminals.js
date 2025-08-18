const express = require('express');
const fs = require('fs');
const shell = require('routes/shell');
const notifier = require('routes/notifier');

/**
 * @type {string}
 */
const SAVE_FILE = './data/terminals.json';

/**
 * @type {Array<Object>}
 */
let _terminals = [];

/**
 * @type {number}
 */
let _terminalId = 0;

/**
 * Terminal class
 */
class Terminal {
  /**
   * Constructor
   * @param {string} name
   */
  constructor(name, id = null) {
    if (id === null) {
      this.id = ++_terminalId;
    } else {
      this.id = id;
    }

    if (!name){
      name = "Term" + this.id;
      while(_terminals.some((t) => t.name === name)) name = name + '_';
    }
    this.name = name;
    this.hidden = false;
    console.log(`[Terminal] created ${this.id} "${this.name}"`);
  }

  /**
   * Get terminal information
   * @returns {object}
   */
  info() {
    return { id: this.id, name: this.name };
  }
}

/**
 * Load terminals data
 */
async function setup() {
  await shell.setup();
  if (!fs.existsSync(SAVE_FILE)) {
    return;
  }
  const terminalsJson = fs.readFileSync(SAVE_FILE);
  if (!terminalsJson) {
    return;
  }
  const terminals = JSON.parse(terminalsJson);
  for (const terminal of terminals) {
    if (terminal.id > _terminalId) _terminalId = terminal.id;
    create(terminal.name, terminal.id);
  }
}


function setCommandname(terminalId, commandname){
  _terminals.forEach(function(elem, index) {
      if (elem.id ==terminalId){
        elem.currentcommand = commandname;
      }
  });
//  notify();
  store();
  return;
}

function getCommandname(terminalId){
  return _terminals.filter(x => x.id === terminalId)[0].currentcommand;
}


/**
 * Save terminals data
 */
function store() {
  const terminalsJson = JSON.stringify(_terminals);
  fs.writeFileSync(SAVE_FILE, terminalsJson);
}

/**
 * Terminal creation
 * @param {string} name
 * @returns {Object}
 */
function create(name, id = null) {
  const isNameExisted = _terminals.some((t) => t.name === name);
  if (isNameExisted){
    console.log("[Terminal] Terminal name duplicated");
    return false;
  }else{
    const terminal = new Terminal(name, id);
    if(terminal.id==undefined){
      return false;
    }
    _terminals.push(terminal);
    shell.create(terminal.id);
    store();
    notify();
    return terminal;
  }
}

/**
 * Terminal deletion
 * @param {number} terminalId
 */
function destroy(terminalId) {
  const terminals = _terminals.filter(terminal => terminal.id == terminalId);
  _terminals = _terminals.filter(terminal => terminal.id != terminalId);
  store();
  terminals.forEach(terminal => {
    shell.destroy(terminal.id);
    console.log(`[Terminal] deleted ${terminal.id} "${terminal.name}"`);
  });
  notify();
}


/**
 * Terminal hide
 * @param {number} terminalId
 */
 function hide(terminalId) {
  _terminals.forEach(function(elem, index) {
    if (elem.id ==terminalId){
      elem.hidden = true;
      notify();
    }
  });
}

function changeTerminalName(terminalId, name){
  const isNameExisted = _terminals.some((t) => t.name === name);
  if (isNameExisted){
    console.log("[Terminal] Terminal name duplicated");
    return false;
  }else{
    _terminals.forEach(function(elem, index) {
      if (elem.id ==terminalId){
        elem.name = name;
        notify();
      }
    });
  }
}

function resizeTerminal(terminalId, cols, rows){
  return shell.resizeTerminal(terminalId, cols, rows);
}

/**
 * Notify terminals update
 */
function notify() {
  const message = JSON.stringify({ type: 'terminals' });
  notifier.send(message);
}

function router() {
  const router = express.Router();

  /**
   * REST API routing
   * GET - list terminals
  */
  router.get('/', function (req, res, next) {
    console.log(`[Terminal] GET all from ${req.hostname}`);
    res.send(JSON.stringify(_terminals));
  });

  /**
   * REST API routing
   * POST - create a terminal
   */
  router.post('/', function (req, res, next) {
      console.log(`[Terminal] POST "${req.body.name}" from ${req.hostname}`);
      const terminal = create(req.body.name);
      res.send(JSON.stringify(terminal));
  });

  /**
   * REST API routing
   * POST - change a terminal name
   */
  router.post('/changeterminalname/:terminalId/:name', function (req, res, next) {
    const terminal = changeTerminalName(req.params.terminalId, req.params.name);
    res.send(JSON.stringify(terminal));
  });

  /**
   * REST API routing
   * POST - resize a terminal
   */
  router.post('/resizeterminal', function (req, res, next) {
//    console.log("resizeTerminal, terminalId="+req.body.terminalId+ " cols="+req.body.cols);
    const terminal = resizeTerminal(req.body.terminalId, req.body.cols, req.body.rows);
    res.send(JSON.stringify(terminal));
  });

  /**
   * REST API routing
   * DELETE - delete a terminal
   */
  router.delete('/:terminalId', function (req, res, next) {
    console.log(`[Terminal] DELETE ${req.params.terminalId} from ${req.hostname}`);
  //  destroy(req.params.terminalId);
    hide(req.params.terminalId);
    res.send('{}');
  });

  /**
   * REST API routing
   * Routing to shell
   */
  shell.route(router);

  return router;
}

/**
 * Get all terminals
 * @returns {Array<Object>} Array of all terminals
 */
function getAll() {
  return _terminals;
}

module.exports.setup = setup;
module.exports.create = create;
module.exports.getAll = getAll;
module.exports.setCommandname = setCommandname;
module.exports.getCommandname = getCommandname;
module.exports.router = router;
