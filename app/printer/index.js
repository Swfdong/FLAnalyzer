var _ = require('lodash');

var printers = [
  require('./logger')(console)
];

module.exports = require('./logger')(console);