var config = require('../config')[process.env.NODE_ENV];

function connect() {
  var mongoose = require('mongoose');
  var mongodbURL = config.db;
  mongoose.connect(mongodbURL);
  console.log('Connected to MongoDB. MongoDB URL:', mongodbURL);
}

module.exports = {
  connect: connect,
};