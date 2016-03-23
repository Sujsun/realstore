var express = require('express'),
  Server = require('./utils/socket-http').Server,
  path = require('path'),
  DBHelper = require('./helper/db'),

  UserRoutes = require('./real-route/user'),
  OwnerRoutes = require('./real-route/owner'),

  Model = require('./model/model').Model,

  port,
  server,
  app,
  io;

/**
 * Express configuration
 */
function configureExpress () {
  app.use(express.static(path.join(__dirname, './public/')));
}

/**
 * Runs configurations
 */
function configure () {
  configureExpress();
  configureSocketIO(server);
}

/**
 * Socket IO configuration
 */
function attachUserRealRoutes (socket) {
  socket.on('disconnect', function () {
    console.log('Disconnected from a USER client... :(');
  });

  var server = new Server();
  server.setSocket(socket);
  UserRoutes(server);
}

function attachOwnerRealRoutes (socket) {
  socket.on('disconnect', function () {
    console.log('Disconnected from a AGENT client... :(');
  });

  var server = new Server();
  server.setSocket(socket);
  OwnerRoutes(server);
}

function configureSocketIO (server) {
  io = require('socket.io').listen(server);

  io.on('connect', function (socket) {
    socket.handshake.query.role || (socket.handshake.query.role = 'user');
    switch(socket.handshake.query.role) {
      case 'user':
        attachUserRealRoutes(socket);
        break;
      case 'owner':
        attachOwnerRealRoutes(socket);
        break;
      default:
        attachUserRealRoutes(socket);
        break;
    }
    console.log('Connected to a ' + socket.handshake.query.role + ' client... :)');

  });
}

/**
 * Runs Server
 */
function run () {
  port = Number(process.env.PORT || 5000);
  app = express();

  server = app.listen(port, function() {
    console.log('Application listening on port', port);
  });
  
  DBHelper.connect();

  Model.drop().then(function () {
    configure();
  }).catch(function () {
    configure();
  });
  
}

/**
 * Exporting
 */
module.exports = {
  run: run,
};