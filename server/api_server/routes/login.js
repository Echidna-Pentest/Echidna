const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const USER_DATA_FILE = "./users.json";

/*
class login {
  getUser(username) {
    const users = getUsersFromFile();
    return users[username];
  }

  saveUser(user) {
    const users = getUsersFromFile();
    users[user.username] = user;
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users));
  }
}
*/

// Define a function to read the user information from the file
function readUserData() {
  const data = fs.readFileSync(USER_DATA_FILE, "utf8");
  return JSON.parse(data);
}

// Define a function to authenticate a user
async function authenticateUser(username, password) {
  const userData = readUserData();
  const user = userData[username];
  if (!user) {
    return false; // User not found
  }
  const match = await bcrypt.compare(password, user.password);
  return match;
}

function router() {
  const router = express.Router();

  /**
   * REST API routing
   * GET - list terminals
  router.get("/", function (req, res, next) {
//    console.log(`[Terminal] GET all from ${req.hostname}`);
//    res.send(JSON.stringify(_terminals));
  });
   */

  router.post("/", function (req, res, next) {
//    console.log("login.js hoge req.body.id=", req.body.id, " req.body.pass=", req.body.pass);
    authenticateUser(req.body.id, req.body.pass)
      .then((result) => {
//        console.log(result);
        if (result) {
          res.send({
            message: "SUCCESS",
          });
        } else {
          res.send({
            message: "Login Failed",
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });
  return router;
}

module.exports.router = router;
