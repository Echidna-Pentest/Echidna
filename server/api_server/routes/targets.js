const express = require('express');
const fs = require('fs');
const notifier = require('routes/notifier');
const criticalscandb = require('routes/criticalscandb');
const child_process = require('child_process');
const chats = require('routes/chats');

/**
 * @type {string}
 */
const SAVE_FILE = './data/targets.json';
const REPORT_FILE = './data/report.md';

/**
 * @type {Array<Target>}}
 */
const _targets = [];

/**
 * Target class
 */
class Target {
  /**
   * Constructor
   * @param {number} id
   * @param {string} value
   * @param {number} parentId
   */
  constructor(id, value, parentId, children = [], metadata = {}) {
    this.id = id;
    this.value = value;
    this.parent = parentId;
    this.children = children;
    this.metadata = metadata;
    _targets[this.id] = this;
    console.log(`[Target] add ${this.id} ${this.parent} "${this.value}"`);
  }

  /**
   * add a value as a child
   * @param {string} value
   * @returns {Target}
   */
  add(value) {
    for (let childId of this.children) {
      if (_targets[childId]?.value === value) {
        return _targets[childId];
      }
    }

    const child = new Target(_targets.length, value, this.id, [], {"notify":"changed"});
    this.children.push(child.id);
    store();
    notify();
    return child;
  }

  /**
   * remove a child
   * @param {number} childId
   */
  remove(childId) {
    const index = this.children.indexOf(childId);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
  }

  /**
   * move node (change parent)
   * @param {number} oldParentId
   * @param {number} newParentId
   */
  move(oldParentId, newParentId) {
    console.debug("move: target", this, oldParentId, newParentId);
    const newParent = get(newParentId);
    if (newParentId == this.id || !newParent || this.includes(newParentId)) {
        return false;
    }
    this.unlink(oldParentId);
    this.parent = newParent.id;
    if (!newParent.children.includes(this.id)) {
      newParent.children.push(this.id);
    }
    console.debug("moved: target", this);
    console.debug("moved: parent", newParent);
    return true;
  }

  /**
   * unlink node (remove this from parent)
   * @param {number} parent id
   */
  unlink(parentId) {
    const parent = parentId >= 0 ? get(parentId) : get(this.parent);
    parent?.remove(this.id);
    if (this.id === parentId) {
      this.parent = -1;
      const newParent = _targets.find(target => target.children.includes(this.id));
      if (newParent) {
        this.parent = newParent.id;
      }
    }
  }

  /**
   * matching values
   * @param {Array<String>} values
   * @returns {boolean}
   */
  hasValues(values) {
    return values.length === 0 ||
           this.children.map(childId => get(childId))
                        .filter(child => child.value === values[0])
                        .some(child => child.hasValues(values.slice(1)));
  }

  /**
   * return true if exist the target in its children nodes.
   * @param {number} targetId
   * @returns {boolean}
   */
  includes(targetId) {
    return this.children.some(childId => childId == targetId ||
                                         get(childId)?.includes(targetId));
  }

  /**
   * Get target information
   * @returns {object}
   */
  info() {
    return {
      id: this.id,
      value: this.value,
      parent: this.parent,
      children: this.children,
    };
  }
}

/**
 * Load targets data
 */
function load() {
  if (!fs.existsSync(SAVE_FILE)) {
    return;
  }
  const targetsJson = fs.readFileSync(SAVE_FILE);
  if (!targetsJson) {
    return;
  }
  const targets = JSON.parse(targetsJson);
  for (const target of targets) {
    new Target(target.id, target.value, target.parent, target.children);
  }
}

function findExploit(target){
  const versionNode = getChildren(target.id)[0];
  if (versionNode.hasValues(["exploitPath"])==false){
    let version = versionNode.value;
    while (version){
      const searchExploit = "searchsploit \"" + version + "\" --exclude='dos' --disable-colour -j";
//      console.log("searchExploit=", searchExploit);
      child_process.exec(searchExploit, (err, stdout, stderr) => {
        try {
          const exploitCodes = JSON.parse(stdout);
          if (exploitCodes.RESULTS_EXPLOIT.length > 10){
            return;
          }else if (exploitCodes.RESULTS_EXPLOIT.length != 0){
            for (const key in exploitCodes.RESULTS_EXPLOIT){
              const exploitTitleNode = add(target.id, exploitCodes.RESULTS_EXPLOIT[key]["Title"]);
              const exploitPathNode = add(exploitTitleNode.id, "exploitPath");
              add(exploitPathNode.id, exploitCodes.RESULTS_EXPLOIT[key]["Path"]);
            }
            return;
          }
        } catch(e) {
          console.log("[Parse Error] searchExploit Command=", searchExploit);
          return;
        }
      })
      if (version.includes("-")){
        version = version.substring(0, version.lastIndexOf("-"));
      } else if (version.includes("")){
        version = version.substring(0, version.lastIndexOf(" "));
      } else{
        return;
      }
    }
  }
}

function findChildOfHost(target, nodes) {
  let currentNode = target;

  while (currentNode.parent !== -1) {
    const parentNode = _targets[currentNode.parent];
    if (parentNode.value === "host") {
      return currentNode;
    }
    currentNode = parentNode;
  }
  return null;
}


/**
 * Analyze targets data
 */
function analyzeTarget() {
  let changedTarget = "";   //changed text for AI analysis
  for (const target of _targets) {
    const result = criticalscandb.searchValue("CriticalScan", target.value);
    if (result !== false) {
//        console.log("criticalscandb match target=", target.value, " criticalscandb=", result);
      target.metadata.critical = "high";
      target.metadata.machine = result.machine_name;
    }
    if (target.metadata.notify == "changed"){
      if (_targets[target.parent].value != "host"){
        if (target.value.indexOf('Nmap done') === -1){
          changedTarget += target.value + "\n";
        }
      }
    }
    if (target.value == "version"){
      findExploit(target);
    }
    if (target.value == "OS"){
      const childOfHost = findChildOfHost(target, _targets);
      childOfHost.metadata.os = _targets[target.children].value;
//      _targets[targetId].metadata.os = inputdata.os;
    }
  }
//  console.log("AnalyzeTarget: changedTarget=", changedTarget);
  chats.analysis(changedTarget);
  store();
  notify();
}


/**
 * Save targets data
 */
function store() {
//  analyzeTarget();
  const targetsJson = JSON.stringify(_targets);
  fs.writeFileSync(SAVE_FILE, targetsJson);
}

/**
 * remove metadata notify data
 */
function removeNotify() {
  _targets.filter(t => t.metadata.notify === 'changed')
  .forEach((t) => delete t.metadata.notify);
}

/**
 * add a target
 * @param {number} parentId
 * @param {string} value
 * @returns {Target|undefined}
 */
function add(parentId, value) {
  const parent = get(parentId);
  const target = parent?.add(value);
  return target;
}

/**
 * move a target from in oldParentId node into newParentId node
 * @param {number} targetId
 * @param {number} oldParentId
 * @param {number} newParentId
 */
function move(targetId, oldParentId, newParentId) {
  get(targetId)?.move(oldParentId, newParentId);
  store();
  notify();
}

/**
 * unlink the target from the parent node.
 * @param {number} targetId
 * @param {number} parentId
 */
function unlink(targetId, parentId) {
  if (targetId === 0) {
    _targets.splice(0);
  } else {
    get(targetId)?.unlink(parentId);
  }
  store();
  notify();
}

/**
 * Get a target
 * @param {number} targetId
 * @returns {Target|undefined}
 */
function get(targetId) {
  if (targetId === 0 && !_targets[0]) {
    _targets[0] = new Target(0, 'target-network', -1);
    store();
    notify();
  }
  return _targets[targetId];
}

/**
 * Get target children
 * @param {number} targetId
 * @returns {Array.<Target>}
 */
function getChildren(targetId) {
  const children = get(targetId)?.children.map(child => get(child));
  return children;
}

/**
 * Create markdown file from TargetTree for reporting
 * Create "Detailed Service Information" section
 */
function exportServiceInfo(stream, ipaddress){
  for (const portnode of getChildren(ipaddress.id)){
    if (portnode.value == "port"){
      const ports = getChildren(portnode.id);
      // get port list and write
      for (const port of ports){
        stream.write(port.value+ ", ");
      }

      stream.write("\n\n### Detailed Service Information\n");
      // get detailed information under port node
      for (const port of ports){
        stream.write("* Port - " + port.value + "\n");
        for (const portinfonode of getChildren(port.id)){
          stream.write("\t* " + portinfonode.value + "\n");
          for (const scanResults of getChildren(portinfonode.id)){
            stream.write("\t\t* " +  scanResults.value + "\n");
          }
        }
      }
    }
    stream.write("\n\n");
  }
}


/**
 * Create markdown file from TargetTree for reporting
 */
function exportTarget(){
  const TARGETNETWORKID = 0;
  const networks = getChildren(TARGETNETWORKID);
  const stream = fs.createWriteStream(REPORT_FILE);
  stream.write("# Methodologies\n");

  let hostcounter = 1;
  for (const network of networks){
    const hosts = getChildren(network.children);
    for (const host of hosts){
      if (host.id != 3){    // skip local host
        let ipaddress;
        if(host.value.indexOf('unknown') != -1){
          ipaddress = get(get(host.children).children);
        }else{
          ipaddress = host;
        }
        stream.write("## Target " + hostcounter + " - " + ipaddress.value + " \n");
        hostcounter = hostcounter + 1;
        stream.write(`
### Service Enumeration
**Port Scan Results**
Server IP Address | Ports Open
------------------|----------------------------------------
${ipaddress.value} | **TCP**: `);
        exportServiceInfo(stream, ipaddress);
      }
    }
  }
  stream.end("\n");
}


function searchTree(searchString) {
  let stack = [], searchResult = [], node;
  stack.push(_targets[0]);
  while (stack.length > 0) {
      node = stack.pop();
      if (node.value.includes(searchString)) {
        let parentNode = node;
        while (parentNode.id != 0){
          parentNode = _targets[parentNode.parent];
          if (!searchResult.some(el => el.id === parentNode.id)) searchResult.push(parentNode);
        }
      } else if (node.children && node.children.length) {
          for (let i = 0; i < node.children.length; i += 1) {
              stack.push(_targets[node.children[i]]);
          }
      }
  }
  return searchResult;
}

function find(value) {
  return _targets.filter(node => node.value == value);
}

function findPair(name, value) {
  return find(name).filter(node =>
    node.children.some(child => _targets[child]?.value == value));
}

/**
 * Notify targets update
 */
function notify() {
  const message = JSON.stringify({ type: 'targets' });
  notifier.send(message);
}

/**
 * return all nodes of the given id and vlaue
 */
function getChildrenByIdAndValue(id, value) {
  const base = _targets.find(item => item.id == id);
  if(!base) return null;
  const child = base.children.map(childId => _targets.find(item => item.id == childId)).find(item => item.value == value);
  let values = child ? child.children.map(childId => _targets.find(item => item.id == childId).value) : null;
  return values;
}

/**
 * return all children of the given id
 */
function getAllChildren(id, data=_targets) {
  let result = [];
  let target = data.find(item => item.id == id);  //find the target node of the given id

  if (!target) return result;

  result.push(target);
  for (let childId of target.children) {
    result = result.concat(getAllChildren(childId, data));
  }
  return result;
}

// update or add target when user input target data
function updateTarget(targetId, inputdata){
  const parentnode = get(get(targetId).parent);
  /* comment out this code until the parser's output when the hostname changes is finalized
  if (inputdata.hostname && parentnode.value == "host"){
    _targets[targetId].value = inputdata.hostname;
  }
  */
  if (inputdata.os && parentnode.value == "host"){
    let isOSExists = false; 
    _targets[targetId].children.forEach(childId => {
      if (_targets[childId].value == "os") {  // change the value of os child node if os node exists
        _targets[_targets[childId].children].value = inputdata.os;
        isOSExists = true;
      }
    });
    if (isOSExists == false){ // add os node if os node don't exists
      add(add(targetId, 'os').id, inputdata.os);
    }
    _targets[targetId].metadata.os = inputdata.os;
  }
  if (inputdata.root == "yes" && parentnode.value == "host"){
    _targets[targetId].metadata.root = "yes";
  }else if (inputdata.root == "no" && parentnode.value == "host"){
    _targets[targetId].metadata.root = "no";
  }
  if (inputdata.Credential.userid!== "" || inputdata.Credential.password!== ""){
    const usernode = add(add(targetId, 'user').id, inputdata.Credential.userid);
    add(add(usernode.id, 'pass').id, inputdata.Credential.password);
  }
  if(inputdata.notes !== ""){
    if (inputdata.notes.includes("\\t")) {
      let parentId = targetId;
      inputdata.notes.split("\\t").forEach(function(note) {
        parentId = add(parentId, note).id;
      });
    }else{
      add(targetId, inputdata.notes);
    }
  }
  store();
  notify();
}

function router() {
  const router = express.Router();

  /**
   * REST API routing
   * GET - all targets
   */
  router.get('/', function (req, res, next) {
//    console.log(`[Target] GET all from ${req.hostname}`);
    get(0);  // create the root node if targets are empty
    res.send(JSON.stringify(_targets));
  });

  /**
   * REST API routing
   * GET - target
   */
  router.get('/:targetId', function (req, res, next) {
//    console.log(`[Target] GET ${req.params.targetId} from ${req.hostname}`);
    const target = get(Number(req.params.targetId));
    if (target) {
      res.send(JSON.stringify(target.info()));
    } else {
      res.status(404).send("Not found");
    }
  });

  /**
   * REST API routing
   * GET - target children
   */
  router.get('/:targetId/children', function (req, res, next) {
//    console.log(`[Target] GET ${req.params.targetId} children from ${req.hostname}`);
    const targets = getChildren(Number(req.params.targetId));
    if (targets) {
      res.send(JSON.stringify(targets));
    } else {
      res.status(404).send("Not found");
    }
  });

    /**
   * REST API routing
   * GET - target children
   */
  router.get('/searchTree/:searchString', function (req, res, next) {
    const targets = searchTree(req.params.searchString);
    res.send(JSON.stringify(targets));
  });

  /**
   * REST API routing
   * POST - export a target tree to md file
   */
  router.get('/export/target', function (req, res, next) {
    exportTarget();
    res.send(JSON.stringify("done"));
  });

  /**
   * REST API routing
   * POST - download a exported report
   */
  router.get('/export/download', function (req, res, next) {
    res.download(REPORT_FILE);
  });

  /**
   * REST API routing
   * POST - add a target to specified node
   */
  router.post('/:targetId', function (req, res, next) {
    removeNotify();
    console.log(`[Target] POST ${req.params.targetId} "${req.body.name}" from ${req.hostname}`);
    let target = get(Number(req.params.targetId));
    if (target && req.body.name) {
      target = add(target.id, req.body.name);
    }
    res.send(JSON.stringify(target?.info() || {}));
  });

  /**
   * REST API routing
   * POST - update inputed target by user to specified node
   */
   router.post('/updatetarget/:targetId', function (req, res, next) {
    removeNotify();
    console.log(`[Update Target] targetId: ${req.params.targetId} hostname "${req.body.inputdata.hostname}"`);
    updateTarget(req.params.targetId, req.body.inputdata);
//    res.send(JSON.stringify(target?.info() || {}));
  });


    /**
   * REST API routing
   * POST - return all children of the given target Id and value
   */
     router.post('/getchildrenbyId/:targetId', function (req, res, next) {
//       console.log(`[Update Target] targetId: ${req.params.targetId} hostname "${req.body.inputdata.hostname}"`);
      const childtargets = getChildrenByIdAndValue(req.params.targetId, req.body.value);
      res.send(childtargets);
    });


    /**
   * REST API routing
   * POST - return all children of the given target Id
   */
     router.post('/getallchildren/:targetId', function (req, res, next) {
      const childtargets = getAllChildren(req.params.targetId);
      res.send(JSON.stringify(childtargets));
    });

  /**
   * REST API routing
   * PUT - change a member of a specified node
   */
  router.put('/:targetId', function (req, res) {
    const targetId = req.params.targetId;
    console.log(`[Target] PUT ${targetId}`, req.body, `from ${req.hostname}`);
    if (req.body.parent) {
      const [oldParentId, newParentId] = req.body.parent;
      move(Number(targetId), Number(oldParentId), Number(newParentId));
    }
    res.send(JSON.stringify(get(Number(targetId))?.info() || {}));
  });

  /**
   * REST API routing
   * DELETE - unlink the target from the parent node.
   */
  router.delete('/:targetId', function (req, res, next) {
    const targetId = req.params.targetId;
    const parentId = req.body.parentId;
    console.log(`[Target] DELETE ${targetId} parent ${parentId} from ${req.hostname}`);
    unlink(Number(targetId), Number(parentId));
    res.send('{}');
  });

  return router;
}

module.exports.setup = load;
module.exports.get = get;
module.exports.add = add;
module.exports.findPair = findPair;
module.exports.router = router;
module.exports.removeNotify = removeNotify;
module.exports.analyzeTarget = analyzeTarget;
