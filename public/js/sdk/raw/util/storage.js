var Storage = function (type) {

  function createCookie(name, value, days) {
    var date, expires;

    if (days) {
      date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      expires = "; expires="+date.toGMTString();
    } else {
      expires = "";
    }
    document.cookie = name+"="+value+expires+"; path=/";
  }

  function readCookie(name) {
    var nameEQ = name + "=",
        ca = document.cookie.split(';'),
        i, c;

    for (i=0; i < ca.length; i++) {
      c = ca[i];
      while (c.charAt(0) === ' ') {
        c = c.substring(1,c.length);
      }

      if (c.indexOf(nameEQ) === 0) {
        return c.substring(nameEQ.length,c.length);
      }
    }
    return null;
  }

  function setData(data) {
    data = JSON.stringify(data);
    if (type == 'session') {
      window.name = data;
    } else {
      createCookie('localStorage', data, 365);
    }
  }

  function clearData() {
    if (type == 'session') {
      window.name = '';
    } else {
      createCookie('localStorage', '', 365);
    }
  }

  function getData() {
    var data = type == 'session' ? window.name : readCookie('localStorage');
    return data ? JSON.parse(data) : {};
  }


  // initialise if there's already data
  var data = getData();

  return {
    length: 0,

    _config: {},

    config: function(params) {
      params || (params = {});
      params.prefix && (this._config.prefix = params.prefix);
      params.postfix && (this._config.postfix = params.postfix);
    },

    clear: function () {
      data = {};
      this.length = 0;
      clearData();
    },
    getItem: function (key) {
      if(!data) { return null; }
      key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
      return data[key] === undefined ? null : decodeURIComponent(data[key]);
    },
    key: function (i) {
      // not perfect, but works
      var ctr = 0;
      for (var k in data) {
        if (ctr == i) return k;
        else ctr++;
      }
      return null;
    },
    removeItem: function (key) {
      key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
      delete data[key];
      this.length--;
      setData(data);
    },
    setItem: function (key, value) {
      key = ((this._config.prefix && this._config.prefix + '-') || '') + key + ((this._config.postfix && '-' + this._config.postfix) || '');
      data[key] = encodeURIComponent(value+''); // forces the value to a string
      this.length++;
      setData(data);
    }
  };
};