/**
 * client = {
 *   <clientId>: {
 *     sessions: [<sessionId>, <sessionId>]
 *   }
 * };
 */

function Client () {
  this._clients = {};
}

Client.prototype.addSession = function (clientId, socket) {
  var client = this._clients[clientId];
  client || (client = { sessions: { length: 0 } });
  var existingSocket = client.sessions[socket.id];
  client.sessions[socket.id] = socket;
  if (!existingSocket) {
    client.sessions.length++;
  }
  this._clients[clientId] = client;
  return client;
};

Client.prototype.removeSession = function (clientId, socket) {
  var client = this._clients[clientId];
  if (client) {
    if (client.sessions[socket.id]) {
      delete client.sessions[socket.id];
      client.sessions.length--;
    }
    if (client.sessions.length === 0) {
      this.remove(clientId);
    }
  }
  return true;
};

Client.prototype.get = function (clientId) {
  return this._clients[clientId];
};

Client.prototype.remove = function (clientId) {
  if (this._clients[clientId]) {
    delete this._clients[clientId];
  }
  return true;
};

function createClient () {
  return new Client();
}

module.exports = createClient;