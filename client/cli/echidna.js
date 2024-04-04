#!/usr/bin/env node

const Command = require('commander').Command;
const fs = require('fs');
const config = require('./echidna.json');
const WebSocketClient = require('websocket').client;
const echidnaapi = import('@echidna/api');
let EchidnaAPI;

async function main() {
    EchidnaAPI = (await echidnaapi).EchidnaAPI;
    const args = new Command();
    args.name(`echidna`)
        .description('A client of the red team tools Echidna')
        .option('-s, --host <host>', 'server name or address', config.host)
        .option('-p, --port <port>', 'REST API port number', config.port)
        .option('-w, --websocket <port>', 'notify websocket port number', config.websocket);
    args.command('terminals')
        .description('show terminal id and name')
        .action(() => {
            echidna(args.opts()).terminals();
        });
    args.command('history')
        .description('show command history of specified terminal')
        .argument('<terminal_id>', 'terminal id')
        .action((terminalId) => {
            echidna(args.opts()).history(terminalId, true);
        });
    args.command('logs')
        .description('show logs of specified terminal')
        .argument('<terminal_id>', 'terminal id')
        .action((terminalId) => {
            echidna(args.opts()).logs(terminalId, true);
        });
    args.command('create')
        .description('create new terminal and connect')
        .argument('<terminal_name>', 'new terminal name')
        .action((name) => {
            echidna(args.opts()).createTerminal(name);
        });
    /*
    args.command('delete')
        .description('delete a terminal')
        .argument('<terminal_id>', 'existing terminal id')
        .action((id) => {
            echidna(args.opts()).deleteTerminal(id);
        });
    */
    args.command('connect')
        .description('connect existing terminal')
        .argument('<terminal_id>', 'existing terminal id')
        .action((terminalId) => {
            echidna(args.opts()).connect(terminalId);
        });
    args.command('rename')
        .description('rename a terminal')
        .argument('<terminal_id>', 'existing terminal id')
        .argument('<terminal_name>', 'new terminal name')
        .action((terminalId, name) => {
            echidna(args.opts()).rename(terminalId, name);
        });
    args.command('targets')
        .description('show targets')
        .option('-a, --all', 'show all targets')
        .option('-e, --even', 'show even-depth targets (default)')
        .option('-o, --odd', 'show odd-depth targets')
        .action((option) => {
            echidna(args.opts()).targets(option);
        });
    const target = new Command();
    target.name('target')
          .description('operation for target');
    target.command('add <target_id> [value...]')
          .description('add target nodes of specified values or to read TSV values from stdin')
          .action((targetId, nodes) => {
              echidna(args.opts()).target(+targetId, nodes);
          });
    target.command('move <target_id> <old_parent_id> <new_parent_id>')
          .description('move a target node from old_parent_id to new_parent_id')
          .action((targetId, oldParentId, newParentId) => {
              echidna(args.opts()).moveTarget(+targetId, +oldParentId, +newParentId);
          });
    target.command('remove <target_id> [parent_id]')
          .description('remove a target node')
          .action((targetId, parentId) => {
              echidna(args.opts()).removeTarget(+targetId, +parentId);
          });
    args.addCommand(target);
    args.command('commands')
        .description('show commands')
        .argument('[target_id]', 'existing target id', 0)
        .action((targetId) => {
            echidna(args.opts()).commands(+targetId);
        });
    args.parse(process.argv);
}

function echidna(opts) {
    config.host = opts.host;
    config.port = +opts.port;
    config.websocket = +opts.websocket;
    saveConfig();
    return new EchidnaCLI(config.host, config.port, config.websocket);
}

function saveConfig() {
    fs.writeFileSync(__dirname + '/echidna.json', JSON.stringify(config, null, 2) + '\n');
}

class EchidnaCLI {

    constructor(host, port, websocket) {
        this.api = new EchidnaAPI(host, port, websocket);
        this.logId = -1;
    }

    error(event) {
        process.stderr.write(event.toString() + '\n');
        process.exit(1);
    }

    terminals() {
        this.api.terminals()
            .then(({data: terminals}) => {
                for (const { id, name } of terminals) {
                    process.stdout.write(`${id}: "${name}"\n`);
                }
            })
            .catch(this.error);
    }

    history(terminalId, newline = false) {
        this.api.logs(terminalId, this.logId + 1)
            .then(({data: logs}) => {
                for (const log of logs) {
                    if (log.seqId == 2 && log.command.trim() &&
                        ['\r', '\n'].includes(log.command.slice(-1))) {
                        process.stdout.write(`${log.execId} ${log.command.trim()}\n`);
                    }
                }
            })
            .catch(this.error);
    }

    logs(terminalId, newline = false) {
        this.api.logs(terminalId, this.logId + 1)
            .then(({data: logs}) => {
                for (const log of logs) {
                    if (this.logId < log.id) {
                        process.stdout.write(log.output);
                        this.logId = log.id;
                    }
                }
            })
            .catch(this.error);
    }

    createTerminal(name) {
        this.api.addTerminal(name)
            .then(({data: terminal}) => {
                this.connect(terminal.id);
            })
            .catch(this.error);
    }

    /*
    deleteTerminal(id) {
        this.api.deleteTerminal(id)
            .catch(this.error);
    }
    */

    connect(terminalId) {
        this.api.terminals()
            .then(({data: terminals}) => {
                for (const terminal of terminals) {
                    if (terminal.id == terminalId || terminal.name == terminalId) {
                        this.logs(terminal.id);
                        this._handleKeyin(terminal.id);
                        this._handleNotify(terminal.id);
                        return;
                    }
                }
                this.error(`Error: not found the termnal id ${terminalId}.`);
            })
            .catch(this.error);
    }

    _handleKeyin(terminalId, raw = true) {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.setRawMode(raw);
        process.stdin.on('data', (key) => {
            this.api.keyin(terminalId, key.toString());
        });
        process.stdin.on('error', (error) => {
            this.error(`stdin error: ${error}`);
        });
        process.stdin.on('close', () => {
            this.error('');
        });
    }

    _handleNotify(terminalId) {
        this.api.on('logs', (logs) => {
            if (logs.terminalId == terminalId) {
                this.logs(terminalId);
            }
        });
        this.api.on('error', this.error);
        this.api.on('close', this.error);
    }

    renameTerminal(oldName, newName) {
    }

    targets(option) {
        this.api.targets()
            .then(({data: targets}) => {
                const width = String(targets.length - 1).length;
                function* traverse(depth, path, target) {
                    for (let childId of target.children) {
                        const child = targets[childId];
                        const childPath =  path + '/' + child.value;
                        yield [depth, childPath, childId];
                        yield* traverse(depth + 1, childPath, child);
                    }
                }
                const even_odd = option.all ? [0, 1] : option.odd ? [1] : [0];
                for (let [depth, path, id] of traverse(1, '', targets[0])) {
                    if (even_odd.includes(depth % 2)) {
                        id = String(id).padStart(width, " ");
                        process.stdout.write(`${id}: ${path}\n`);
                    }
                }
            })
            .catch(this.error);
    }

    async target(targetId, nodes) {
        if (!nodes.length) {
            return this.targetStdin(targetId);
        }
        try {
            for (const node of nodes) {
                targetId = (await this.api.addTarget(targetId, node)).data.id;
            }
        } catch (e) {
            this.error(e);
        }
    }

    moveTarget(targetId, oldParentId, newParentId) {
        this.api.moveTarget(targetId, oldParentId, newParentId);
    }

    removeTarget(targetId) {
        this.api.deleteTarget(targetId);
    }

    async targetStdin(targetId) {
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        var input = '';
        process.stdin.on('data', (chunk) => {
            input += chunk;
        });
        process.stdin.on('end', () => {
            const lines = input.trim().split('\n');
            for (const line of lines) {
                const nodes = line.trim().split('\t');
                if (!nodes.length) continue;
                this.target(targetId, nodes);
            }
        });
    }

    commands(targetId) {
        this.api.candidates(targetId).then((commands) => {
            commands
                .sort((c1, c2) => c1.candidate.localeCompare(c2.candidate))
                .forEach((command) => {
                    process.stdout.write(`${command.candidate}\n  ${command.name}\n`);
                });
        })
        .catch(this.error);
    }
}

main();
