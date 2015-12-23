var _           = require('lodash'),
    needle      = require('needle'),
    cheerio     = require("cheerio"),
    eventproxy  = require('eventproxy');

var time        = require('../utils/time'),
    formatter   = require('../utils/formatter'),
    parser      = require('../utils/parser'),
    printer     = require('../printer').spider.day(),
    helper      = require('./helper');

var DICT        = require('../configs/spider').dict;

var Match       = require('../models/match'),
    Game        = require('../models/game'),
    Team        = require('../models/team');


//URL
var URL = {
  odds:"http://odds.500.com/index_jczq_{day}.shtml",
  score:'http://zx.500.com/jczq/kaijiang.php?d={day}',
  live:'http://live.500.com/?e={day}',
  jingcai_odds:'http://trade.500.com/jczq/inc/readfile.php?step=readpl&zxid={iid}&wtype={type}&date={day}&g=2',
  jingcai_trade:'http://info.sporttery.cn/basketball/vote/fb_vote.php?&num={day}&type={type}&page={page}',
  bwin:'http://www.310win.com/info/match/Betfair.aspx?date={day}'
  
};

//抓某一日数据
module.exports = function (day, next, force, skip){
  printer.header(day);

  var day_arr = day.split('-'),
      data    = { gameCount:0, teamCount:0, bwinCount:0, tradeCount:0, match:{}, shortcut:{}, iid:{}, hid:{}, aid:{}, home:{}, away:{}, game:{}, team:{} },
      ep      = new eventproxy();

  //处理抓取错误
  var retry = function (){
    next(day,false,true);
    //防止多次调用
    retry = function(){};
  },
  poster = helper.poster(printer);

  //赔率数据
  var oddsStep = function (response) {
    var $      = cheerio.load(response.body),
        flag   = false,
        script = null;
    $('script').each(function (){
      //包含对阵数据
      if(!flag&&$(this).text().indexOf('duizhenList')!==-1){
        flag   = true;
        script = $(this).text();
        script = script.substr(0,script.lastIndexOf('var timeOffset'));
      }
    });
    //不安全的方法，执行抓取到页面中的脚本，获取对应的赔率数组
    script = script||'var ouzhiList=null,yapanList=null;';
    eval(script);
    if(ouzhiList&&yapanList){
      var list = [{l:ouzhiList||{},d:DICT.OUZHI,o:'europe'},{l:yapanList||{},d:DICT.YAPAN,o:'asia'}];
      var tr = $('#main-tbody tr[data-mid]');
      //如果没有数据则跳过
      if(tr.length === 0){
        return next(day);
      }
      data.count = tr.length;
      tr.each(function () {
        //解析代码
        var obj  = { game:{}, home:{}, away:{}, jingcai:{spf:{},rqspf:{}}, odds:{europe:{},asia:{}} },
            mid  = $(this).attr('data-fid'),
            home = $(this).find('td.text_right'),
            away = $(this).find('td.text_left');
        obj.mid       = parser.int(mid);
        obj.done      = false;
        obj.neutral   = false;
        obj.simple    = false;
        obj.date      = day;
        obj.shortcut  = parser.trim($(this).find('td').eq(0).text());
        obj.time      = parser.date($(this).attr('date-dtime'));
        obj.sid       = parser.sid($(this).find('td').eq(1));
        obj.game.name = parser.trim($(this).find('td').eq(1).text());
        obj.game.gid  = parser.int($(this).attr('data-mid'));
        obj.home.name = parser.trim(home.text());
        obj.home.tid  = parser.tid(home);
        obj.away.name = parser.trim(away.text());
        obj.away.tid  = parser.tid(away);

        //更新各家赔率
        var j,current,co;
        list.forEach(function (cl,ci,ca){
          if(cl.l[mid]){
            for(j=0;j<cl.d.length;j++){
              current = cl.d[j];
              co = cl.l[mid][current.id];
              if(co){
                obj.odds[cl.o][current.name] = {
                  now: [co[0][0]||0,co[0][1]||0,co[0][2]||0],
                  first: [co[1][0]||0,co[1][1]||0,co[1][2]||0]
                };
              }
            }
          }
        });
        data.match[mid] = data.hid[obj.home.tid] = data.aid[obj.away.tid] = data.shortcut[obj.shortcut] = obj;
        helper.intake(data,obj);
      });
      //释放可能导致内存泄露的对象
      ouzhiList = yapanList = null;
      printer.done('odds');
      step();
    }else{
      //重试
      printer.error('needle','未找到赔率数据');
      poster.get(URL.odds.replace('{day}',day), oddsStep);
    }
  };

  var jcQuery = {list:[],dict:{}};
  //比分数据，竞彩赔率数据
  var scoreStep = function (response) {
    var $ = cheerio.load(response.body);
    var tr = $('table.ld_table > tr:not(:first-child)');
    tr.each(function () {
      var shortcut = $(this).find('td').eq(0).text(),
          hid      = parser.tid($(this).find('td').eq(3)),
          aid      = parser.tid($(this).find('td').eq(5)),
          obj      = data.shortcut[shortcut]||data.hid[hid]||data.aid[aid];
      if(obj){
        var rq = parser.int($(this).find('td.eng').eq(1).text());
        if(rq){
          obj.jingcai.rqspf.rq = rq;
        }
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
    printer.done('score');
    step();
  };

  //红黄牌数据
  var liveStep = function (response) {
    var $ = cheerio.load(response.body);
    var flag = false;
    var script = null;
    $('script').each(function (){
      //包含对阵数据
      if(!flag&&$(this).text().indexOf('liveOddsList')!==-1){
        flag = true;
        script = $(this).text();
      }
    });
    //不安全的方法，执行抓取到页面中的脚本，获取对应的赔率数组
    eval(script);
    if(!liveOddsList){
      var liveOddsList ={};
    }
    var tr = $('#table_match tr[fid]');
    if(tr.length>0 && tr.length<data.count){
      data.count = tr.length;
    }
    tr.each(function () {
      if($(this).attr('fid')==='-1'){
        data.count--;
      }
    });
    tr.each(function () {
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
        var rq = parser.handicap($(this).find('td[align=right] span.sp_sr').text())||parser.handicap($(this).find('td[align=right] span.sp_rq').text());
        if(obj.jingcai.rqspf.rq === undefined && rq){
          obj.jingcai.rqspf.rq = rq;
        }
        obj.home.fullname = parser.trim($(this).find('td[align=right] a').text());
        //中立场次
        if(parser.trim($(this).find('td[align=right] font').text())==='(中)'){
          obj.neutral = true;
        }
        //如果有竞彩赔率数据
        if(liveOddsList[mid]!==undefined){
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
    printer.done('live');
    checkDone();
  };

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
        console.info('当日数据已为最新，无需更新。');
        return next(day,alldone);
      }else{
        tl = rl = jcQuery.list.length;
        step();
      }
    }));
  };
  var tl,rl,h,p,jd,lt;
  //抓取竞彩赔率数据
  var jingcaiOddsLoop = function (){
    var ql;
    if(rl>0){
      ql = Math.min(4,rl);
      rl -= ql;
    }else{
      return jingcaiOddsDone();
    }
    //竞彩赔率抓取完成
    ep.after('jingcaiOdds',ql,function(){
      ep.unbind();
      if(rl>0){
        jingcaiOddsLoop();
      }else{
        return jingcaiOddsDone();
      }
    });
    printer.progress('jcOdds',tl-rl,tl);
    //抓取竞彩赔率数据
    for(var j = 0; j<ql; j++){
      var q = jcQuery.list.pop();
      poster.json(URL.jingcai_odds.replace('{iid}',q.obj.iid).replace('{type}',q.type).replace('{day}',day), jingcaiOddsStep(q));
    }
  };
  var jingcaiOddsStep = function (query){
    return function (json) {
      if(json){
        var obj = query.obj;
        var last = null;
        obj.jingcai[DICT.JINGCAI[query.type]].sp = [];
        for(var i = 0; i < json.length; i++){
          //去掉重复赔率变化（早期数据可能出现此问题）
          if(!(last&&(json[i].time === last.time && json[i].win === last.win && json[i].draw === last.draw && json[i].lost === last.lost))){
            obj.jingcai[DICT.JINGCAI[query.type]].sp.push({data:[parser.number(json[i].win),parser.number(json[i].draw),parser.number(json[i].lost)], time: new Date(json[i].time) });
          }
          last = json[i];
        }
      }
      ep.emit('jingcaiOdds');
    }
  };
  var jingcaiOddsDone = function(){
    printer.done('jcOdds');
    step();
  };
  //竞彩成交量数据，竞彩官方数据很乱，要从上一天开始抓
  var jingcaiTradeStart = function (){
    h  = 0;
    p  = 1;
    jd = -1;
    lt = '';
    jingcaiTradeLoop();
  }
  var jingcaiTradeLoop = function (){
    poster.get(URL.jingcai_trade.replace('{day}',formatter.dateToString(time.tomorrow(day,jd))).replace('{type}',DICT.HAD[h].type).replace('{page}',p), jingcaiTradeStep);
  };
  var jingcaiTradeStep = function (response) {
    var $ = cheerio.load(response.body);
    var block = $('.leftMain .block');
    //当天没有数据或已抓到最后一页
    if(block.length === 0||$('.leftMain .block .blockTit a').eq(0).text() === lt){
      var flag = 2;
      if(h<1){
        h++;
        p = 1;
        flag = 1;
        data.tradeCount = 0;
      }else if(jd<1){
        jd++;
        h = 0;
        p = 1;
        flag = 1;
      }
      if(flag === 1){
        return jingcaiTradeLoop();
      }else if(flag === 2){
        printer.done('jcTrade');
        step();
      }
    }else{
      lt = $('.leftMain .block .blockTit a').eq(0).text();
      block.each(function(i){
        var tt = $(this).find('.blockTit a').text().split(' ');
        var tr = $(this).find('tr:not(.tr1) td .zhichi');
        var obj= data.shortcut[tt[0]];
        if(obj){
          obj.jingcai[DICT.HAD[h].name].trade = [parser.int(tr.eq(0).text())||0,parser.int(tr.eq(1).text())||0,parser.int(tr.eq(2).text())||0];
          data.tradeCount++;
        }
      });
      printer.progress('jcTrade',data.tradeCount,data.count,' /'+formatter.dateToString(time.tomorrow(day,jd))+'/'+h+'/'+p);
      p++;
      jingcaiTradeLoop();
    }
  };

  //必发数据
  var bwinStep = function (response) {
    var $ = cheerio.load(response.body);
    var tbody = $('#MatchTable tbody');
    data.bwinCount = tbody.length;
    tbody.each(function () {
      //解析
      var shortcut  = parser.trtd($(this),0,0),
          home      = parser.trtd($(this),0,2),
          away      = parser.trtd($(this),2,0),
          bwin_home = parser.trtd($(this),0,10),
          bwin_draw = parser.trtd($(this),1,8),
          bwin_away = parser.trtd($(this),2,8),
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
        }
      }else{
        data.bwinCount--;
      }
    });
    printer.done('bwin');
    step();
  };
  var saveAll = function (){
    helper.saveAll(data,ep,printer,{
      match: saveMatch,
      team: saveTeam,
      game: saveGame,
      next: function(){
        return next(day);
      },
      retry: retry
    });
  };
  //保存比赛
  var saveMatch = function (obj){
    Match.getMatchById(obj.mid, ep.done(function (m){
      //如果没有，则创建
      if(!m){
        m = new Match(obj);
        m.save(ep.done('match', function (o){
          printer.save(o);
        }));
      //如果已存在比赛
      }else{
        _.assign(m,obj);
        m.save(ep.done('match', function (o){
          printer.save(o,true);
        }));
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
        m.save(ep.done('team', function (o){
          printer.save(o);
        }));
      }else{
        m.updated = false;
        m.save(ep.done('team'));
      }
    }));
  };
  //抓取步骤
  var step = helper.step([
    { code:'odds', func:function(){
      poster.get(URL.odds.replace('{day}',day), oddsStep);
    }},
    { code:'score', func:function(){
      poster.get(URL.score.replace('{day}',day), scoreStep);
    }},
    { code:'live', func:function(){
      poster.get(URL.live.replace('{day}',day), liveStep);
    }},
    { code:'jcOdds', func: jingcaiOddsLoop },
    { code:'jcTrade', func: jingcaiTradeStart },
    { code:'bwin', func:function(){
      poster.get(URL.bwin.replace('{day}',day), bwinStep);
    }},
    { code:'save', func: saveAll }
  ],skip,printer);

  step();
}
