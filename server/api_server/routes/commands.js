const express = require("express");
const fs = require("fs");
const filter = require("routes/filter");

/**
 * @type {Array<Object>}
 */
let _commands = [undefined]; // [0] is not used

/**
 * @type {string}
 */
const CONFIG_DIR = "./commands";

/**
 * @type {RegExp}
 */
const CONFIG_FILE = /^command_/;
const COMMAND_LISTFILE = "commands.txt";

/**
 * @type {RegExp}
 */
const CONFIG_BEGIN = /^\W*\[Echidna\]/;
const CONFIG_COMMENT_BLOCK = /^\s*\/\*(.*)\*\/\s*$/;
const CONFIG_ITEM = /^\W*(\w+)\s*:\s*(.+?)\s*$/;
const CONFIG_END = /^\W*\[end\]/;

/**
 * Command config class
 */
class Command {
  /**
   * Constructor
   * @param {Number} id
   * @param {object} config
   */
  constructor(id, config) {
    this.id = id;
    this.update(config);
  }

  /**
   * Update contents
   * @param {object} config
   */
  update(config) {
    this.name = config.name;
    this.template = config.template;
    this.pattern = config.pattern;
    this.condition = config.condition;
    this.group = config.group;
    this.output = config.output;
  }

  /**
   * Get command config information
   * @returns {object}
   */
  info() {
    return {
      id: this.id,
      name: this.name,
      template: this.template,
      pattern: this.pattern,
      condition: this.condition,
      group: this.group,
      output: this.output,
    };
  }
}

/**
 * read a file
 * @param {string} fileName
 * @returns {Array<string>}
 */
function configFileNames() {
  try {
    return fs.readdirSync(CONFIG_DIR).filter((name) => CONFIG_FILE.test(name));
  } catch (err) {
    console.log(`[Command] fail to load commands [${err.message}]`);
    return [];
  }
}

/**
 * read a file
 * @param {string} fileName
 * @returns {String}
 */
function readFile(fileName) {
  try {
    return fs.readFileSync(`${CONFIG_DIR}/${fileName}`, "utf8");
  } catch (err) {
    console.log(`[Command] fail to load a command [${err.message}]`);
    return "";
  }
}

/**
 * Load command configs
 */
function load() {
  const loaders = [configsInScriptFiles, configsInListFile];
  for (const loader of loaders) {
    for (const config of loader()) {
      add(config);
    }
  }
}

function* configsInScriptFiles() {
  for (const fileName of configFileNames()) {
    yield* configs(readFile(fileName).toString(), fileName);
  }
}

function* configsInListFile() {
  const text = readFile(COMMAND_LISTFILE).toString();
  const lines = text.toString().split("\n");
  let section = "";
  for (const line of lines) {
    section += line + "\n";
    if (CONFIG_END.test(line)) {
      yield* configs(section);
      section = "";
    }
  }
}

/**
 * iterate config in the script
 * @param {string} lines: config lines
 * @param {string} scriptFileName; script file name
 * @returns {Iterator<object>}
 * @throws Will throw an error if the config file is incorrect.
 */
function* configs(lines, scriptFileName = "") {
  const patterns = [];
  let condition = "";
  let group;
  const candidates = [];
  let candidate = {};
  for (const { name, value } of configSection(lines.split("\n"))) {
    if (name === "pattern") {
      patterns.push(value);
    } else {
      candidate[name] = value;
      if (candidate.name && candidate.template) {
        candidates.push(candidate);
        candidate = { name: candidate.name };
      }
      if (candidate.name && candidate.condition) {
        condition = candidate.condition;
      }
      if (candidate.name && candidate.group) {
        group = candidate.group;
      }
    }
  }
  const output = { script: scriptFileName };
  for (const pattern of patterns) {
    for (const candidate of candidates) {
      if (condition) {
        if (candidate.template.indexOf("{condition}") == -1) {
          candidate.template = candidate.template + " {condition}";
        }
        yield { pattern, ...candidate, condition, group, output };
      } else {
        yield { pattern, ...candidate, group, output };
      }
    }
  }
}

/**
 * iterate config name and value in the script
 * @param {Array<string>} lines
 * @returns {Iterator<object>}
 * @throws Will throw an error if the config file is incorrect.
 */
function* configSection(lines) {
  let i = 0;
  while (i < lines.length && !CONFIG_BEGIN.test(lines[i++]));
  for (; i < lines.length && !CONFIG_END.test(lines[i]); i++) {
    const line = CONFIG_COMMENT_BLOCK.test(lines[i]) ? RegExp.$1 : lines[i];
    if (CONFIG_ITEM.test(line)) {
      yield { name: RegExp.$1, value: RegExp.$2 };
    }
  }
}

/**
 * Get a command config
 * @param {number} id - command id
 * @returns {Object|undefined}
 */
function get(id) {
  return _commands[id];
}

/**
 * Create a command
 * @param {object} command
 * @returns {Command}
 */
function add(config) {
  const command = new Command(_commands.length, config);
  _commands[_commands.length] = command;
  console.log(
    `[Command] add ${command.id} "${command.pattern}" "${command.template}" "${command.condition}"`,
    command.output
  );
  return command;
}

/**
 * Modify a command
 * @param {object} command
 * @returns {Command|undefined}
 */
function modify(config) {
  const command = get(config.id);
  command?.update(config);
  return command;
}

/**
 * Delete a command
 * @param {number} id
 */
function destroy(id) {
  delete _commands[id];
}

/**
 * Delete all commands
 */
function destroyAll() {
  _commands = [undefined];
}

/**
 * Find commands matched command pattern
 * @param {string} commandLine
 * @returns {Array<Command>}
 */
function find(commandLine) {
  commandLine = commandLine.replace(/[ \t]*\n/g, "")
                           .replace(/^[ \t]+/, "")
                           .replace(/[ \t]+/g, " ");
  const matchedCommands = _commands.filter(
    (command) =>
      command?.pattern && commandLine.match(new RegExp(command.pattern))
  );
  return matchedCommands;
}

/**
 * Uniq commands by output filter
 * @param {Array<Command>} commands
 * @returns {Array<Command>}
 */
function uniqByFilter(commands) {
  const filterCommands = commands
    .filter((command) => command.output?.script || command.output?.targets)
    .map((command) => [
      command.output.script || command.output.targets,
      command,
    ]);
  const uniqFilterCommands = [...new Map(filterCommands).values()];
  return uniqFilterCommands;
}

/**
 * Get commands to filter targets
 * @param {number} targetId
 * @param {string} commandLine
 * @param {string} hostName
 * @returns {Array.<Object>}
 */
function getFilters(terminalId, targetId, commandLine, hostName) {
  const filters = [];
  const foundCommands = uniqByFilter(find(commandLine));
  foundCommands.forEach((command) => {
    if (command.output.script) {
      const scriptFilter = filter.createScript(
        terminalId,
        targetId,
        command.id,
        command.output.script,
        commandLine,
        hostName
      );
      filters.push(scriptFilter);
    }
    command.output?.targets?.forEach((target) => {
      if (target.pattern) {
        const regexpFilter = filter.createRegExp(
          terminalId,
          targetId,
          target.name,
          target.pattern
        );
        filters.push(regexpFilter);
      }
    });
  });
  return filters;
}

function router() {
  const router = express.Router();

  /**
   * REST API routing
   * GET - command config listing
   */
  router.get("/", function (req, res, next) {
    console.log(`[Command] GET all from ${req.hostname}`);
    res.send(JSON.stringify(_commands.filter((command) => command)));
  });

  /**
   * REST API routing
   * GET - get a part of command config
   */
  router.get("/:id", function (req, res, next) {
    console.log(`[Command] GET ${req.params.id} from ${req.hostname}`);
    const config = get(req.params.id);
    res.send(JSON.stringify(config));
  });

  /**
   * REST API routing
   * POST - command config addition
   */
  router.post("/", function(req, res, next) {
  	if (
  		//      req.body.form.patterns && req.body.form.patterns !== "" &&
  		req.body.form.templates && req.body.form.templates !== "" && req.body.form
  		.name && req.body.form.name !== "") {
  		console.log(
  			`[Command] POST "${req.body.form.condition}", from ${req.hostname}`);
  		let outputText =
  			`
[Echidna]
pattern: any command is fine since no parser script
name: ${req.body.form.name}
`
  		let config = [];
  		for (const postedTemplate of req.body.form.templates) {
  			outputText += 'template: ' + postedTemplate + '\n';
  			config.template = postedTemplate;
  			//          write(config);
  		}
  		config.name = req.body.form.name;
  		if (req.body.form.condition != "") {
  			outputText += "condition: " + req.body.form.condition + "\n";
  			config.condition = req.body.form.condition;
  		}
  		config.group = req.body.form.group;
  		add(config);
  		outputText += "group: " + req.body.form.group + "\n[end]\n";
  		fs.appendFile("commands/" + COMMAND_LISTFILE, outputText, er => {
  				if (er) throw er
  			})
  			//  		console.log("outputText=", outputText);
  		res.send(outputText);
  	} else {
  		console.log(`[Command] POST invalid from ${req.hostname}`);
  		res.send("{}");
  	}
  });

  /**
   * REST API routing
   * PUT - command config update
   */
  router.put("/", function (req, res, next) {
    if (
      "id" in req.body &&
      "name" in req.body &&
      "template" in req.body &&
      "pattern" in req.body &&
      "output" in req.body &&
      ("script" in req.body.output || "targets" in req.body.output)
    ) {
      console.log(
        `[Command] PUT ${req.body.id} "${req.body.template}" from ${req.hostname}`
      );
      const config = modify(req.body);
      res.send(JSON.stringify(config || {}));
    } else {
      console.log(`[Command] PUT invalid from ${req.hostname}`);
      res.send("{}");
    }
  });

  /**
   * REST API routing
   * DELETE - command config deletion
   */
  router.delete("/", function (req, res, next) {
    console.log(`[Command] DELETE all from ${req.hostname}`);
    destroyAll();
    res.send("[]");
  });

  /**
   * REST API routing
   * DELETE - command config deletion
   */
  router.delete("/:id", function (req, res, next) {
    console.log(`[Command] DELETE ${req.params.id} from ${req.hostname}`);
    destroy(req.params.id);
    res.send("{}");
  });

  return router;
}

module.exports.setup = load;
module.exports.get = get;
module.exports.add = add;
module.exports.getFilters = getFilters;
module.exports.router = router;
