var needle      = require('needle'),
    colors      = require('colors'),
    cheerio     = require("cheerio"),
    eventproxy  = require('eventproxy'),
    logger      = require('tracer').console();

var time        = require('../utils/time'),
    converter   = require('../utils/converter'),
    parser      = require('../utils/parser'),
    printer     = require('../utils/printer');

var DICT        = require('../configs/spider').dict;

var Match       = require('../models/match');
var Game        = require('../models/game');
var Team        = require('../models/team');

//URL
var URL = {
  matches:'http://liansai.500.com/index.php?c=teams&a=ajax_fixture&hoa={hoa}&tid={tid}&records=100',
  odds:'http://liansai.500.com/index.php?c=teams&a=ajax_pl&cid={cid}&fids={fids}',
};

//抓某一日数据
module.exports = function (team, next){
  var hoa   = 1,
      data  = { count:0, gameCount:0, teamCount:0, match:{}, game:{}, team:{} },
      ep    = new eventproxy();
  //处理抓取错误
  var done = function (step){
    return function (error, response) {
      if (error){
        ep.unbind();
        console.error('数据抓取出错，错误信息为：'.red);
        console.error(String(error).grey);
        console.error('准备重新抓取...');
        return next(true);
      }else{
        step(response);
      }
    }
  }

  printer.header('正在抓取'+team.name+('('+team.tid+')').grey+'的比赛数据...');

  //抓取赛事基本信息
  var matchesStep = function (response) {
    try{
      var body = JSON.parse(response.body);
    }catch (err) {
      console.error('JSON解析出错，错误信息为：'.red);
      console.error(String(err).grey);
      console.error('准备重新抓取...');
      return next(true);
    }
    if(!body.list){
      logger.error(team.name,'数据抓取出错，没有数据！');
      return next();
    }
    var matches = body.list;
    var fids = [];

    console.log(('抓取到'+HOA_DICT[hoa]+'比赛'+matches.length+'场').grey);
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
      if(data.game[obj.game.gid]===undefined){
        data.game[obj.game.gid] = obj.game;
        data.gameCount++;
      }
      if(data.team[obj.home.tid]===undefined){
        data.team[obj.home.tid] = obj.home;
        data.teamCount++;
      }
      if(data.team[obj.away.tid]===undefined){
        data.team[obj.away.tid] = obj.away;
        data.teamCount++;
      }
    }
    //抓取赔率完成
    ep.after('odds', DICT.OUZHI.length, function () {
      //是否主客场都已抓取完毕
      if(hoa ==2){
        //保存事件响应
        ep.after('match', data.count, function () {
          printer.line();
          console.log('共'+data.teamCount+'支球队');
          for(var k in data.team){
            saveTeam(data.team[k]);
          }
        });
        ep.after('team', data.teamCount, function () {
          printer.line();
          console.log('共'+data.gameCount+'种赛事');
          for(var q in data.game){
            saveGame(data.game[q]);
          }
        });
        ep.after('game', data.gameCount, function () {
          console.error('数据写入完毕'.grey);
          return next();
        });
        ep.fail(function (err){
          ep.unbind();
          console.error('数据库操作出错，错误信息为：'.red);
          console.error(String(err).grey);
          console.error('准备重新抓取...');
          return next(true);
        });

        //保存数据
        printer.line();
        console.log('共'+data.count+'场比赛');
        for(var q in data.match){
          saveMatch(data.match[q]);
        }
      }else{
        hoa++;
        needle.get(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), done(matchesStep));
      }
    });
    //抓取赔率
    for(var j = 0; j < DICT.OUZHI.length; j++){
      needle.get(URL.odds.replace('{cid}',DICT.OUZHI[j].id).replace('{fids}',fids.join(',')), done(oddsStep(DICT.OUZHI[j])));
    }
  }
  //抓取指定公司的赔率数据
  var oddsStep = function (cid) {
    return function (response) {
      try{
        var body = JSON.parse(response.body);
      }catch (err) {
        console.error('JSON解析出错，错误信息为：'.red);
        console.error(String(err).grey);
        console.error('准备重新抓取...');
        return next(true);
      }
      if(body.list){
        var odds = body.list;
        for(var i = 0; i< odds.length; i++){
          var current = odds[i];
          var obj = data.match[parser.int(current.FIXTUREID)]
          obj.odds.europe[cid.name] = {now:[parser.number(current.WIN),parser.number(current.DRAW),parser.number(current.LOST)]};
        }
      }
      ep.emit('odds');
    }
  }

  //保存数据
  var saveMatch = function (obj){
    Match.getMatchById(obj.mid, ep.done(function (m){
      //只更新没有记录的比赛
      if(!m){
        m = new Match(obj);
        //如果有比分数据才写入
        if(obj.score.full){
          m.save(ep.done('match', function (){
            console.log(' •'.red, obj.date.grey, obj.home.name,'VS'.grey, obj.away.name, ('('+obj.score.full.home+':'+obj.score.full.away+')').grey);
          }));
        }else{
          console.log(' •'.grey, obj.date.grey, obj.home.name,'VS'.grey, obj.away.name, '没有比分，已跳过'.grey);
          ep.emit('match');
        }
      }else if(!m.score.full&&obj&&obj.score.full){
        m.score = obj.score;
        m.save(ep.done('match', function (){
          console.log(' •'.green, obj.date.grey, obj.home.name,'VS'.grey, obj.away.name, ('('+obj.score.full.home+':'+obj.score.full.away+')').grey);
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
        m.save(ep.done('game', function (){
          console.log(' •'.red,obj.name+('/'+obj.fullname).gray+('/'+obj.gid).dim.gray);
        }));
      }else if(!m.fullname){
        m.fullname = obj.fullname;
        m.save(ep.done('game', function (){
          console.log(' •'.green,obj.name+('/'+obj.fullname).gray+('/'+obj.gid).dim.gray);
        }));
      }else{
        ep.emit('game');
      }
    }));
  };
  var saveTeam = function (obj){
    Team.getTeamById(obj.tid, ep.done(function (m){
      //如果没有，则创建
      if(!m){
        m = new Team(obj);
        m.save(ep.done('team', function (){
          console.log(' •'.red,obj.name+('/'+obj.tid).dim.gray);
        }));
      }else if(m.tid === team.tid){
        m.updated = true;
        m.save(ep.done('team'));
      }else{
        ep.emit('team');
      }
    }));
  };
  needle.get(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), done(matchesStep));
}
