const express = require('express');

function router() {
  const router = express.Router();

  /* GET home page. */
  router.get('/', function (req, res, next) {
    //res.render('index', { title: 'Express' });
    res.status(404).send("Not found");
  });

  return router;
}

module.exports.router = router;
