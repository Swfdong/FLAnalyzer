var _ = require('lodash');

var printers = [
  require('./logger')
];

module.exports = require('./logger')(console);