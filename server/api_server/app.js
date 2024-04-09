const createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const notifier = require('./routes/notifier');

const index = require('./routes/index');
//const usersRouter = require('./routes/users');
const chats = require('./routes/chats');
const terminals = require('./routes/terminals');
const commands = require('./routes/commands');
const targets = require('./routes/targets');
const login = require('./routes/login');
const criticalscandb = require('./routes/criticalscandb');

// start notifiy server (web socket)
notifier.setup();
criticalscandb.setup();

const app = express();
app.use(cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index.router());
//app.use('/users', users.router);
app.use('/terminals', terminals.router());
app.use('/commands', commands.router());
app.use('/targets', targets.router());
app.use('/chats', chats.router());
app.use('/login', login.router());


terminals.setup();
chats.setup();

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  //res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.locals.error = {};
  res.locals.title = "EchidnaServer"

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
