const axios = require("axios");
let localIPandRangeList = [];

/**
 * Echidna API access class
 */
class EchidnaAPI {
  /**
   * Initialize the instance
   * @param {string} host
   * @param {number} port
   * @param {number} websocket
   */
  constructor(host = "localhost", port = 8888, websocket = 8889) {
    this.rest = axios.create({
      baseURL: `http://${host}:${port}`,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      responseType: "json",
    });
    this.wsURL = `ws://${host}:${websocket}/`;
    this.listeners = {};
  }

  /**
   * Get terminal objects
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: terminal objects
   */
  terminals() {
    return this.rest.get("/terminals");
  }

  shell_env(terminalId) {
    return this.rest.get(`/terminals/${terminalId}/shell/env`);
  }

  loadLocalIPs(){
    this.rest.post("/targets/getchildrenbyId/3", { value: "ipv4" })   // get all local ips
    .then(({ data: iplist }) => {
      let localips =  iplist;
      if (localips.length !=0){
        this.rest.get("/targets/0/children")  // get Network address
        .then(({ data: NetworkList }) => {
          if (NetworkList.length !=0){
            localIPandRangeList = localips.map((ip, index) => {
              return [NetworkList[index].value, ip];
            });
            return true;
          }
        });
      }
    })
    .catch((error) => {
      console.log(error);
      return false;
    });
  }
  /**
   * Add a terminal and return the added terminal object
   * @param {number} targetId: parent target id
   * @param {string} name: target data
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: added termial object
   */
  addTerminal(name) {
    return this.rest.post("/terminals", { name });
  }

  archiveConsoleLog(){
    return this.rest.delete(`/terminals/0/archiveLogs/`);
  }

  /**
   * resize a terminal and return the resized terminal object
   * @param {number} targetId: parent target id
   * @param {number} cols: terminal col size
   *  @param {number} cols: terminal row size
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: resized termial object
   */
   resizeTerminal(terminalId, cols, rows) {
    return this.rest.post("/terminals/resizeterminal", { terminalId, cols, rows });
  }

  /**
   * change the name of a terminal
   * @param {number} targetId: terminal id
   * @param {string} name: terminal name
   * @returns {Promise} Promise object represents a response object
   */
  changeTerminalName(terminalId, name) {
    return this.rest.post(
      `/terminals/changeterminalname/${terminalId}/${name}`
    );
  }

  /**
   * hide a terminal
   * @param {number} targetId: terminal id
   * @param {string} name: terminal name
   * @returns {Promise} Promise object represents a response object
   */
  hideTerminal(terminalId) {
    return this.rest.delete(`/terminals/${terminalId}`);
  }

  /**
   * Input keys to specified terminal
   * @param {number} terminalId: terminal id
   * @param {string} command: input key data
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: added log object
   */
  keyin(terminalId, command) {
    return this.rest.post(`/terminals/${terminalId}/shell`, { command });
  }

  /**
   * Get log objects
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: log objects
   */
  logs(terminalId, logId = 0) {
    return this.rest.get(`/terminals/${terminalId}/logs/${logId}-`);
  }

  /**
   * Get target objects
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: target objects
   */
  targets() {
    return this.rest.get("/targets");
  }

  getAllChildren(targetId) {
    return this.rest.post(`/targets/getallchildren/${targetId}`);
  }

  login(userid, password) {
    return this.rest.post("/login", { id: userid, pass: password });
  }

  getallchats() {
    return this.rest.get("/chats/getall");
  }

  chats() {
    return this.rest.get("/chats");
  }

  sendChat(message) {
    return this.rest.post("/chats", { message });
  }

  exportTarget(){
    return this.rest.get('/targets/export/target');
  }

  /**
   * Add a target objects
   * @param {number} targetId: parent target id
   * @param {string} name: target data
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: added target object
   */
  addTarget(targetId, name) {
    return this.rest.post(`/targets/${targetId}`, { name });
  }

  /**
   * update a target objects
   * @param {number} targetId: parent target id
   * @param {string} inputdata: target data inputed by user
   */
   updateTarget(targetId, inputdata) {
    return this.rest.post(`/targets/updatetarget/${targetId}`, { inputdata});
  }

  search(searchString) {
    return this.rest.get(`/targets/searchTree/${searchString}`);
  }

  /**
   * Move a target objects
   * @param {number} targetId: target id
   * @param {number} oldParentId: old parent id
   * @param {number} newParentId: new parent id
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: added target object
   */
  moveTarget(targetId, oldParentId, newParentId) {
    return this.rest.put(`/targets/${targetId}`, {
      parent: [oldParentId, newParentId],
    });
  }

  /**
   * Remove a target objects
   * @param {number} targetId: target id
   * @param {number} parentId: parent id of the target
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: added target object
   */
  deleteTarget(targetId, parentId = -1) {
    return this.rest.delete(`/targets/${targetId}`, { data: { parentId } });
  }

  /**
   * Get command objects
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: command objects
   */
  commands() {
    return this.rest.get("/commands");
  }

  addCommand(formData){
    return this.rest.post("/commands", { form: formData});
  }

  /**
   * Get command candidates
   * @param {number|Array<number>} targetId: parent target id
   * @returns {Promise<Array<command>>} Promise object
   * @returns {object} command: command config
   * @returns {string} command.candiate: command line
   */
  async candidates(targetId, terminalId = 1) {
    const { data: commands } = await this.commands();
    const { data: targets } = await this.targets();
    const { data: shell_env } = await this.shell_env(terminalId);
    const candidates = candidateCommands(
      commands,
      targets,
      targetId,
      shell_env
    );
    //        const candidates = candidateCommands(commands, targets, targetId);
    return uniq([...candidates], (command) => command.candidate);
  }

  /**
   * Register event callback function
   * The callback function argument is a data
   * @param {string} name: event name; 'terminals', 'logs', 'targets', 'commands', 'error', 'close'
   * @param {function} lister: event listener
   * @returns {Promise} Promise object represents a response object
   * @returns {object} response:  HTTP response data
   * @returns {number} response.status: HTTP response status code
   * @returns {object} response.data: command objects
   */
  on(name, listener) {
    if (this.listeners[name]) {
      this.listeners[name].push(listener);
    } else {
      this.listeners[name] = [listener];
    }
    if (this.ws) return;
    if (typeof window === "undefined") {
      this.ws = this._connectWebSocketClient();
    } else {
      this.ws = this._connectWebSocketBrowser();
    }
  }

  _connectWebSocketClient() {
    const WebSocket = require("websocket").client;
    const ws = new WebSocket();
    ws.on("connect", (connection) => {
      connection.on("message", (message) => {
        const data = JSON.parse(message.utf8Data.toString());
        if (data.type) {
          this._fire(data.type, data);
        }
      });
      connection.on("error", (error) => {
        this._fire("error", error.toString());
      });
      connection.on("close", () => {
        this._fire("close", "WebSocket closed.");
      });
    });
    ws.connect(this.wsURL, "echo-protocol");
    return ws;
  }

  _connectWebSocketBrowser() {
    const ws = new WebSocket(this.wsURL);
    ws.onopen = () => {
      this._fire("open", "WebSocket opned.");
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this._fire(data.type, data);
    };
    ws.onerrror = (error) => {
      this._fire("error", error.toString());
    };
    ws.onclose = () => {
      this._fire("close", "WebSocket closed.");
    };
    return ws;
  }

  _fire(name, event) {
    for (const listener of this.listeners[name] || []) {
      listener(event);
    }
  }
}

/**
 * iterate parent nodes of the targetId under the "host" node
 * @param {array<Target>} targets: target node list
 * @param {number} targetId: target id
 */
function* parentsInHost(targets, targetId) {
  let parent = targets[targets[targetId]?.parent];
  while (parent && parent.id > 0) {
    yield parent;
    if (parent.value == "host") return;
    parent = targets[targets[parent.parent]?.parent];
  }
}

/**
 * iterate target names joined parent node names and '.' of the targetId
 * @param {array<Target>} targets: target node list
 * @param {number} targetId: target id
 */
function* targetNames(targets, targetId) {
  let targetPath = null;
  for (const parent of parentsInHost(targets, targetId)) {
    targetPath = parent.value + (targetPath ? `.${targetPath}` : "");
    yield targetPath;
  }
  const childId = targets[targetId].children[0];
  if (!childId) {
    yield targets[targetId].value;
    return;
  }
  targetPath = null;
  for (const parent of parentsInHost(targets, childId)) {
    targetPath = parent.value + (targetPath ? `.${targetPath}` : "");
    yield targetPath;
  }
}

/**
 * Search nodes that has the searchstring under the targetId node
 * @param {array<Target>} targets: target node list
 * @param {number} targetId: target id
 * @param {string} searchstring: search string
 */
function searchTree(targets, targetId, searchstring) {
  let stack = [targets[targetId]];
  let searchResult = [];

  while (stack.length > 0) {
    const node = stack.pop();
    if (node.value.match(searchstring)) searchResult.push(node);

    if (node.children) stack.push(...node.children.map(id => targets[id]));
  }

  return searchResult;
}

function checkCondition(names, conditions, targets, targetId) {
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];

    if (names.some(name => name.match(condition))) {
      return i;
    }

    if (searchTree(targets, targetId, condition).length > 0) {
      return i;
    }
  }

  return -1;
}

function getConditionCommands(commands, shell_env, names, targets, targetId) {
  return commands.filter(command => {
    if (command["condition"] === undefined) {
      return false;
    }

    const jsoncondition = JSON.parse(command.condition);

    if ("currenthost" in jsoncondition) {   // Post Exploitation Command Check
      if (!shell_env.currenthost.match(jsoncondition.currenthost)) {
        return false;   // return false if post exploitation command and before initial shell established
      }

      if (jsoncondition.currentcommand && !shell_env.currentcommand.match(jsoncondition.currentcommand)) {
        return false; // return false if post exploitation command and currentcommand don't match with condition (ex: meterpreter command, ftp command)
      }
    } else {  // Not Post Exploication Command
      let values = Object.values(jsoncondition);
      if (checkCondition(names, values[0], targets, targetId) === -1) {
        return false;
      }
    }

    command.template = command.template.replace("{condition}", "");
    return true;
  });
}


const getVariableName = (candidate) =>
  /{([\w.]+)}/.test(candidate) && RegExp.$1;

function targetedCommands(commands, targets, targetId, shell_env) {
  if (targetId == 0) {
    return commands.filter((command) => !getVariableName(command.template));
  }
  const names = [...targetNames(targets, targetId)];
  names.push("localip");    // add localip because commands having {localip} should be displayed regardless of the selected target
  let mergedcommands = commands.filter((command) =>
    names.some(
      (
        name // get commands which don't have a filter condition
      ) => command.template?.includes(`{${name}}`)
    )
  );
  let filteredcommands = getConditionCommands(
    commands,
    shell_env,
    names,
    targets,
    targetId
  );
  if (filteredcommands.length > 0) {
    mergedcommands = [...mergedcommands, ...filteredcommands]; // merge commands which has filter
  }
  return mergedcommands;
}

/**
 * Get array of [keyNode, valueNode] in parent if a key node hits the root node
 * @param {Array<Target>} targets: target node list
 * @param {number} targetId: target id
 * @return {Array<Array<Target, Target>>}: [keyNode, valueNode] arrays
 */
function getKeyValueNodesInParents(targets, valueId) {
  let parents = [];
  let valueNode = targets[valueId];
  let keyNode;
  while ((keyNode = targets[valueNode?.parent])?.id > -1) {
    parents.push([keyNode, valueNode]);
    if (keyNode.parent === -1) return parents;
    valueNode = targets[keyNode.parent];
  }
  return [];
}

/**
 * Iterate nodes that has specified name.
 * If the name is joined ".", iterate child nodes.
 * @param {Array<Target>} targets: target node list
 * @param {number} keyId: target node id that node is key node
 * @param {string} name: name that is single word or "." joined words.
 * @return {Iterator<Target>}: nodes that has the specified name
 */
function* findNodesByName(targets, keyId, name) {
  const keyNode = targets[keyId];
  if (!keyNode || !name) return;
  if (keyNode.value === name) {
    yield keyNode;
    return;
  }
  // for "." joined name
  const [topName, ...subNames] = name.split(".");
  const subName = subNames.join(".");
  if (topName !== keyNode.value || subName.length === 0) return;
  for (const valueNode of keyNode.children.map((id) => targets[id])) {
    for (const subKeyId of valueNode?.children || []) {
      yield* findNodesByName(targets, subKeyId, subName);
    }
  }
}

/**
 * Iterate values in parent that matched the name
 * @param {Array<Target>} targets: target node list
 * @param {Target} valueId: target value node id
 * @param {string} name: name that is single word or "." joined words.
 * @return {Iterator<string>}: iterator of values
 */
function* findValuesOnValueNode(targets, valueId, name) {
  const values = {};
  for (const [keyNode, valueNode] of getKeyValueNodesInParents(
    targets,
    valueId
  )) {
    values[keyNode.id] = valueNode.value;
    for (const nameNode of findNodesByName(targets, keyNode.id, name)) {
      if (nameNode?.id in values) {
        yield values[nameNode.id];
      }
    }
  }
}

/**
 * Iterate values in parent that matched the name
 * @param {Array<Target>} targets: target node list
 * @param {Target} keyId: target key node id
 * @param {string} name: name that is single word or "." joined words.
 * @return {Iterator<string>}: iterator of values
 */
function* findValuesOnKeyNode(targets, keyId, name) {
  const valueNodes = [...findNodesByName(targets, keyId, name)].filter(
    (nameNode) => nameNode.id == keyId
  );
  if (valueNodes.length) {
    yield* valueNodes.flatMap((node) =>
      node.children.map((id) => targets[id].value)
    );
    return;
  }
  const values = {};
  for (const [keyNode, valueNode] of getKeyValueNodesInParents(
    targets,
    targets[keyId]?.parent
  )) {
    values[keyNode.id] = valueNode.value;
    for (const nameNode of findNodesByName(targets, keyNode.id, name)) {
      if (nameNode.id in values) {
        yield values[nameNode.id];
      } else if (nameNode.id == keyId) {
        yield* nameNode.children.map((valueId) => targets[valueId].value);
      }
    }
  }
}

/**
 * Return values of node that has the specified name.
 * If the name is "." joined then it may contain child node values.
 * @param {Array<Target>} targets: target node list
 * @param {Target} valueId: target value node id
 * @param {string} name: name that is single word or "." joined words.
 * @return {Array<string>]: values
 */
function findValues(targets, targetId, name) {
  const values = [...findValuesOnValueNode(targets, targetId, name)];
  if (values.length) {
    return values;
  }
  return [...findValuesOnKeyNode(targets, targetId, name)];
}

function getChildrenByIdAndValue(targets, id, value) {
  const base = targets.find(item => item.id === id);
  if(!parent) return null;

  const child = base.children.map(childId => targets.find(item => item.id === childId)).find(item => item.value === value);
  return child ? child.children : null;
}

function getNetworkRangeById(targets, id) {
  // Find the node with the specified ID
  let node = targets.find(el => el.id === id);

  // If the node is not found, return null
  if (!node) {
      return null;
  }

  // If the node's parent is 0, it is a network range, return its value
  if (node.parent === 0) {
      return node.value;
  }

  // Otherwise, find the network range of the parent
  return getNetworkRangeById(targets, node.parent);
}


/**
 * iterate commands that completely expanded template string in command by values under the targetId in targets.
 * @param {string} command: command string with template strings "{name}"
 * @param {array<Target>} valueId: target value node id
 * @param {number} targetId: target node id
 * @return {Iterator<number>}: expanded command strings
 */
function* expandVariables(command, targets, targetId) {
  const name = getVariableName(command.candidate);
  if (!name) {
    yield command;
    return;
  }
  if (name == "localip"){
    let networkrange = getNetworkRangeById(targets, targetId[0]);
    let pair = localIPandRangeList.find(el => el[0] == networkrange);
    if (pair !== undefined) {
        const candidate = command.candidate.replace(`{${name}}`, pair[1]);
        yield* expandVariables({ ...command, candidate }, targets, targetId);
    }
  } else{
    for (const value of findValues(targets, targetId, name)) {
      if (!value.includes("unknown")) {
        const candidate = command.candidate.replace(`{${name}}`, value);
        yield* expandVariables({ ...command, candidate }, targets, targetId);
      }
    }
  }
}

/**
 * iterate commands that completely expanded template string in command by values under the targetId in targets.
 * @param {string} command: command string with template strings "{name}"
 * @param {array<Target>} valueId: target value node id
 * @param {number} targetId: target node id
 * @return {Iterator<number>}: expanded command strings
 */
function* candidateCommands(commands, targets, targetId, shell_env) {
  if (targetedCommands(commands, targets, targetId, shell_env) != null) {
    commands = targetedCommands(commands, targets, targetId, shell_env).map(
      (command) => ({ ...command, candidate: command.template })
    );
  }
  for (const command of commands) {
    yield* expandVariables(command, targets, targetId);
  }
}

/**
 * uniq values in the items by key function
 * @param {array<list>} items: list items
 * @param {function} key: a function returns a uniq key string
 */
function uniq(items, key) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

exports.EchidnaAPI = EchidnaAPI;
