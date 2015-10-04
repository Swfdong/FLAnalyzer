var _           = require('lodash'),
    eventproxy  = require('eventproxy'),
    converter   = require('../utils/converter');
var Match       = require('../models/match');
var printer     = require('../printer').spider.day();

var FACTOR  = [0,0.618,0,1],
    RECENT_NUM = 10;

module.exports = function (match, handler){
  var result = [0,0];
  var ep = new eventproxy();
  ep.fail(function (err){});

  //两队近况
  var recent = function (){
    var calc = function (tm,ms,i){
      var k  = 1;
      ms.forEach(function (m){
        if(m.isWin(tm)!==-1){
          result[i] += FACTOR[m.isWin(tm)]*k;
          k = k*0.9;
        }
      });
    };
    ep.after('recent',2,function(){
      history();
    });
    ['home','away'].forEach(function (team,i){
      var query = {time:match.time};
      if(!match.neutral){
        query[team] = true;
      }
      Match.getMatchesByTeam(match[team], query, RECENT_NUM, ep.done('recent',function (ms){
        calc(match[team],ms,i);
      }));
    });
  };

  //两队对战历史
  var history = function (){
    var calc = function (ms){
      var k = 1;
      ms.forEach(function (m){
        result[0] += FACTOR[m.isWin(match.home)]*k;
        result[1] += FACTOR[m.isWin(match.away)]*k;
        k = k*0.9;
      });
    };
    var query = {time:match.time};
    Match.getMatchesByTeams([match.home,match.away], query, RECENT_NUM, ep.done('recent',function (ms){
      calc(ms);
      next();
    }));
  };

  var next = function (){
    handler(result);
  };
  recent();
}