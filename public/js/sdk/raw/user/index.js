var $ = require('jquery'),
    UID = require('../util/uid'),
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

function User (groupId, options) {
  this.options = options || {};
  this.options.storeKey || (this.options.storeKey = 'realstore-user-clientid');
  this.options.storePrefix || (this.options.storePrefix = '');
  this.options.storePostfix || (this.options.storePostfix = '');
  this.options.modelChangeThrottle || (this.options.modelChangeThrottle = 500);
  this._generateStoreKeys();
  this.model = new Model();
  this.model._changesBufferByAttributeName = {};
  this._attachModelEvents();
  this.groupId = groupId;
}

User.prototype.connect = function () {
  if (!this._connectDeferred) {
    this._connectDeferred = this._connect();
  }
  return this._connectDeferred;
};

User.prototype.disconnect = function () {
  if (!this._socket) {
    this._socket.disconnect();
    delete this._isConnected;
  }
  return this._socket;
};

User.prototype._connect = function () {
  this.clientId = this.getClientId();
  this._client || (this._client = new Client());
  this._socket || (this._socket = io(undefined, {query: 'role=user'}));
  this._client.setSocket(this._socket);
  return this._initialRegister();
};

User.prototype._initialRegister = function () {
  var self = this;
  return this._register().then(function (modelObject) {
    self.model.attributes = modelObject.attributes || {};
    self._attachSocketEvents();
    return $.Deferred().resolve(self.model).promise();
  })
};

User.prototype._intermediateRegister = function () {
  var self = this,
      oldAttributes;
  return this._register().then(function (modelObject) {
    self.model.attributes = modelObject.attributes || {};
    return $.Deferred().resolve(self.model).promise();
  })
};

User.prototype._register = function () {
  return this._request('put:api/model', {
    clientId: this.clientId,
    groupId: this.groupId,
  });
};

User.prototype._request = function (method, data) {
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

User.prototype._attachSocketEvents = function () {
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
  this._socket.on('change:attributes', function (data) {
    self._onAttributesChangeMessage.apply(self, arguments);
  });
  this._socket.on('clear:attributes', function () {
    self._onAttributesClearMessage.call(self);
  });
  
};

User.prototype._attachModelEvents = function () {
  var self = this;
  if (this.model && !this.isModelEventsAttached) {
    this.model.on('change', function (changes) {
      self._onModelChangeThrottled.apply(self, arguments);
    });
  }
};

User.prototype._onCustomMessage = function (dataObject) {
  var self = this,
      fromClientId = dataObject.clientId,
      message = dataObject.message;
  this.model.emit('custom_message', message, function (message) {
    self._emitCustomMessageToOwner(fromClientId, message);
  });
};

User.prototype._emitCustomMessageToOwner = function (clientId, message) {
  return this._request('post:api/owner/custom_message/emit', {
    clientId: clientId,
    message: message,
  });
};

User.prototype._onModelChangeThrottled = function (changes) {
  var self = this,
      change,
      bufferChange,
      changesBufferByAttributeName = this.model._changesBufferByAttributeName,
      index;

  for (index in changes) {
    change = changes[index];
    bufferChange = changesBufferByAttributeName[change.attributeName];
    if (!bufferChange) {
      changesBufferByAttributeName[change.attributeName] = change;
    } else if (change.action === bufferChange.action) {
      changesBufferByAttributeName[change.attributeName] = change;
    } else {
      if (change.action === 'change' && bufferChange.action === 'add') {
        change.action = 'add';
        changesBufferByAttributeName[change.attributeName] = change;
      } else if (change.action === 'add' && bufferChange.action === 'remove') {
        changesBufferByAttributeName[change.attributeName] = change;
      } else if (change.action === 'remove' && bufferChange.action === 'add') {
        delete changesBufferByAttributeName[change.attributeName];
      } else {
        changesBufferByAttributeName[change.attributeName] = change;
      }
    }
  }

  this.model._changesBufferByAttributeName = changesBufferByAttributeName;

  console.log('this.model._changesBufferByAttributeName', this.model._changesBufferByAttributeName);

  window.clearTimeout(this.throttledChangeTimeoutIndex);
  this.throttledChangeTimeoutIndex = window.setTimeout(function () {
    self._onModelChange(self._makeArray(self.model._changesBufferByAttributeName));
    self.model._changesBufferByAttributeName = {};
  }, this.options.modelChangeThrottle);
};

User.prototype._onModelChange = function (changes) {
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

User.prototype._groupBy = function (attributeName, array) {
  var index,
      item,
      groupedObject = {};
  for (index in array) {
    item = array[index];
    groupedObject[item[attributeName]] = item;
  }
  return groupedObject;
}

User.prototype._makeArray = function (object) {
  var key,
      array = [];
  for (key in object) {
    array.push(object[key]);
  }
  return array;
};

User.prototype._onAttributesChangeMessage = function (changes) {
  var index,
      key,
      changesInDetail,
      changeInDetail,
      oldAttributes = this.model.toJSON(),
      newAttributes;

  if (changes.removedAttributes) {
    for(index in changes.removedAttributes) {
      delete this.model.attributes[changes.removedAttributes[index]];
    }
  }

  if (changes.addedAttributes) {
    for(key in changes.addedAttributes) {
      this.model.attributes[key] = changes.addedAttributes[key];
    }
  }

  if (changes.changedAttributes) {
    for(key in changes.changedAttributes) {
      this.model.attributes[key] = changes.changedAttributes[key];
    }
  }

  newAttributes = this.model.toJSON();

  changesInDetail = this._findChanges(oldAttributes, newAttributes);

  for(index in changesInDetail) {
    changeInDetail = changesInDetail[index];
    this.model.emit('server_change:' + changeInDetail.attributeName, changeInDetail);
  }
  if (changesInDetail.length !== 0) {
    this.model.emit('server_change', changesInDetail);
  }
};


User.prototype._onAttributesClearMessage = function () {
  this.model.attributes = {};
};

User.prototype._onSocketConnect = function () {
  var self = this;
  this._intermediateRegister().then(function () {
    self.model.emit('connect_back');
  });
};

User.prototype._onSocketDisconnect = function () {
  var self = this;
  self.model.emit('disconnect');
};

User.prototype._addAttributes = function (attributes) {
  return this._request('put:api/model/attributes/add', attributes);
};

User.prototype._removeAttributes = function (attributeNames) {
  return this._request('put:api/model/attributes/remove', attributeNames);
};

User.prototype._updateAttributes = function (attributes) {
  return this._request('put:api/model/attributes/update', attributes);
};

User.prototype._clearAttributes = function () {
  return this._request('put:api/model/attributes/clear');
};

User.prototype.getClientId = function () {
  if (!this.clientId) {
    this.clientId = this.options.clientId || BrowserStore.getItem(this._storeKeys.clientId);
    if (!this.clientId) {
      this.clientId = UID.guid();
      this._storeClientId(this.clientId);
    }
  }
  return this.clientId;
};

User.prototype._storeClientId = function (clientId) {
  BrowserStore.setItem(this._storeKeys.clientId, clientId);
};

User.prototype._generateStoreKeys = function () {
  this._storeKeys = {};
  this._storeKeys.clientId = this.options.storePrefix + this.options.storeKey + this.options.storePostfix;
  return this._storeKeys;
};

User.prototype._findChanges = Model.prototype._findChanges;

var exports = {
  User: User
};

window && (window[plugin.accessVariable] = exports);

module.exports = exports;