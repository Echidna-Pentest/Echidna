const fs = require("fs");

const CRITICALSCAN_FILE = "./criticalscandb.json";
let criticalscandb = [];

function setup() {
  if (!fs.existsSync(CRITICALSCAN_FILE)) {
    return;
  }
  const attackJson = fs.readFileSync(CRITICALSCAN_FILE);
  if (!attackJson) {
    return;
  }
  criticalscandb = JSON.parse(attackJson);
}

function getValues(key) {
  const extractedValues = criticalscandb.map((obj) => obj[key]);
  return extractedValues;
}

function searchValue(key, targetvalue, obj=criticalscandb, machineName=null) {
  for (let prop in obj) {
    if (typeof obj[prop] === 'object' && obj[prop]) {
      let result = searchValue(key, targetvalue, obj[prop], obj[prop].machine_name);
      if (result) {
        if (machineName != null) result.machine_name = machineName;
        return result;
      }
    } else if (prop === key && targetvalue.includes(obj[prop])) {
        return obj;
    }
  }
  return false;
}

module.exports.setup = setup;
module.exports.getValues = getValues;
module.exports.searchValue = searchValue;
