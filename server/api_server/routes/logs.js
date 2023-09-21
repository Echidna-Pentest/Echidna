const fs = require('fs');
const notifier = require('routes/notifier');
const child_process = require('child_process');
const path = require('path');
/**
 * @type {string}
 */
//const SAVE_FILE = './data/logs.json';
const LOGS_DIRECTORY = './data/logs';

/**
 * @type {object}
 */
const _logs = {}

/**
 * @type {number}
 */
let _logId = 0;

/**
 *  Log data class
 */
class Log {
  /**
   * Constructor
   * @param {number} execId
   * @param {number} seqId
   * @param {string} command
   * @param {number} status
   * @param {string} output
   */
  constructor(logId, execId, seqId, command, status, output, date) {
    this.id = logId;
    this.execId = execId;
    this.seqId = seqId;
    this.command = command;
    this.status = status;
    this.output = output;
    this.date = date;
  }

  /**
   * Get log information
   * @returns {object} log data
   */
  info() {
    return { id: this.id, execId: this.execId, seqId: this.seqId, command: this.command, status: this.status, output: this.output };
  }
}

/**
 * Load logs data
 */
function load() {
  if (!fs.existsSync(LOGS_DIRECTORY)) {
    fs.mkdirSync(LOGS_DIRECTORY);
  }
  for (const filename of fs.readdirSync(LOGS_DIRECTORY)) {
    // filename pattern is "logs<terminalId>.json"
    const terminalId = parseInt(filename.slice(4, -5));
    const logs = fs.readFileSync(`${LOGS_DIRECTORY}/${filename}`);
    if (logs) {
      for (const log of JSON.parse(logs)) {
        add(terminalId, new Log(log.id, log.execId, log.seqId, log.command,
                                log.status, log.output, new Date(log.date)));
      }
    }
  }
}

/**
 * Save a log data
 */
function store(terminalId, log) {
  const filename = `${LOGS_DIRECTORY}/logs${terminalId}.json`;
  if (fs.existsSync(filename)) {
    // replace last "]" to ", " and append log and "]"
    const appendLog = ", " + JSON.stringify(log) + "]";
    const lastBraceOffset = fs.statSync(filename).size - 1;
    const fd = fs.openSync(filename, "r+");
    fs.writeSync(fd, appendLog, lastBraceOffset);
    fs.closeSync(fd);
  } else {
    fs.writeFileSync(filename, JSON.stringify([log]));
  }
}

//const MAX_LOGS_PER_TERMINAL = 10000; 
/**
 * add a log
 * @param {number} terminalId
 * @param {Log} log
 */
function add(terminalId, log) {
  if (terminalId in _logs) {
    _logs[terminalId].push(log);
    /*    remove old log
    if (_logs[terminalId].length > MAX_LOGS_PER_TERMINAL) {
      console.log("log remove", _logs[terminalId].length);
      _logs[terminalId] = _logs[terminalId].slice(-5000);
    }
    */
  } else {
    _logs[terminalId] = [log];
  }
//  console.log("_logs[terminalId].length=", _logs[terminalId].length);
  if (_logId <= log.id) {
    _logId = log.id + 1;
  }
}

/**
 * Log creation
 * @param {number} terminalId
 * @param {number} execId
 * @param {number} seqId
 * @param {string} command
 * @param {number} status
 * @param {string} output
 * @param {Date} date
 * @returns
 */
function create(terminalId, execId, seqId, command, status, output, date) {
  const log = new Log(_logId++, execId, seqId, command, status, output, date.toISOString());
  add(terminalId, log);
  store(terminalId, log);
  notify(terminalId);
  return log
}

/**
 * Log deletion
 * @param {number} terminalId
 */
function destroy(terminalId) {
}

/**
 * Notify logs update
 * @param {number} terminalId
 */
function notify(terminalId) {
  const message = JSON.stringify({ type: 'logs', terminalId });
  notifier.send(message);
}

/**
 * Get all terminal logs
 * @param {number} terminalId
 * @returns {Array<object>} log data list
 */
function getTerminalLogs(terminalId) {
  if (terminalId in _logs) {
    return _logs[terminalId];
  } else {
    return []
  }
}

/**
 * Get terminal log
 * @param {number} terminalId
 * @param {number} logIdRange
 * @returns {object}
 */
function searchLogsIdRange(terminalId, logIdRange) {
  const terminalLog = {};
  if (terminalId in _logs) {
    const terminalLogs = _logs[terminalId];
    const ids = logIdRange.split('-');
    if (ids.length == 1) {
      return terminalLogs.filter(log => log.id == logIdRange);
    }
    if (ids.length == 2 && ids[0]) {
      if (ids[1]) {
        return terminalLogs.filter(log => log.id >= ids[0] && log.id <= ids[1]);
      } else {
        return terminalLogs.filter(log => log.id >= ids[0]);
      }
    }
  }
  return {};
}

/**
 * Get command logs
 * @param {number} terminalId
 * @param {number} execId
 * @returns
 */
function getCommandLogs(terminalId, execId) {
  const terminalLogs = getTerminalLogs(terminalId);
  const commandLogs = terminalLogs.filter(log => log.execId == execId)
  return commandLogs;
}

/**
 * Get command execution result log string
 * @param {number} terminalId
 * @param {number} execId
 * @returns {string} log
 */
function getCommandLogString(terminalId, execId) {
  const commandLogs = getCommandLogs(terminalId, execId);
  const log = commandLogs.map(log => log.output).join('');
  return log;
}

/**
 * Archive terminal logs by adding time stamps and renaming terminal log files
 * @returns {string} renamed file name
 */
function archiveLogs(){
  for (let terminalId in _logs) {
    _logs[terminalId] = _logs[terminalId].slice(-100);
  }
  const timestamp = Date.now();
  let newPath = "";
  for (const filename of fs.readdirSync(LOGS_DIRECTORY)) {
    if (/^logs[1-9]\.json$/.test(filename)) {
      const oldPath = path.join(LOGS_DIRECTORY, filename);
      newPath = path.join(LOGS_DIRECTORY, filename.replace('.json', `_${timestamp}.json`));
      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          console.error('Error renaming file:', err);
        } else {
          console.log(`Renamed ${oldPath} to ${newPath}`);
        }
      });
    }
  }
  return newPath;
}

/**
 * REST API routing
 * @param {Object} router
 */
function route(router) {
    /**
     * GET - get all logs of the terminal
     */
    router.get('/:terminalId/logs', function (req, res, next) {
//      console.log(`[Log] GET all of terminal ${req.params.terminalId} from ${req.hostname}`);
      const logs = getTerminalLogs(req.params.terminalId);
      res.send(JSON.stringify(logs));
    });

    /**
     * GET - get specified logs of the terminal
     */
    router.get('/:terminalId/logs/:logIdRange', function (req, res, next) {
//      console.log(`[Log] GET ${req.params.logIdRange} of terminal ${req.params.terminalId} from ${req.hostname}`);
      const logs = searchLogsIdRange(req.params.terminalId, req.params.logIdRange)
      res.send(JSON.stringify(logs));
    });

    /**
     * POST - add a log to the terminal
     */
    router.post('/:terminalId/logs', function (req, res, next) {
      console.log(`[Log] POST terminal ${req.params.terminalId} from ${req.hostname}`);
      if ('log' in req.body) {
        const input = JSON.parse(req.body.log);
        const log = create(req.params.terminalId, _logId++, 0, 0, input.command, input.status, input.output, new Date());
        res.send(JSON.stringify(log));
      } else {
        res.send('{}');
      }
    });

  /**
   * REST API routing
   * DELETE - Archive logs of the console.
   */
  router.delete('/:terminalId/archiveLogs', function (req, res, next) {
    const newPath = archiveLogs();
    res.send(newPath);
  });


}

module.exports.setup = load;
module.exports.create = create;
module.exports.destroy = destroy;
module.exports.getCommandLogString = getCommandLogString;
module.exports.route = route;
