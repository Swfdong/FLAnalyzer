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
  odds:"http://odds.500.com/index_jczq_{day}.shtml",
  score:'http://zx.500.com/jczq/kaijiang.php?d={day}',
  jingcai:'http://trade.500.com/jczq/inc/readfile.php?step=readpl&zxid={iid}&wtype={type}&date={day}&g=2',
  live:'http://live.500.com/?e={day}',
  trade:'http://trade.500.com/static/500public/jczq/xml/hisdata/{yyyy}/{mm}{dd}/hcount_354.xml',
  trade_today:'http://trade.500.com/static/500public/jczq/xml/hcount/hcount_354.xml',
  bwin:'http://www.310win.com/info/match/Betfair.aspx?date={day}'
  
};

var TODAY = converter.dateToString(new Date(Date.now()));

//抓某一日数据
module.exports = function (day, next, force){
  var day_arr = day.split('-'),
      data    = { gameCount:0, teamCount:0, bwinCount:0, match:{}, shortcut:{}, iid:{}, hid:{}, aid:{}, home:{}, away:{}, game:{}, team:{} },
      ep      = new eventproxy(),
      retry   = 0;

  //处理抓取错误
  var done = function (step){
    return function (error, response) {
      if (error){
        ep.unbind();
        console.error('数据抓取出错，错误信息为：'.red);
        console.error(String(error).grey);
        console.error('准备重新抓取...');
        //自动重试
        return next(day,false,true);
      }else{
        step(response);
      }
    }
  }

  printer.header('正在抓取'+day+'的比赛数据...');
  needle.defaults({ open_timeout:5000, read_timeout:10000, json:true, headers:{'X-Requested-With': 'XMLHttpRequest', 'Accept-Encoding': 'gzip, deflate, sdch'}});

  //赔率数据
  var oddsStep = function (response) {
    var $      = cheerio.load(response.body),
        flag   = false,
        script = null;
    $('script').each(function (i,elm){
      //包含对阵数据
      if(!flag&&$(this).text().indexOf('duizhenList')!==-1){
        flag   = true;
        script = $(this).text();
        script = script.substr(0,script.lastIndexOf('var timeOffset'));
      }
    });
    //不安全的方法，执行抓取到页面中的脚本，获取对应的赔率数组
    eval(script);

    var tr = $('#main-tbody tr[data-mid]');
    //如果没有数据则跳过
    if(tr.length === 0){
      return next(day);
    }
    data.count = tr.length;
    tr.each(function (i,elm) {
      //解析代码
      var obj  = { game:{}, home:{}, away:{}, jingcai:{}, odds:{europe:{},asia:{}} },
          mid  = $(this).attr('data-fid'),
          home = $(this).find('td.text_right'),
          away = $(this).find('td.text_left');
      obj.mid       = parser.int(mid);
      obj.done      = false;
      obj.neutral   = false;
      obj.date      = day;
      obj.shortcut  = parser.trim($(this).find('td').eq(0).text());
      obj.time      = parser.date($(this).attr('date-dtime'));
      obj.game.name = parser.trim($(this).find('td').eq(1).text());
      obj.game.gid  = parser.int($(this).attr('data-mid'));
      obj.home.name = parser.trim(home.text());
      obj.home.tid  = parser.int(home.find('a').attr("href").match("http://liansai.500.com/team/([0-9]+)/")[1]);
      obj.away.name = parser.trim(away.text());
      obj.away.tid  = parser.int(away.find('a').attr("href").match("http://liansai.500.com/team/([0-9]+)/")[1]);

      //更新赔率
      var j,current;
      if(ouzhiList[mid]){
        for(j=0;j<DICT.OUZHI.length;j++){
          current = DICT.OUZHI[j];
          if(ouzhiList[mid][current.id]){
            obj.odds.europe[current.name] = {};
            obj.odds.europe[current.name].now = [ouzhiList[mid][current.id][0][0]||0,ouzhiList[mid][current.id][0][1]||0,ouzhiList[mid][current.id][0][2]||0];
            obj.odds.europe[current.name].first = [ouzhiList[mid][current.id][1][0]||0,ouzhiList[mid][current.id][1][1]||0,ouzhiList[mid][current.id][1][2]||0];
          }
        }
      }
      if(yapanList[mid]){
        for(j=0;j<DICT.YAPAN.length;j++){
          current = DICT.YAPAN[j];
          if(yapanList[mid][current.id]){
            obj.odds.asia[current.name] = {};
            obj.odds.asia[current.name].now = [yapanList[mid][current.id][0][0]||0,yapanList[mid][current.id][0][1]||0,yapanList[mid][current.id][0][2]||0];
            obj.odds.asia[current.name].first = [yapanList[mid][current.id][1][0]||0,yapanList[mid][current.id][1][1]||0,yapanList[mid][current.id][1][2]||0];
          }
        }
      }

      data.match[mid] = obj;
      data.hid[obj.home.tid] = obj;
      data.aid[obj.away.tid] = obj;
      data.shortcut[obj.shortcut] = obj;
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
    });
    console.log(' √ 基本信息'.dim.grey);
    needle.get(URL.score.replace('{day}',day), done(scoreStep));
  };

  var jcQuery = {list:[],dict:{}};
  //比分数据，竞彩赔率数据
  var scoreStep = function (response) {
    var $ = cheerio.load(response.body);
    var tr = $('table.ld_table > tr:not(:first-child)');
    tr.each(function (i,elm) {
      var shortcut = $(this).find('td').eq(0).text(),
          hid      = parser.int($(this).find('td').eq(3).find('a').attr('href').replace('http://liansai.500.com/team/','').replace('/')),
          aid      = parser.int($(this).find('td').eq(5).find('a').attr('href').replace('http://liansai.500.com/team/','').replace('/')),
          obj      = data.shortcut[shortcut]||data.hid[hid]||data.aid[aid];
      if(obj){
        obj.jingcai.rq =parser.int($(this).find('td.eng').eq(1).text());
        //比分数据
        var scoreText = $(this).find('td.eng').eq(2).text();
        if(scoreText&&scoreText!='-'){
          data.doneCount++;
          obj.done = true;
          var score = parser.score($(this).find('td.eng').eq(2).text());
          obj.score = {
            half:{  home: parser.int(score[1]), away: parser.int(score[2])},
            full:{  home: parser.int(score[3]), away: parser.int(score[4])}};
        }
        var iid = parser.int($(this).find('td.eng').eq(3).find('span').attr('zid'));
        if(iid){
          obj.iid = iid;
          data.iid[obj.iid] = obj;
          jcQuery.dict[obj.iid] = 0;
        }
        //如有竞彩数据，则添加至抓取队列
        var spfText = $(this).find('td.eng').eq(3).text();
        if(spfText&&spfText!='--'){ 
          jcQuery.dict[obj.iid] = 1;
          jcQuery.list.push({type:'spf',obj:obj});
        }
        var nspfText = $(this).find('td.eng').eq(5).text();
        if(nspfText&&nspfText!='--'){
          jcQuery.dict[obj.iid] += 2;
          jcQuery.list.push({type:'nspf',obj:obj});
        }
      }
    });
    console.log(' √ 半全场比分'.dim.grey);
    needle.get(URL.live.replace('{day}',day), done(liveStep));
  }

  //红黄牌数据
  var liveStep = function (response) {
    var $ = cheerio.load(response.body);
    var flag = false;
    var script = null;
    $('script').each(function (i,elm){
      //包含对阵数据
      if(!flag&&$(this).text().indexOf('liveOddsList')!==-1){
        flag = true;
        script = $(this).text();
      }
    });
    //不安全的方法，执行抓取到页面中的脚本，获取对应的赔率数组
    eval(script);

    var tr = $('#table_match tr[fid]');
    if(tr.length>0 && tr.length<data.count){
      data.count = tr.length;
    }
    tr.each(function (i,elm) {
      if($(this).attr('fid')==='-1'){
        data.count--;
      }
    });
    tr.each(function (i,elm) {
      //解析
      var mid = $(this).attr('fid'),
          obj = data.match[mid];
      if(obj){
        //如果之前没有找到iid（如抓取当日数据的情况），则补完
        if(!obj.iid){
          obj.iid = parser.int($(this).attr('infoid'));
          data.iid[obj.iid] = obj;
          jcQuery.dict[obj.iid] = 0;
        }
        obj.home.fullname = parser.trim($(this).find('td[align=right] a').text());
        obj.away.fullname = parser.trim($(this).find('td[align=left] a').text());
        //中立场次
        if(parser.trim($(this).find('td[align=right] font').text())==='(中)'){
          obj.neutral = true;
        }
        //如果有竞彩赔率数据
        if(liveOddsList&&liveOddsList[mid]!==undefined){
          if(liveOddsList[mid].rqsp&&jcQuery.dict[obj.iid]%2!==1){
            jcQuery.dict[obj.iid] += 1;
            jcQuery.list.push({type:'spf',obj:obj});
          }
          if(liveOddsList[mid].sp&&jcQuery.dict[obj.iid]<2){
            jcQuery.dict[obj.iid] += 2;
            jcQuery.list.push({type:'nspf',obj:obj});
          }
        }
        if($(this).find('td').eq(4).text()==='完'){
          obj.done = true;
          //如此时没有比分数据（如抓取当日数据的情况），则补完
          if(!obj.score){
            var half = $(this).find('td').eq(8).text().split('-');
            obj.score = {full:{},half:{}};
            obj.score.full.home = parser.int($(this).find('div.pk a.clt1').text());
            obj.score.full.away = parser.int($(this).find('div.pk a.clt3').text());
            obj.score.half.home = parser.int(half[0]);
            obj.score.half.away = parser.int(half[1]);
          }
          //红黄牌
          obj.card = {yellow:{},red:{}};
          obj.card.yellow.home = parser.int($(this).find('td[align=right] span.yellowcard').text())||0;
          obj.card.yellow.away = parser.int($(this).find('td[align=left] span.yellowcard').text())||0;
          obj.card.red.home    = parser.int($(this).find('td[align=right] span.redcard').text())||0;
          obj.card.red.away    = parser.int($(this).find('td[align=left] span.redcard').text())||0;
        }
        data.home[obj.home.fullname] = obj;
        data.away[obj.away.fullname] = obj;
      }
    });
    console.log(' √ 比赛详情'.dim.grey);
    checkDone();
  }

  //检查当日数据是否已完成更新
  var checkDone = function (){
    Match.getMatchesByDate(day, ep.done(function (ms){
      var alldone = true;
      ms.forEach(function (m){
        if(!m.done){
          alldone = false;
        }
      });
      //如符合所有条件则中止更新
      if(ms.length >= data.count && alldone && force!==true){
        console.info('当日数据已为最新，无需更新');
        return next(day,alldone);
      }else{
        rl = jcQuery.list.length;
        jingcaiLoop();
      }
    }));
  }
  var rl;
  //抓取竞彩赔率数据
  var jingcaiLoop = function (){
    var ql;
    if(rl>5){
      rl -= 5;
      ql = 5;
    }else if(rl>0){
      ql = rl;
      rl = 0;
    }else{
      return preTradeStep();
    }
    //竞彩赔率抓取完成
    ep.after('jingcai',ql,function(){
      ep.unbind();
      if(rl>0){
        jingcaiLoop();
      }else{
        console.log(' √ 竞彩赔率'.dim.grey);
        return preTradeStep();
      }
    });
    //抓取竞彩赔率数据
    for(var j = 0; j<ql; j++){
      var q = jcQuery.list.pop();
      needle.get(URL.jingcai.replace('{iid}',q.obj.iid).replace('{type}',q.type).replace('{day}',day), done(jingcaiStep(q)));
    }
  }
  var jingcaiStep = function (query){
    return function (response) {
      try{
        var odds = JSON.parse(response.body);
      }catch (err) {
        console.error('JSON解析出错，错误信息为：'.red);
        console.error(String(err).grey);
        console.error('准备重新抓取...');
        return next(true);
      }
      var obj = query.obj;
      var last = null;
      obj.jingcai[DICT.JINGCAI[query.type]] = [];
      for(var i = 0; i < odds.length; i++){
        //去掉重复赔率变化（早期数据可能出现此问题）
        if(!(last&&(odds[i].time === last.time && odds[i].win === last.win && odds[i].draw === last.draw && odds[i].lost === last.lost))){
          obj.jingcai[DICT.JINGCAI[query.type]].push({sp:[parser.number(odds[i].win),parser.number(odds[i].draw),parser.number(odds[i].lost)], time: new Date(odds[i].time) });
        }
        last = odds[i];
      }
      ep.emit('jingcai');
    }
  }

  var preTradeStep = function (){
    if(time.compare(day,TODAY)>=0){
      needle.get(URL.trade_today, done(tradeStep));
    }else{
      needle.get(URL.trade.replace('{yyyy}',day_arr[0]).replace('{mm}',day_arr[1]).replace('{dd}',day_arr[2]), done(tradeStep));
    }
  }

  //成交量数据
  var tradeStep = function (response) {
    if(response.body.xml&&response.body.xml.project.row){
      var parse = function (elm) {
        var no  = elm.$,
            obj = data.iid[parser.int(no.id)];
        if(obj&&obj.jingcai){
          obj.jingcai.trade = [parser.int(no.number_3),parser.int(no.number_1),parser.int(no.number_0)];
        }
      }
      if(response.body.xml.project.row.forEach){
        response.body.xml.project.row.forEach(parse);
      }else{
        parse(response.body.xml.project.row);
      }
    }
    console.log(' √ 500.com成交量'.dim.grey);
    needle.get(URL.bwin.replace('{day}',day), done(bwinStep));
  }

  //必发数据
  var bwinStep = function (response) {
    var $ = cheerio.load(response.body);
    var tbody = $('#MatchTable tbody');
    data.bwinCount = tbody.length;
    tbody.each(function (i,elm) {
      var shortcut = parser.trim($(this).find('tr').eq(0).find('td').eq(0).text()),
          home     = parser.trim($(this).find('tr').eq(0).find('td').eq(2).text()),
          away     = parser.trim($(this).find('tr').eq(2).find('td').eq(0).text()),
          obj      = data.shortcut[shortcut]||data.home[home]||data.away[away];
      if(!obj){
        data.bwinCount--;
      }
    });
    tbody.each(function (i,elm) {
      //解析
      var shortcut  = parser.trim($(this).find('tr').eq(0).find('td').eq(0).text()),
          home      = parser.trim($(this).find('tr').eq(0).find('td').eq(2).text()),
          away      = parser.trim($(this).find('tr').eq(2).find('td').eq(0).text()),
          bwin_home = parser.trim($(this).find('tr').eq(0).find('td').eq(10).text()),
          bwin_draw = parser.trim($(this).find('tr').eq(1).find('td').eq(8).text()),
          bwin_away = parser.trim($(this).find('tr').eq(2).find('td').eq(8).text());
          obj       = data.shortcut[shortcut]||data.home[home]||data.away[away];
      if(obj){
        if(bwin_home && bwin_draw && bwin_away){
          obj.bwin = [parser.int(bwin_home),parser.int(bwin_draw),parser.int(bwin_away)];
        }
        if(!obj.done&&parser.trim($(this).find('tr').eq(1).find('td').eq(0).text())!=='平局'){
          data.doneCount++;
          obj.done  = true;
          obj.score = {full:{},half:{}};
          var score = parser.trim($(this).find('tr').eq(1).find('td').eq(0).text()).split('-');
          obj.score.full.home = parser.int(score[0]);
          obj.score.full.away = parser.int(score[1]);
          console.log('已在必发数据中找到缺失的比分：',obj.home.name,'VS',obj.away.name,' - ',score[0],':',score[1]);
        }
      }
    });
    console.log(' √ 必发盈亏'.dim.grey);
    saveAll();
  };
  var saveAll = function (){
    //保存事件响应
    ep.after('match', data.count, function () {
      printer.line();
      console.log('共'+data.teamCount+'支参赛球队');
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
      return next(day);
    });
    ep.fail(function (err){
      ep.unbind();
      console.error('数据库操作出错，错误信息为：'.red);
      console.error(String(err).grey);
      console.error('准备重新抓取...');
      return next(day,false,true);
    });

    printer.line();
    console.log('共'+data.count+'场比赛，抓取必发数据'+data.bwinCount+'场');
    for(var mid in data.match){
      saveMatch(data.match[mid]);
    }
  }
  //保存比赛
  var saveMatch = function (obj){
    Match.getMatchById(obj.mid, ep.done(function (m){
      //如果没有，则创建
      if(!m){
        m = new Match(obj);
        m.save(ep.done('match', function (){
          console.log(' •'.red, obj.shortcut.grey, obj.home.name+(obj.neutral?'(中)'.dim.red:''),'VS'.grey, obj.away.name);
        }));
      //如果已存在比赛
      }else{
        m.date    = obj.date;
        m.odds    = obj.odds;
        m.iid     = obj.iid;
        m.neutral = obj.neutral;
        if(obj.bwin){
          m.bwin = obj.bwin;
        }
        if(obj.jingcai){
          m.jingcai = obj.jingcai;
        }
        //已完赛更新分数
        if(!m.done && obj.done){
          m.score = obj.score;
          m.card  = obj.card;
          m.done  = obj.done;
        }
        m.save(ep.done('match', function (){
          console.log(' •'.green, obj.shortcut.grey, obj.home.name+(obj.neutral?'(中)'.dim.red:''),'VS'.grey, obj.away.name);
        }));
      }
    }));
  };
  var saveGame = function (obj){
    Game.getGameById(obj.gid, ep.done(function (m){
      //如果没有，则创建
      if(!m){
        m = new Game(obj);
        m.save(ep.done('game', function (){
          console.log(' •'.red,obj.name+('/'+obj.gid).dim.gray);
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
          console.log(' •'.red,obj.name+('/'+obj.fullname).gray+('/'+obj.tid).dim.gray);
        }));
      }else{
        m.updated = false;
        m.save(ep.done('team'));
      }
    }));
  };

  needle.get(URL.odds.replace('{day}',day), done(oddsStep));
}
