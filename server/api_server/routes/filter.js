const targets = require('routes/targets');
const child_process = require('child_process');
const fs = require('fs');
const ip = require('ip');
const chats = require('routes/chats');

const FILTER_CWD = (cwd => {
  if (cwd.endsWith('routes')) {
    return cwd + '/../commands/';
  } else {
    return cwd + '/commands/';
  }
})(process.cwd());

const UNKNOWN = 'unknown#';
let unknown = -1;

/**
 * @type {string}
 */
const SAVE_FILE = './data/filter.json';

function load() {
  unknown = 0;
  if (!fs.existsSync(SAVE_FILE)) {
    return;
  }
  const filterJson = fs.readFileSync(SAVE_FILE);
  if (!filterJson) {
    return;
  }
  const filter = JSON.parse(filterJson);
  unknown = filter.unknown;
}

function unknownHost() {
  if (unknown < 0) {
    load();
  }
  unknown++;
  fs.writeFileSync(SAVE_FILE, JSON.stringify({unknown}));
  return `${UNKNOWN}${unknown}`;
}

/*
 * nodes are:
 *   / name value [name value]...
 * names are:
 *   network
 *   network name
 *   network address
 *   network netmask
 *   network maskbit
 *   network host
 *   host
 *   host name
 *   host domain
 *   host cpu arch
 *   host mac
 *   host ipv4 netmask
 *   host ipv6 netmask
 *   host network name
 *   host network mac
 *   host network ipv4
 *   host network ipv6
 *   host url
 */

/**
 * Filter class
 */
class Filter {
  /**
   * Constructor
   * @param {number} targetId
   */
  constructor(terminalId, targetId) {
    this.terminalId = terminalId;
    this.targetId = targetId;
  }

  /**
   * Extract target
   * @param {string} log
   */
  extract(log) { }

  /**
   * Close filter processing
   */
  close() { }

  /**
   * Target addition
   * @param {string} name
   * @param {string} value
   * @returns {Target}
   */
  addTarget(name, value) {
    return targets.add(this.targetId, name)?.add(value);
  }
}

/**
 * Regexp filter class
 */
class RegExpFilter extends Filter {
  /**
   * Constructor
   * @param {number} targetId
   * @param {string} name
   * @param {string} pattern
   */
  constructor(terminalId, targetId, name, pattern) {
    super(terminalId, targetId);
    this.name = name;
    this.pattern = pattern;
  }

  /**
   * Extract target
   * @param {string} log
   */
  extract(log) {
    const values = this.filtering(log);
    this.organize(values);
  }

  /**
   * Filtering log strings for target addition
   * @param {string} log
   * @returns {Array.<string>}
   */
  filtering(log) {
    const valuePattern = new RegExp(this.pattern, 'g');
    const values = log.match(valuePattern);
    return values || [];
  }

  /**
   * Add target for filtered values
   * @param {Array.<string>} values
   */
  organize(values) {
    values.forEach(value => {
      this.addTarget(this.name, value);
    });
  }

  /**
   * Get filter information
   * @returns {object}
   */
  info() {
    return { targetId: this.targetId, name: this.name, patterns: this.patterns };
  }
}

/**
 * Script filter class
 */
class ScriptFilter extends Filter {
  /**
   * Constructor
   * @param {number} targetId
   * @param {number} commandId
   * @param {string} script
   * @param {string} commandLine
   * @param {string} hostName
   */
  constructor(terminalId, targetId, commandId, script, commandLine, hostName) {
    super(terminalId, targetId);
    this.commandId = commandId;
    this.script = script;
    this.bufferedText = '';
    this.commandLine = commandLine;
    this.open(commandLine, hostName);
  }

  open(commandLine, hostName) {
    if (this.process) {
      this.close();
    }
    try {
      targets.removeNotify();
      this.process = child_process.spawn(`${FILTER_CWD}/${this.script}`, [hostName, commandLine]);
      this.process.on('error', (error) => this.error(error));
      this.process.on('close', () => this.close());
      this.process.stdin.on('error', (error) => this.error(error));
      this.process.stdin.on('close', () => this.close);
      this.process.stdout.on('data', (data) => this.extracted(data.toString()));
      this.process.stdout.on('error', (error) => this.error(error));
      this.process.stdout.on('close', () => this.close());
      this.process.stderr.on('data', (data) => console.log(`[Filter] stderr ${this.commandId}: ===>${data.toString()}<===`));
      this.process.stderr.on('error', (error) => this.error(error));
      this.process.stderr.on('close', () => this.close());
      console.log(`[Filter] start ${this.commandId} ${this.script}`);
    }
    catch (err) {
      console.log(`[Filter] fail to start ${this.commandId} "${this.script} [${err.message}]`);
    }
  }

  error(output) {
    console.log(`[Filter] error ${this.commandId} "${output}"`);
  }

  close() {
    const process = this.process;
    this.process = undefined;
    if (process) {
      console.log(`[Filter] end ${this.commandId} ${this.script}`);
      targets.analyzeTarget();
      process.kill();
    }
  }

  /**
   * extract targets from command output
   * @param {string} text
   */
  extract(text) {
    // console.log(`[Filter] extract: ===>${text}<===`);
    try {
      // remove escape sequences
      text = text.replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, '')
                 .replace(/\x1b\][0-9]*;/, '');
      this.process?.stdin.write(text);
    }
    catch (err) {
      this.process = undefined;
      console.log(`[Filter] fail to extract ${this.commandId} [${err.message}]`);
    }
  }

  /**
   * Add targets
   * @param {string} text
   */
  extracted(text) {
    // console.log(`[Filter] extracted: ===>${text}<===`);
    const lines = (this.bufferedText + text).split(/\r?\n/);
    this.bufferedText = lines.pop(-1);  // postpone processing after last '\n'
    lines.forEach(line => {
      let nodes = line.split('\t');
      let target = targets.get(this.targetId);
      if (!target) return;
      [target, nodes] = this.restruct(target, nodes);
      nodes.forEach(value => {
        target = targets.add(target.id, value.trim());
      });
    });
 //   chats.analysis(text);
  }

  restruct(target, nodes) {
    if (nodes[0] === 'local') {
      [target, nodes] = this.linkNetwork(target, nodes.slice(1));
    } else if (nodes[0] === 'remote') {
      nodes = nodes.slice(1);
      if (nodes[0] === 'target-network') {
         [target, nodes] = this.findNetwork(target, nodes);
      }
      if (nodes[0] === 'host') {
        [target, nodes] = this.findRemoteHost(target, nodes);
      } else {
        [target, nodes] = this.findUnknownHost(target, nodes);
      }
    }
    return [target, nodes]
  }

  linkNetwork(target, nodes) {
    const [networkKey, networkName] = nodes;
    if (networkKey !== 'network' || !networkName) {
      return [target, nodes];
    }
    const hostKey = targets.get(target.parent);
    const ownNetowrk = targets.get(hostKey.parent);
    if (targets.get(ownNetowrk.parent).value == 'network' &&
      ownNetowrk.value.startsWith(UNKNOWN)) {
      ownNetowrk.value = networkName;
    } else {
      const network = targets.get(0);
      const newNetwork = targets.add(network.id, networkName);
      const host = targets.add(newNetwork.id, 'host');
      if (!host.children.includes(target.id)) {
        host.children.push(target.id);
      }
    }
    return [target, []];
  }

  findNetwork(nodes) {
    const [networkKey, networkName, hostKey, hostValue] = nodes;
    if (hostKey !== 'host' || !hostValue) {
      return [0, nodes];
    }
    const networks = targets.add(0, networkKey);
    for (var network of networks.children.map(id => targets.get(id))) {
      if (network.value === networkName) {
          return [network, nodes.slice(2)];
      }
      if (network.value.startsWith(UNKNOWN) &&
          network.hasValues([hostKey, hostValue])) {
        network.value = networkName;
        return [network, nodes.slice(2)];
      }
    }
    return [networks, nodes.slice(1)];
  }

  getNetworkRoute(ip) {
    const result = child_process.execSync(`ip route get ${ip}`, { encoding: 'utf8' });
    const match = result.match(/via ([\d\.]+)/);
    if (match) {
        return match[1];
    }
    return ip;
  }

  // return host node of the belonging Network
  getHost(target, nodes) {
    let [itemKey, itemValue] = nodes;
    if (itemKey === "host") {
      const getIPaddress = "getent hosts " + itemValue + '  | cut -d " " -f1';
      const { execSync } = require("child_process");
      itemValue = execSync(getIPaddress).toString().trim();
    }
    if (itemKey === 'ipv4' || itemKey === 'host'){
      const NETWORKNODEID = 0;
      let networktarget = targets.get(NETWORKNODEID);
      const networkRoute = this.getNetworkRoute(itemValue); // execute ip route get command to find the appropriate network
      for (var network of networktarget.children
        .slice()
        .reverse()
        .map((id) => targets.get(id))) {
        const isInRange = ip.cidrSubnet(network.value).contains(networkRoute);
        if (isInRange) {
          return targets.get(network.children[0]); // return host node of the belonging Network
        }
      }
    }
    return targets.get(target.parent); // return host node of the parent node if no belonging Network found
  }

  findUnknownHost(target, nodes) {
    const [itemKey, itemValue] = nodes;
    if (!itemValue) {
      return [target, nodes];
    }
    const hosts = this.getHost(target, nodes);
    for (var host of hosts.children.map(id => targets.get(id))) {
      if (host.hasValues([itemKey, itemValue])) {
        return [host, nodes];
      }
    }
    return [hosts, [unknownHost(), ...nodes]];
  }

  findRemoteHost(target, nodes) {
    const [hostKey, hostName, itemKey, itemValue] = nodes;
    if (hostKey !== 'host' && !itemValue) {
      return this.findUnknownHost(target, nodes);
    }
    const hosts = this.getHost(target, nodes);
    for (var host of hosts.children.map(id => targets.get(id))) {
      if (host.value === hostName) {
          return [host, nodes.slice(2)];
      }
      if (host.value.startsWith(UNKNOWN) &&
          host.hasValues([itemKey, itemValue])) {
        host.value = hostName;
        return [host, nodes.slice(2)];
      }
    }
    return [hosts, nodes.slice(1)];
  }

  /**
   * Get filter information
   * @returns {object}
   */
  info() {
    return { targetId: this.targetId, name: this.name, script: this.script };
  }
}

/**
 * Filter creation
 * @param {number} targetId
 * @param {string} name
 * @param {string} pattern
 * @returns {RegExpFilter}
 */
function createRegExp(terminalId, targetId, name, pattern) {
  return new RegExpFilter(terminalId, targetId, name, pattern);
}

/**
 * create a script filter
 * @param {number} targetId
 * @param {string} name
 * @param {string} script
 * @returns {ScriptFilter}
 */
function createScript(terminalId, targetId, commandId, script, commandLine="", hostName="") {
  return new ScriptFilter(terminalId, targetId, commandId, script, commandLine, hostName);
}

module.exports.setup = load;
module.exports.createRegExp = createRegExp;
module.exports.createScript = createScript;
