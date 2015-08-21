var mongoose    = require('mongoose'),
    eventproxy  = require('eventproxy');

var dbconfig    = require('../configs/database');
var time        = require('../utils/time'),
    converter   = require('../utils/converter'),
    printer     = require('../printer').spider.main();
    
var daySpider   = require('./day'),
    teamSpider  = require('./team');

var Match       = require('../models/match'),
    Team        = require('../models/team'),
    Game        = require('../models/game');

var FIRST_DATE  = require('../configs/spider').first_date;

mongoose.connect(dbconfig.url);
mongoose.connection.on('error', function (err) {
  printer.error('mongo_conn',err);
}); 

module.exports = function (force){
  var count     = 0,
      //timestamp = Date.now(),
      //now       = new Date(Date.now()),
      start     = converter.dateToString(new Date(Date.now()));
      //start = '2011-01-06';
  //clear();
  // 如果时间在早上10点之前，live.500.com有可能抓不到当天数据，故向前推一天
  // if(now.getHours()<10){
  //   start = converter.dateToString(time.yesterday(start));
  // }
  var current = '';

  var runDay = function (){
    current = start;
    time.start();
    printer.start('day');
    daySpider(current,nextDay,force);
  };

  var nextDay = function(d,all,e){
    if(d === FIRST_DATE || all === true){
      printer.done('day',start,d);
      runTeam();
    }else{
      current = converter.dateToString(time.yesterday(d));
      if(e){
        current = d;
      }
      daySpider(current,nextDay,force);
    }
  };

  var teams,
      tpos   = 0,
      tcount = 0;
  var runTeam = function (){
    Team.getTeamsNeedUpdate(function (err,ts){
      if(err){
        printer.error('mongo_query',err);
        return null;
      }
      if(ts.length>0){
        teams = ts;
        tpos = 0;
        tcount += ts.length;
        printer.start('team',teams.length);
        teamSpider(teams[tpos],nextTeam);
      }else{
        printer.done('all',tcount,time.mark());
      }
    });
  };

  var nextTeam = function (e){
    if(tpos===teams.length-1){
      printer.done('team',tpos+1);
      runTeam();
    }else{
      if(!e){
        tpos++;
      }
      teamSpider(teams[tpos],nextTeam);
    }
  }
  printer.start('all');
  runDay();
};

var clear = function(){
  Match.removeAll(function(err){
    console.log('ALL MATCHES REMOVED!!!');
  });
  Team.removeAll(function(err){
    console.log('ALL TEAMS REMOVED!!!');
  });
  Game.removeAll(function(err){
    console.log('ALL GAMES REMOVED!!!');
  });
};
