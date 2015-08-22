var needle      = require('needle'),
    colors      = require('colors'),
    cheerio     = require("cheerio"),
    eventproxy  = require('eventproxy');

var time        = require('../utils/time'),
    converter   = require('../utils/converter'),
    parser      = require('../utils/parser'),
    printer     = require('../printer').spider.team(),
    helper      = require('./helper');

var DICT        = require('../configs/spider').dict;

var Match       = require('../models/match'),
    Game        = require('../models/game'),
    Team        = require('../models/team');

//URL
var URL = {
  matches:'http://liansai.500.com/index.php?c=teams&a=ajax_fixture&hoa={hoa}&tid={tid}&records=100',
  odds:'http://liansai.500.com/index.php?c=teams&a=ajax_pl&cid={cid}&fids={fids}',
};

//抓某一日数据
module.exports = function (team, next){
  printer.header(team);

  var hoa   = 1,
      data  = { count:0, gameCount:0, teamCount:0, match:{}, game:{}, team:{} },
      ep    = new eventproxy();
  //处理抓取错误
  var retry = function (){
    next(true);
    //防止多次调用
    retry = function(){};
  },
  poster = helper.poster(printer);

  //抓取赛事基本信息
  var matchesStep = function (data) {
    if(!data.list){
      return next();
    }
    var matches = data.list;
    var fids = [];

    data.count += matches.length;
    for(var i = 0; i< matches.length; i++){
      var current = matches[i];
      var obj = {
        simple: true,
        done: true,
        mid: parser.int(current.FIXTUREID),
        game:{
          gid: parser.int(current.MATCHID),
          name: parser.trim(current.SIMPLEGBNAME),
          fullname: current.MATCHGBNAME
        },
        date: current.MATCHDATE,
        time: new Date(current.MATCHDATE),
        odds: {europe:{}, asia:{}},
        home:{
          tid: parser.int(current.HOMETEAMID),
          name: parser.trim(current.HOMETEAMSXNAME),
        },
        away:{
          tid: parser.int(current.AWAYTEAMID),
          name: parser.trim(current.AWAYTEAMSXNAME)
        },
        score:{}
      }
      //半场比分
      if(current.HOMESCORE!==null){
        obj.score.full = {
          home: parser.int(current.HOMESCORE),
          away: parser.int(current.AWAYSCORE),
        }
      }
      //半场比分
      if(current.HOMEHTSCORE!==null){
        obj.score.half = {
          home: parser.int(current.HOMEHTSCORE),
          away: parser.int(current.AWAYHTSCORE),
        }
      }
      //澳门赔率
      if(current.HANDICAPLINE!==null){
        obj.odds.asia.macau = {now:[parser.number(current.HOMEMONEYLINE),parser.number(current.HANDICAPLINE),parser.number(current.AWAYMONEYLINE)]};
      }
      fids.push(obj.mid);
      if(data.match[obj.mid]){
        data.count--;
      }
      data.match[obj.mid] = obj;
      helper.intake(data,obj);
    }
    //抓取赔率完成
    ep.after('odds', DICT.OUZHI.length, function () {
      printer.done(DICT.HOA[hoa]);
      //是否主客场都已抓取完毕
      if(hoa ==2){
        helper.saveAll(data,ep,printer,{
          match: saveMatch,
          team: saveTeam,
          game: saveGame,
          next: function(){
            return next();
          },
          retry: retry
        });
      }else{
        hoa++;
        poster.json(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), matchesStep);
      }
    });
    //抓取赔率
    for(var j = 0; j < DICT.OUZHI.length; j++){
      poster.json(URL.odds.replace('{cid}',DICT.OUZHI[j].id).replace('{fids}',fids.join(',')), oddsStep(DICT.OUZHI[j]));
    }
  };
  //抓取指定公司的赔率数据
  var oddsStep = function (cid) {
    return function (data) {
      if(data.list){
        var odds = data.list;
        for(var i = 0; i< odds.length; i++){
          var current = odds[i];
          var obj = data.match[parser.int(current.FIXTUREID)];
          obj.odds.europe[cid.name] = {now:[parser.number(current.WIN),parser.number(current.DRAW),parser.number(current.LOST)]};
        }
      }
      ep.emit('odds');
    }
  };

  //保存数据
  var saveMatch = function (obj){
    Match.getMatchById(obj.mid, ep.done(function (m){
      //只更新没有记录的比赛
      if(!m&&obj.score.full){
        //如果有比分数据才写入
        m = new Match(obj);
        m.save(ep.done('match', function (o){
          printer.save(o);
        }));
      }else if(m&&!m.score.full&&obj.score.full){
        m.score = obj.score;
        m.save(ep.done('match', function (o){
          printer.save(o,true);
        }));
      }else{
        ep.emit('match');
      }
    }));
  };
  var saveGame = function (obj){
    Game.getGameById(obj.gid, ep.done(function (m){
      //如果没有，则创建
      if(!m){
        m = new Game(obj);
        m.save(ep.done('game', function (o){
          printer.save(o);
        }));
      }else if(!m.fullname&&obj.fullname){
        m.fullname = obj.fullname;
        m.save(ep.done('game', function (o){
          printer.save(o,true);
        }));
      }else{
        ep.emit('game');
      }
    }));
  };
  var saveTeam = function (obj){
    Team.getTeamById(obj.tid, ep.done(function (m){
      if(!m){
        m = new Team(obj);
        m.save(ep.done('team', function (o){
          printer.save(o);
        }));
      }else if(m.tid === team.tid){
        m.updated = true;
        m.save(ep.done('team'));
      }else{
        ep.emit('team');
      }
    }));
  };
  poster.json(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), matchesStep);
}
