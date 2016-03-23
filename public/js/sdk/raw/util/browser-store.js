var Storage = require('./storage');

/**
 * Custom LocalStorage Class
 */
function CustomLocalStorage (config) {
  this.config(config);
  return this;
}

CustomLocalStorage.prototype.config = function (params) {
  params || (params = {});
  this._config || (this._config = {});
  params.prefix && (this._config.prefix = params.prefix);
  params.postfix && (this._config.postfix = params.postfix);
  return this;
};

CustomLocalStorage.prototype._setItem = window.localStorage.setItem;
CustomLocalStorage.prototype._getItem = window.localStorage.getItem;
CustomLocalStorage.prototype._removeItem = window.localStorage.removeItem;

CustomLocalStorage.prototype.setItem = function(key, value) {
  key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
  return CustomLocalStorage.prototype._setItem.call(window.localStorage, key, value);
}

CustomLocalStorage.prototype.getItem = function(key) {
  key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
  return CustomLocalStorage.prototype._getItem.call(window.localStorage, key);
};

CustomLocalStorage.prototype.removeItem = function(key) {
  key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
  return CustomLocalStorage.prototype._removeItem.call(window.localStorage, key);
};

var BrowserStore;

/**
 * If the browser doesn't support localStorage then create Polyfill method to use cookie
 * Else use localStorage with custom implementations
 */
if(typeof(window.localStorage) === 'undefined') {
	BrowserStore = new Storage('local');
} else {
	BrowserStore = new CustomLocalStorage();
}

module.exports = BrowserStore;
