
var UID = {

  s4: function() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  },

  guid: function () {
    return (this.s4()+this.s4()+"-"+this.s4()+"-"+this.s4()+"-"+this.s4()+"-"+this.s4()+this.s4()+this.s4());
  },

};

module.exports = UID;