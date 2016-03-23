var Model = require('../model/model').Model,
    Client = require('../utils/client').global,

    sessionSync = false,

    clearModelTimeout = 15 * 1000;

module.exports = function (server) {  


  server.use('put:api/model/attributes/add', function (attributesToAdd, send) {

    Model.addAttributes(server.socket.clientId, attributesToAdd).then(function (result) {
      send(null, result.model.toObject().attributes);
      emitChanges(result.changes);
    }).catch(function (err) {
      console.error('Failed to add attributes to model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });

  });

  server.use('put:api/model/attributes/update', function (attributesToUpdate, send) {

    Model.addAttributes(server.socket.clientId, attributesToUpdate).then(function (result) {
      send(null, result.model.toObject().attributes);
      emitChanges(result.changes);
    }).catch(function (err) {
      console.error('Failed to update attributes to model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });

  });

  server.use('put:api/model/attributes/remove', function (attributesToRemove, send) {

    Model.removeAttributes(server.socket.clientId, attributesToRemove).then(function (result) {
      send(null, result.model.toObject().attributes);
      emitChanges(result.changes);
    }).catch(function (err) {
      console.error('Failed to remove attributes from model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });

  });

  server.use('put:api/model/attributes/clear', function (data, send) {

    Model.clearAttributes(server.socket.clientId).then(function (modelModel) {
      send(null, modelModel.toObject().attributes);
      emitClear();
    }).catch(function (err) {
      console.error('Failed to clear attributes from model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });

  });

  server.use('get:api/model/attributes', function (data, send) {

    Model.getModel(server.socket.clientId).then(function (modelModel) {
      send(null, modelModel.toObject().attributes);
    }).catch(function (err) {
      console.error('Failed to clear attributes from model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });

  });

  server.use('put:api/model', function (modelObject, send) {
    Model.upsert(modelObject).then(function (modelModel) {
      var socket = server.socket;
      socket.clientId = modelModel.get('clientId');
      socket.groupId = modelModel.get('groupId');
      socket.join('user_group:' + socket.groupId);
      Client.addSession(socket.clientId, socket);
      server.socket.join('user_sessions:' + socket.clientId);
      send(null, modelModel.toObject());
      console.log('User client registered. ClientId:', modelModel.get('clientId'), '\tGroupId:', modelModel.get('groupId'));
    }).catch(function (err) {
      console.error('Failed to update model. Error:', err);
      send({
        type: 'persistance_error',
        message: 'Failed to persist model object',
      });
    });
  });

  server.use('post:api/ping', function (clientId, send) {
    
  });

  server.socket.on('disconnect', function () {
    var socket = server.socket,
      clientId = server.socket.clientId;
    if (clientId) {
      Client.removeSession(clientId, socket);
      if (!Client.get(clientId)) {
        setTimeout(function () {
          deleteModel();
        }, clearModelTimeout);
      }
    }
  });

  function deleteModel () {
    var clientId = server.socket.clientId;
    if (!Client.get(clientId)) {
      Model.remove({ clientId: clientId }, function (err, noOfRemovedModels) {
        if (err) {
          console.error('Error while deleting model. Error:', err);
        } else {
          console.log('Removed model');
        }
      });
    }
  }

  server.socket.emitToOtherUserSessions = function (type, data) {
    sessionSync && sendToOtherSessions(this.clientId, this, type, data);
  };

  server.socket.emitToOwners = function (type, data) {
    server.socket.broadcast.to('owner_group:' + server.socket.groupId).emit(type, data);
  };

  function emitChanges (changes) {
    var trimmedChanges = getTrimmedChanges(changes);

    if (Object.keys(trimmedChanges).length !== 0) {
      console.log('Emiting change:', trimmedChanges);
      server.socket.emitToOtherUserSessions('change:attributes', trimmedChanges);
      server.socket.emitToOwners('change:attributes', {
        clientId: server.socket.clientId,
        changes: trimmedChanges
      });
    }
  }

  function emitClear () {
    server.socket.emitToOtherUserSessions('clear:attributes');
    server.socket.emitToOwners('clear:attributes', {
      clientId: server.socket.clientId,
    });
  }

  function getTrimmedChanges (changes) {
    var trimmedChanges = {};

    if (Object.keys(changes.addedAttributes).length !== 0) {
      trimmedChanges.addedAttributes = changes.addedAttributes;
    }

    if (changes.removedAttributes.length !== 0) {
      trimmedChanges.removedAttributes = changes.removedAttributes;
    }

    if (Object.keys(changes.changedAttributes).length !== 0) {
      trimmedChanges.changedAttributes = changes.changedAttributes;
    }
    return trimmedChanges;
  }

  function sendToOtherSessions (clientId, currentSocket, type, data) {
    var key,
        socket,
        currentSessionId = currentSocket.id;

    var client = Client.get(clientId);
    if (client) {
      for (sessionId in client.sessions) {
        if (sessionId !== 'length') {
          if (sessionId !== currentSessionId) {
            socket = client.sessions[sessionId];
            socket.emit(type, data);
          }
        }
      }
    }
  }

};