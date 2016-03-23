var $ = require('jquery'),
    UID = require('../util/uid'),
    Events = require('minivents'),
    BrowserStore = require('../util/browser-store'),

    io = require('socket.io-client'),
    Model = require('model'),
    Client = require('../../../../../utils/socket-http').Client;

var plugin = {
  name: 'RealStore',
  description: 'Maintain server model with realtime change events',
  accessVariable: 'RealStore',
  version: '0.0.1'
};

function Owner (groupId, options) {
  this.options = options || {};
  this.groupId = groupId;
  this.options.storeKey || (this.options.storeKey = 'realstore-owner-clientid');
  this.options.storePrefix || (this.options.storePrefix = '');
  this.options.storePostfix || (this.options.storePostfix = '');
  this.event = new Events();
  this._generateStoreKeys();
  this._userModels = {};
}

Owner.prototype.connect = function () {
  if (!this._connectDeferred) {
    this._connectDeferred = this._connect();
  }
  return this._connectDeferred;
};

Owner.prototype.disconnect = function () {
  if (!this._socket) {
    this._socket.disconnect();
    delete this._isConnected;
  }
  return this._socket;
};

Owner.prototype._connect = function () {
  this.clientId = this.getClientId();
  this._client || (this._client = new Client());
  this._socket || (this._socket = io(undefined, {query: 'role=owner'}));
  this._client.setSocket(this._socket);
  return this._initialRegister();
};

Owner.prototype._initialRegister = function () {
  var self = this;
  return this._register().then(function () {
    self._attachSocketEvents();
    return $.Deferred().resolve().promise();
  })
};

Owner.prototype._intermediateRegister = function () {
  var self = this;
  return this._register().then(function () {
    return $.Deferred().resolve().promise();
  })
};

Owner.prototype._register = function () {
  return this._request('put:api/register', {
    groupId: this.groupId,
    clientId: this.clientId,
  });
};

Owner.prototype.queryUser = function (query, sort) {
  return this._queryUser({
    query: query,
    sort: sort,
  });
};

Owner.prototype.queryUserCount = function (query) {
  return this._queryUserCount(query);
};

Owner.prototype._queryUser = function (queryObj) {
  var self = this;
  return this._request('get:api/model', queryObj).then(function (userObjects) {
    var deferred = $.Deferred();
    deferred.resolve(self._addUserModels(userObjects));
    return deferred.promise();
  });
};

Owner.prototype._addUserModel = function (userObject) {
  var self = this,
      userModel = this.getUserModel(userObject.clientId);
  if (!userModel) {
    userModel = new Model(userObject.attributes);
    userModel.clientId = userObject.clientId;
    userModel.emitMessage = function (message) {
      return self._emitCustomMessageToUser(this.clientId, message);
    };
    this._userModels[userObject.clientId] = userModel;
  }
  return userModel;
};

Owner.prototype._emitCustomMessageToUser = function (clientId, message) {
  return this._request('post:api/user/custom_message/emit', {
    clientId: clientId,
    message: message,
  });
};

Owner.prototype._addUserModels = function (userObjects) {
  var index,
      userObject,
      userModels = [];

  for (index in userObjects) {
    userObject = userObjects[index];
    userModels.push(this._addUserModel(userObject));
  }
  return userModels;
};

Owner.prototype.getUserModel = function (clientId) {
  return this._userModels[clientId];
};

Owner.prototype._queryUserCount = function (query) {
  return this._request('get:api/model/count', query);
};

Owner.prototype._request = function (method, data) {
  var deferred = $.Deferred();
  this._client.request(method, data, function (err, result) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(result);
    }
  });
  return deferred.promise();
};

Owner.prototype._attachSocketEvents = function () {
  var self = this;
  this._socket.on('disconnect', function () {
    self._onSocketDisconnect.apply(self, arguments);
  });
  this._socket.on('connect', function () {
    self._onSocketConnect.apply(self, arguments);
  });
  this._socket.on('custom_message', function () {
    self._onCustomMessage.apply(self, arguments);
  });
  this._socket.on('change:attributes', function () {
    self._onAttributesChangeMessage.apply(self, arguments);
  });
  this._socket.on('clear:attributes', function () {
    self._onAttributesClearMessage.call(self);
  });
  
};

Owner.prototype.on = function () {
  this.event.on.apply(this.event, arguments);
};

Owner.prototype.off = function () {
  this.event.off.apply(this.event, arguments);
};

Owner.prototype.emit = function () {
  this.event.emit.apply(this.event, arguments);
};

Owner.prototype._attachModelEvents = function () {
  var self = this;
  if (this.model && !this.isModelEventsAttached) {
    this.model.on('change', function (changes) {
      self._onModelChangeThrottled.apply(self, arguments);
    });
  }
};

Owner.prototype._onModelChange = function (changes) {
  var index,
      changesLength = changes.length,
      addedAttributes = {},
      removedAttributes = [],
      changedAttributes = {};

  console.log('---- Changed:', changes);

  for (index = 0; index < changesLength; index++) {
    change = changes[index];
    switch (change.action) {
      case 'add':
        addedAttributes[change.attributeName] = change.newValue;
        break;
      case 'remove':
        removedAttributes.push(change.attributeName);
        break;
      case 'change':
        changedAttributes[change.attributeName] = change.newValue;
        break;
    }
  }

  if (Object.keys(addedAttributes).length !== 0) {
    this._addAttributes(addedAttributes);
  }

  if (removedAttributes.length !== 0) {
    this._removeAttributes(removedAttributes);
  }

  if (Object.keys(changedAttributes).length !== 0) {
    this._updateAttributes(changedAttributes);
  }

};

Owner.prototype._onCustomMessage = function (dataObject) {
  var self = this,
      fromClientId = dataObject.clientId,
      message = dataObject.message;

  this._getUserModel(dataObject.clientId).then(function (userModel) {
    userModel.emit('custom_message', message);
    self.emit('custom_message', userModel, message);
  });
};

Owner.prototype._getUserModel = function (clientId) {
  var self = this,
      userModel = this._userModels[clientId],
      deferred = $.Deferred();

  if (userModel) {
    deferred.resolve(userModel);
  } else {
    deferred = this.queryUser({
      clientId: clientId
    }, function (userModels) {
      return $.Deferred().resolve(userModels[0]).promise();
    });
  }
  return deferred.promise();
};

Owner.prototype._onAttributesChangeMessage = function (changeObject) {
  var index,
      clientId = changeObject.clientId,
      changes = changeObject.changes,
      change,
      userModel = this.getUserModel(clientId);

  if (userModel) {
    if (changes.removedAttributes) {
      userModel.unset(changes.removedAttributes);
    }

    if (changes.addedAttributes) {
      userModel.set(changes.addedAttributes);
    }

    if (changes.changedAttributes) {
      userModel.set(changes.changedAttributes);
    }
  }
};


Owner.prototype._onAttributesClearMessage = function () {
  this.model.attributes = {};
};

Owner.prototype._onSocketConnect = function () {
  var self = this;
  this._intermediateRegister().then(function () {
    self.emit('connect_back');
  });
};

Owner.prototype._onSocketDisconnect = function () {
  this.emit('disconnect');
};

Owner.prototype.getClientId = function () {
  if (!this.clientId) {
    this.clientId = this.options.clientId || BrowserStore.getItem(this._storeKeys.clientId);
    if (!this.clientId) {
      this.clientId = UID.guid();
      this._storeClientId(this.clientId);
    }
  }
  return this.clientId;
};

Owner.prototype._storeClientId = function (clientId) {
  BrowserStore.setItem(this._storeKeys.clientId, clientId);
};

Owner.prototype._generateStoreKeys = function () {
  this._storeKeys = {};
  this._storeKeys.clientId = this.options.storePrefix + this.options.storeKey + this.options.storePostfix;
  return this._storeKeys;
};

Owner.prototype._findChanges = Model.prototype._findChanges;

var exports = {
  Owner: Owner
};

window && (window[plugin.accessVariable] = exports);

module.exports = exports;