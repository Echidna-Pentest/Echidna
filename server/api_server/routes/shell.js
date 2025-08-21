const pty = require('node-pty');
const commands = require('routes/commands');
const logs = require('routes/logs');
const targets = require('routes/targets');
const chats = require('routes/chats');
const criticalscandb = require('routes/criticalscandb');
const terminals = require('routes/terminals');
const child_process = require('child_process');
const stream   = require( 'stream' );
const process = require('process');
const fs = require('node:fs');
const username = process.env.USER;
const promptname = username + "@ECHIDNA$"

/**
 * @type {object}
 */
let _shells = {};

const KEY_BACKSPACE = '\b';
const KEY_DEL = String.fromCharCode(0x7f);
const CTRL_U = String.fromCharCode(0x1f & 'u'.charCodeAt(0));
const CTRL_C = String.fromCharCode(0x1f & 'c'.charCodeAt(0));

function edit(command) {
    //console.debug('edit before:', JSON.stringify(command));
    let edited = '';
    let cursor = 0;
    for (let i = 0; i < command.length; i++) {
      if (command[i] === '\n') {
        edited += '\n';
        break;
      }
      if (command[i] === '\x07') {  // BELL
        continue;
      }
      if (command[i] === '\x08') {  // BS
        cursor = Math.max(cursor - 1, 0);
        continue;
      }
      if (command.slice(i, i + 2) !== '\x1b[') {  // not CSI
        edited = edited.slice(0, cursor) + command[i] + edited.slice(cursor + 1);
        cursor++;
        continue;
      }
      const csi = command.slice(i + 2);
      if (csi.startsWith('D')) {  // left arrow
        cursor = Math.max(cursor - 1, 0);
        i += 2
      } else if (csi.startsWith('C')) {  // right arrow
        cursor = Math.max(cursor + 1, 0);
        i += 2
      } else if (csi.startsWith('K')) {  // delete right all
        edited = edited.slice(0, cursor);
        i += 2;
      } else if (csi.startsWith('0K')) {  // delete right all
        edited = edited.slice(0, cursor);
        i += 3;
      } else if (csi.startsWith('1K')) {  // delete left all
        edited = edited.slice(cursor);
        cursor = 0;
        i += 3;
      } else if (csi.search(/^\d*P/) === 0) {  // delete n characters
        const n = csi.trim().replace(/^(\d*)P.*/, '$1');
        edited = edited.slice(0, cursor) + edited.slice(cursor + parseInt(n || 1));
        i += n.length + 2;
      } else if (csi.search(/^\d*@/) === 0) {  // insert n spaces
        const n = csi.trim().replace(/^(\d*)@.*/, '$1');
        edited = edited.slice(0, cursor) + ' '.repeat(parseInt(n || 1)) + edited.slice(cursor);
        i += n.length + 2;
      } else {
        edited = edited.slice(0, cursor) + command[i] + edited.slice(cursor + 1);
        cursor++;
      }
    }
    //console.debug('edit after:', JSON.stringify(edited));
    return edited;
}

let targetNetwork = "unknown#0";
let targetHost = "unknown#0";
const findNetwork = `
ip addr
| egrep -A 2 ' link/ether '
| awk '/(inet|inet6)/ {print $2}'
| python3 -c 'import sys, ipaddress;
              print(*[addr.network
                      for addr in map(ipaddress.ip_interface,
                                      map(str.strip, sys.stdin))
                      if (addr.is_global or
                          addr.is_private and not addr.is_link_local)][:1])'
`.replaceAll("\n", " ");

async function identifyNetworkHost() {
    const network = new Promise(resolve => {
        child_process.exec(findNetwork, (error, stdout, stderr) => {
            if (!error) {
                targetNetwork = stdout.trim() || targetNetwork;
            }
            resolve();
        });
    });
    const host = new Promise(resolve => {
        child_process.exec("hostname", (error, stdout, stderr) => {
            if (!error) {
                targetHost = stdout.trim() || targetHost;
            }
            resolve();
        });
    });
    await network;
    await host;
}

/**
 * Shell class
 */
class Shell {
    /**
     * Constructor
     * @param {*} terminalId
     */
    constructor(terminalId, executionNo = 0) {
        this.id = terminalId;
        this.execNo = executionNo;
        this.logSeqNo = 0;
        this.command = "";
        this.status = 0;
        this.logging = true;
        this.filters = [];
        this.targetId = targets.add(0, targetNetwork).add('host').add(targetHost).id;
        this.env = {currenthost: "default", currentcommand: "default"};
//        process.env["TERM"] = "xterm-mono";
        this.process = pty.spawn("bash", [], {
            name: "xterm",
            cols: 112,
            rows: 58,
            cwd: process.env.HOME,
            env: process.env,
        });
        this.alive = true;
        this.process.write('PS1=' + promptname + '\n');
        this.terminalOutput = "";     // store terminal output to call filtering process
        this.lastAnalyzedExecNo = -1;  // guard to analyze once per command
        this.lastAgentCommand = "";   // track last agent command to prevent loops
        const transformStream = new stream.Transform({
          highWaterMark: 16384 * 16384,
          transform: (chunk, encoding, callback) => {
            this.terminalOutput += chunk.toString();
            callback(null, chunk);
          }
        });

        this.process.pipe(transformStream);
        this.process.on("data", (data) => {
            this.output(data, 0);
        });
        this.process.on("close", () => this.close(0));
    }


    /**
     * input keys
     * @param {number} targetId
     * @param {string} command
     * @returns {number}
     */
    input(keys, isUserInputReceived=true) {
        if (this.command.endsWith("\r") && keys == "\n") {
            this.command += keys;
        } else {
            if (this.command.endsWith("\r") || this.command.endsWith("\n")) {
                this.command = keys;
            } else {
                this.command += keys;
            }
            if (keys.endsWith("\n") || keys.endsWith("\r")) {
                this.filters.forEach((filter) => {
                    filter.close();
                });
                if (this.env.currenthost == "default") {
                  let command = "";
                  if(isUserInputReceived==false){
                    command = keys;
                  }else{
                    command = this.checkLastCommand();
                  }
//                    let command = keys;
                    this.terminalOutput = "";
                    this.command = edit(command);
//                    const stdout = child_process.execSync(`echo '${command}'  |  ansi2txt | col -b`);
//                    this.command = stdout.toString();
                } else {
                    this.command = edit(this.command);
                }
//               console.log("\n[****************this command=**************]", this.command);
                this.filters = commands.getFilters(this.id, this.targetId, this.command.trim(), this.env.currenthost);
                const processid = this.process.pid;
                checkNetworkConnection(processid, this.id);
            }
        }

        ++this.execNo;
        this.logSeqNo = 0;
        this.process.write(keys);
        return this.execNo;
    }


    /**
     * Process command output data
     * @param {string} command output string
     * @param {number} status
     */
    output(output, status) {
        if (this.logging) {
            output = output.toString();
            this.filters.forEach((filter) => {
              const pattern = /\r?\n?[^\r\n]*\$\s*$/;   // verify output contains in last line $ to check prompt name
              if (pattern.test(output)) {
                filter.extract(output.replace(/\r?\n?[^\r\n]*$/, "\n"));    //remove last line since it is prompt name
              }else{
                filter.extract(output);
              }
            });
            // trigger AI analysis once per command when prompt appears
            const endPattern = /\r?\n?[^\r\n]*\$\s*$/;
            if (endPattern.test(output) && this.lastAnalyzedExecNo !== this.execNo) {
              const analyzedText = this.terminalOutput.replace(/\r?\n?[^\r\n]*\$\s*$/, "\n");
              
              // Skip analysis if the terminal output contains "ip addr" command
              if (!this.terminalOutput.includes("ip addr")) {
                try {
                  const p = chats.analysis(analyzedText, false);
                  if (p && typeof p.then === 'function') {
                    p.then((msg) => {
                      console.log(`[Agent] AI analysis result: ${msg ? msg.substring(0, 200) : 'null'}...`);
                      // AI analysis results are now handled directly in chats.js
                      // ReactAgent is called immediately when CRITICAL vulnerabilities are detected
                    }).catch(() => {});
                  }
                } catch (e) { /* noop */ }
              }
              this.lastAnalyzedExecNo = this.execNo;
            }
            logs.create(this.id, this.execNo, ++this.logSeqNo, this.command, status, output, new Date());
            const result = criticalscandb.searchValue("CriticalScan", output);
            if (result){
              chats.create("text", "echidna", result.CriticalScan + " might be interesting. Similar machine is " + result.machine_name);
            }
        }
    }

    /**
     * kill the shell process
     */
    kill() {
        this.logging = false;
        this.process.kill("SIGKILL");
        this.alive = false;
        console.log(`[Shell] killed ${this.id}`);
    }

    /**
     * close the shell
     * @param {number} code
     */
    close(code) {
        this.filters = [];
        console.log(`[Shell] exit ${this.id} code ${code}`);
        this.alive = false;
    }

    checkLastCommand() {
      let regex = new RegExp(`.*${username}@ECHIDNA\\$(.*)`, 's');
      let result = this.terminalOutput.match(regex);
      if (result && result[1]) {
        return result[1] + "\n";
      } else {
        return this.terminalOutput + "\n";
     }
   }
}



function checkNetworkConnection(processid, terminalId) {
  // check command for established session of all child processes of terminal
  const establishNetworkSessionCmd = `for pid in $(pstree -p ${processid} | grep -oP '\\(\\K\\d+(?=\\))'); do lsof -i -a -p $pid 2>/dev/null; done | tail -n 1`;
//  console.log("establishNetworkSessionCmd=", establishNetworkSessionCmd);
  child_process.exec(establishNetworkSessionCmd, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
    const result = stdout.toString();
//    console.log("result=", result);
    const pattern = /(\S+)\s*.*->(.*):.*/;
    if (pattern.test(result)) {
      //        console.log("pattern result=", result);
      const commandname = result.match(pattern)[1]; // remote connection established
      const scancommandpattern = /nmap|ping|dirb|hydra|gobuster|wpscan|smbmap|nikto/;
      if (scancommandpattern.test(commandname) == false) {
        _shells[terminalId].env["currenthost"] = result.match(pattern)[2]; // remote connection established
        _shells[terminalId].env["currentcommand"] = commandname;
        if (commandname == "ruby") {    // check meterpreter is working
          checkMetasploit(processid, terminalId);
        }
      } else {
        _shells[terminalId].env["currenthost"] = "default";
      }
    }else{
      _shells[terminalId].env["currenthost"] = "default";
    }
  });
}


function checkMetasploit(processid, terminalId) {
    const metasploitcheckcmd = "lsof -a -p `(pgrep -P " + processid + ")`| grep metasploit | wc -l";
    const stdout = child_process.exec(metasploitcheckcmd, (error, stdout, stderr) => {
        if (error) {
            return;
        }
        if (Number(stdout) > 0) {
            _shells[terminalId].env["currentcommand"] = "meterpreter";
        }
    });
}

/**
 * Load logs data
 */
async function setup() {
  await identifyNetworkHost();
  await commands.setup();
  await targets.setup();
  await logs.setup();
}

/**
 * Shell creation
 * @param {*} terminalId
 */
function create(terminalId) {
  if (!(terminalId in _shells)) {
    let shell = new Shell(terminalId);
    _shells[terminalId] = shell;
    if (terminalId == 1){   // execute ip addr to check network address when first terminal is created
      shell.input("ip addr\n", false);
    }
  }
}

/**
 * Shell deletion
 * @param {*} terminalId
 */
function destroy(terminalId) {
  if (terminalId in _shells) {
    _shells[terminalId].kill();
    delete _shells[terminalId];
    logs.destroy(terminalId);
    console.log(`[Shell] deleted ${terminalId}`);
  }
}

/**
 * Shell resize
 * @param {*} terminalId
 * @param {*} cols
 * @param {*} rows
 */
function resizeTerminal(terminalId, cols, rows) {
  _shells[terminalId].process.resize(cols, rows);
  return _shells[terminalId];
}

/**
 * Command execution
 * @param {number} terminalId
 * @param {string} command
 * @returns {number} execution number
 */
function execute(terminalId, command) {
  const shell = _shells[terminalId];
  if (shell) {
    return shell.input(command);
  } else {
    return 0;
  }
}

/**
 * Execute command on a specific terminal
 * @param {number} terminalId 
 * @param {string} command 
 * @param {boolean} logging 
 * @returns {boolean} success
 */
function executeCommand(terminalId, command, logging = false) {
  if (terminalId in _shells) {
    _shells[terminalId].input(command, logging);
    return true;
  }
  return false;
}

/**
 * REST API routing
 * @param {Object} router
 */
function route(router) {
  /**
   * POST - shell command execution
   */
  router.post('/:terminalId/shell', function (req, res, next) {
    if ('command' in req.body) {
      console.log(`[Shell] POST ${req.params.terminalId} from ${req.hostname}`);
      const execNo = execute(req.params.terminalId, req.body.command);
      res.send(JSON.stringify({ receipt: execNo }));
    } else {
      console.log(`[Shell] POST ${req.params.terminalId} invalid from ${req.hostname}`);
    }
  });

    /**
   * GET - shell instance env parameter
   */
     router.get('/:terminalId/shell/env', function (req, res, next) {
         console.log("shellhost test req.params.terminalId=", req.params.terminalId);
         res.send(JSON.stringify(_shells[req.params.terminalId].env));
    });

  logs.route(router);
}

module.exports.setup = setup;
module.exports.create = create;
module.exports.destroy = destroy;
module.exports.resizeTerminal = resizeTerminal;
module.exports.route = route;
module.exports.executeCommand = executeCommand;
