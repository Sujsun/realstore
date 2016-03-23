var $ = require('jquery'),
    Events = require('minivents'),
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
  this.options.storeKey || (this.options.storeKey = 'realstore-clientid');
  this.options.storePrefix || (this.options.storePrefix = '');
  this.options.storePostfix || (this.options.storePostfix = '');
  this.options.modelChangeThrottle || (this.options.modelChangeThrottle = 500);
  this.event = new Events();
  this._userModels = {};
  this._generateStoreKeys();
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
    clientId: 'owner-clientid'
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
  return this._request('get:api/model', queryObj);
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

Owner.prototype._onModelChangeThrottled = function (changes) {
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

Owner.prototype._groupBy = function (attributeName, array) {
  var index,
      item,
      groupedObject = {};
  for (index in array) {
    item = array[index];
    groupedObject[item[attributeName]] = item;
  }
  return groupedObject;
}

Owner.prototype._makeArray = function (object) {
  var key,
      array = [];
  for (key in object) {
    array.push(object[key]);
  }
  return array;
};

Owner.prototype._onAttributesChangeMessage = function (data) {
  var index,
      key,
      clientId = data.clientId,
      changes = data.changes,
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

Owner.prototype._addAttributes = function (attributes) {
  return this._request('put:api/model/attributes/add', attributes);
};

Owner.prototype._removeAttributes = function (attributeNames) {
  return this._request('put:api/model/attributes/remove', attributeNames);
};

Owner.prototype._updateAttributes = function (attributes) {
  return this._request('put:api/model/attributes/update', attributes);
};

Owner.prototype._clearAttributes = function () {
  return this._request('put:api/model/attributes/clear');
};

Owner.prototype.getClientId = function () {
  if (!this.clientId) {
    this.clientId = BrowserStore.getItem(this._storeKeys.clientId);
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