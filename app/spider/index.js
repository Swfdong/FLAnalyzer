var mongoose    = require('mongoose'),
    eventproxy  = require('eventproxy');

var dbconfig    = require('../configs/database');
var time        = require('../utils/time'),
    formatter   = require('../utils/formatter'),
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

module.exports = function (force,skip,clear){
  var count     = 0,
      start     = formatter.dateToString(new Date(Date.now())),
      current   = '';
  skip = skip||[];
  if(clear){
    clearAll();
  }
  time.start();

  var runDay = function (){
    current = start;
    printer.start('day');
    daySpider(current,nextDay,force,skip);
  };

  var nextDay = function(d,all,e){
    if(d === FIRST_DATE || all === true){
      printer.done('day',start,d);
      runTeam();
    }else{
      current = formatter.dateToString(time.yesterday(d));
      if(e){
        current = d;
      }
      daySpider(current,nextDay,force,skip);
    }
  };

  var teams,
      tpos   = 0,
      tcount = 0;
  var runTeam = function (){
    Team.getNeedsUpdate(function (err,ts){
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

var clearAll = function(){
  Match.removeAll(function(err){
    console.log('已移除全部赛事数据！');
  });
  Team.removeAll(function(err){
    console.log('已移除全部球队数据！');
  });
  Game.removeAll(function(err){
    console.log('已移除全部联赛数据！');
  });
};
