var Model = require('../model/model').Model,
    Client = require('../utils/client').global;

module.exports = function (server) {  

  server.use('get:api/model/count', function (attributesQuery, send) {

    var clientId = server.socket.clientId,
        groupId = server.socket.groupId;

    if (!groupId || !clientId) {
      send({
        type: 'not_registered',
        message: 'You have not yet registered to access data',
      });
    } else {
      Model.getModelsByGroupId(groupId, attributesQuery).then(function (modelsArray) {
        send(undefined, modelsArray.length);
      }).catch(function (err) {
        console.log('Error while retrieving count. Error:', err);
        send({
          type: 'database_error',
          message: 'Failed to read models',
        });
      });
    }
  });

  server.use('get:api/model', function (queryObject, send) {

    var clientId = server.socket.clientId,
        groupId = server.socket.groupId;

    if (!groupId || !clientId) {
      send({
        type: 'not_registered',
        message: 'You have not yet registered to access data',
      });
    } else {
      Model.getModelsByGroupId(groupId, queryObject.query).then(function (modelsArray) {
        send(undefined, modelsArray);
      }).catch(function (err) {
        console.log('Error while reading models. Error:', err);
        send({
          type: 'database_error',
          message: 'Failed to read models',
        });
      });
    }
  });

  server.use('put:api/register', function (ownerObject, send) {
    server.socket.groupId = ownerObject.groupId;
    server.socket.clientId = ownerObject.clientId;
    server.socket.join('owner_group:' + server.socket.groupId);
    server.socket.join('owner_sessions:' + server.socket.clientId);
    Client.addSession(server.socket.clientId, server.socket);

    send(undefined, ownerObject);
    console.log('Owner client registered. GroupId:', server.socket.groupId);
  });

  server.use('post:api/user/custom_message/emit', function (dataObject, send) {
    var clientId = dataObject.clientId,
        message = dataObject.message;

    emitCustomMessageToUser(clientId, {
      clientId: server.socket.clientId,
      message: message,
    });
    send(undefined, dataObject);
  });

  server.socket.on('disconnect', function () {
    var socket = server.socket,
      clientId = server.socket.clientId,
      grouptId = server.socket.groupId;

    if (clientId) {
      server.socket.leave('owner_sessions:' + server.socket.clientId);
      Client.removeSession(clientId, socket);
    }
    if (grouptId) {
      server.socket.leave('owner_group:' + server.socket.groupId);
    }
  });

  function emitCustomMessageToUser (clientId, message) {
    server.socket.broadcast.to('user_sessions:' + clientId).emit('custom_message', message);
  }

};