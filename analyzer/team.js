var brain       = require('brain'),
    mongoose    = require('mongoose'),
    eventproxy  = require('eventproxy'),
    logger      = require('tracer').console();

var dbconfig    = require('../configs/database');
var converter   = require('../utils/converter');
var Match       = require('../models/match');

var factor = [0,0.38,0,1];
var RECENT_NUM = 10;

module.exports = function (team, time, handler){
  var result = [0,0,0];
  var ep = new eventproxy();
  ep.fail(function (err){});
  var calc = function (ms,i){
    var k = 1;
    ms.forEach(function (m){
      if(m.isWin(team)!==-1){
        result[i] += factor[m.isWin(team)]*k;
        k = k*0.95;
      }
    });
  };
  var total = function (){
    Match.getMatchesByTeam(team, {time:time}, RECENT_NUM, ep.done(function (matches){
      calc(matches,1);
      home();
    }));
  };
  var home = function (){
    Match.getMatchesByTeam(team, {time:time}, RECENT_NUM, ep.done(function (matches){
      calc(matches,0);
      away();
    }));
  };
  var away = function (){
    Match.getMatchesByTeam(team, game, time, RECENT_NUM, ep.done(function (matches){
      calc(matches,2);
      next();
    }));
  };
  var next = function (){
    handler(result);
  };
  total();
}