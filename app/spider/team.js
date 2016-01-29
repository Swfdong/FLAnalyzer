var needle      = require('needle'),
    colors      = require('colors'),
    cheerio     = require("cheerio"),
    eventproxy  = require('eventproxy');

var time        = require('../utils/time'),
    parser      = require('../utils/parser'),
    printer     = require('../printer').spider.team,
    helper      = require('./helper');

var DICT        = require('../configs/spider').dict,
    COMPANY     = require('../configs/company');

var Match       = require('../models/match'),
    Game        = require('../models/game'),
    Team        = require('../models/team');

//URL
var URL = {
  matches:'http://liansai.500.com/index.php?c=teams&a=ajax_fixture&hoa={hoa}&tid={tid}&records=100',
  odds:'http://liansai.500.com/index.php?c=teams&a=ajax_pl&cid={cid}&fids={fids}',
  price:'http://liansai.500.com/team/{tid}/',
  future:'http://liansai.500.com/team/{tid}/teamfixture/'
  
};
var GAME_NAME_DICT;

//抓某一日数据
module.exports = function (team, next){
  printer.header(team);
  var hoa     = 1,
      data    = { count:0, gameCount:0, teamCount:0, match:{}, game:{}, team:{} },
      ep      = new eventproxy();
  //处理抓取错误
  var retry = function (){
    next(true);
    //防止多次调用
    retry = function(){};
  },
  poster = helper.poster(printer);

  //抓取赛事数据
  var matchesStep = function (json) {
    if(!json.list){
      return next();
    }
    var matches = json.list;
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
    ep.after('odds', COMPANY.europe.length, function () {
      printer.done(DICT.HOA[hoa]);
      //是否主客场都已抓取完毕
      if(hoa ==2){
        poster.get(URL.price.replace('{tid}',team.tid), priceStep);
      }else{
        hoa++;
        poster.json(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), matchesStep);
      }
    });
    //抓取赔率
    for(var j = 0; j < COMPANY.europe.length; j++){
      poster.json(URL.odds.replace('{cid}',COMPANY.europe[j].id).replace('{fids}',fids.join(',')), oddsStep(COMPANY.europe[j]));
    }
  }
  //抓取指定公司的赔率数据
  var oddsStep = function (cid) {
    return function (json) {
      if(json.list){
        var odds = json.list;
        for(var i = 0; i< odds.length; i++){
          var current = odds[i];
          var obj = data.match[parser.int(current.FIXTUREID)];
          obj.odds.europe[cid.name] = {now:[parser.number(current.WIN),parser.number(current.DRAW),parser.number(current.LOST)]};
        }
      }
      ep.emit('odds');
    }
  };
  //抓取球队身价数据
  var priceStep = function (response) {
    var $   = cheerio.load(response.body);
    var price = parser.price($('.itm_bd table tr').eq(2).find('td').eq(1).text());
    if(data.count>0){
      data.team[team.tid].price = price;
    //如果碰上没有数据的情况
    }else{
      team.price = price;
    }
    printer.done('price');
    poster.get(URL.future.replace('{tid}',team.tid), futureStep);
  };

  //抓取球队未来赛事数据
  var futureStep = function (response) {
    var $   = cheerio.load(response.body);
    var tr  = $('#f_table tr');
    var trc = 0;
    tr.each(function(){
      //仅获取最近三场未来赛事
      if(trc<3){
        var gname = parser.trim($(this).find('td').eq(0).text());
        var mdate = parser.trim($(this).find('td.td_time').text());
        var home = $(this).find('td.td_lteam');
        var away = $(this).find('td.td_rteam');
        var obj = {
          simple: true,
          done: false,
          mid: parser.int($(this).attr('id')),
          sid: parser.sid($(this).find('td').eq(0)),
          game:{
            gid: GAME_NAME_DICT[gname],
            name: gname
          },
          date: mdate,
          time: new Date(mdate),
          home:{
            tid: parser.tid(home),
            name: parser.trim(home.text())
          },
          away:{
            tid: parser.tid(away),
            name: parser.trim(away.text())
          },
          score:{}
        };
        //为防止冲突，没有数据时才保存
        if(!data.match[obj.mid]){
          data.count++;
          data.match[obj.mid] = obj;
          helper.intake(data,obj);
        }
        trc++;
      }
    });
    printer.done('future');
    preSave();
  };

  //保存数据前的准备工作
  var preSave = function (){
    if(data.count>0){
      saveAll();
    //如果碰上没有数据的情况
    }else{
      ep.on('team',function(){
        next()
      });
      saveTeam(team);
    }
  };

  //保存全部数据
  var saveAll = function (){
    helper.saveAll(data,ep,printer,{
      match: saveMatch,
      team: saveTeam,
      game: saveGame,
      next: function(){
        return next();
      },
      retry: retry
    });
  };
  //保存数据
  var saveMatch = function (obj){
    Match.getById(obj.mid, ep.done(function (m){
      //只更新没有记录且有比分的比赛
      if(!m&&((obj.done&&obj.score.full)||!obj.done)){
        m = new Match(obj);
        m.save(ep.done('match', function (o){
          printer.save(o);
        }));
      //如果有赛事但没有储存比分数据
      }else if(obj.score.full&&!m.score.full){
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
    Game.getById(obj.gid, ep.done(function (m){
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
    Team.getById(obj.tid, ep.done(function (m){
      if(!m){
        m = new Team(obj);
        m.save(ep.done('team', function (o){
          printer.save(o);
        }));
      }else if(m.tid === team.tid){
        m.price = team.price;
        m.updated = true;
        m.save(ep.done('team'));
      }else{
        ep.emit('team');
      }
    }));
  };

  //生成球队名字典并开始抓取
  if(GAME_NAME_DICT){
    poster.json(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), matchesStep);
  }else{
    Game.getAll(ep.done(function(gs){
      GAME_NAME_DICT = {};
      gs.forEach(function (g){
        GAME_NAME_DICT[g.name] = g.gid;
      });
      poster.json(URL.matches.replace('{hoa}',hoa).replace('{tid}',team.tid), matchesStep);
    }));
  }
}
