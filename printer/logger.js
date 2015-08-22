var _           = require('lodash'),
    util        = require('util'),
    colors      = require('colors'),
    ansi        = require('ansi'),
    time        = require('util'),
    converter   = require('../utils/converter'),
    cursor      = ansi(process.stdout);

var DICT        = require('../configs/printer').dict;

var Match       = require('../models/match');

var replacer = function (str,args){
  if(args){
    while(args.length>0){
      str = str.replace('%d',String(args.shift()));
    }
  }
  return str;
};
var progressBar = function (cur,total,str){
  var len = 20;
  var progress = Math.min(len,Math.ceil(cur/total*len));
  cursor.horizontalAbsolute(0).eraseLine().write(' '+(new Array(progress+1).join('█')).grey+(new Array(len+1-progress).join('█')).dim.grey+' '+(cur+'/'+total).grey+(str?str:'').dim.grey).hide();
};

module.exports    = function(logger){
  var isConsole       = logger === console? true:false,
      isLastLineError = false,
      isLastLineStart = false,
      clearLine       = function(){},
      deleteLine      = function(){};
  //clearLine用于长时间抓取的进度显示准备工作，
  //进度显示仅在终端显示时输出，如logger为第三方日志库不会写入日志。
  if(isConsole){
    clearLine = function(){
      if(isLastLineError){
        cursor.previousLine().eraseLine().previousLine().eraseLine();
        isLastLineError = false;
      }
      cursor.horizontalAbsolute(0).eraseLine();
    }
    deleteLine = function(){
      if(isLastLineStart){
        cursor.previousLine().eraseLine();
        isLastLineStart = false;
      }
    }
  };
  var header  = function (str){
    clearLine();
    line();
    logger.log(str);
    line();
  },
  line = function (grey){
    if(grey){
      logger.log('——————————————————————————————————————————————'.dim.grey);
    }else{
      logger.log('——————————————————————————————————————————————');
    }
  },
  europeOdds = function (match){
    var updown = function (odds){
      var result = [odds.now[0],odds.now[1],odds.now[2]];
      for(var i=0;i<3;i++){
        if(result[i]<odds.first[i]){
          result[i] = converter.fixedBySpace(result[i]).green;
        }else if(result[i]>odds.first[i]){
          result[i] = converter.fixedBySpace(result[i]).red;
        }else{
          result[i] = converter.fixedBySpace(result[i]);
        }
      }
      return result;
    }
    logger.log('赔率\t\t主胜 \t平局 \t主负 \t赔付率'.grey);
    _.forIn(DICT.COMPANY,function (name,key){
      var data = match.odds.europe[key];
      var first = converter.fixedBySpace(data.first);
      if(first[0]){
        var ud = updown(data);
        line(true);
        logger.log(name+' \t'+ud[0]+'\t'+ud[1]+'\t'+ud[2]+'\t'+converter.fixedNumber(Match.claimRatio(data.now)));
        logger.log('        \t'+first[0]+'\t'+first[1]+'\t'+first[2]+'\t'+converter.fixedNumber(Match.claimRatio(data.first)));
      }
    });
  },
  bwinProfits = function (match){
    if(match.bwin[0]){
      var bwin = _.clone(match.bwin);
      for(var i=0;i<bwin.length;i++){
        if(bwin[i]<-500000){
          bwin[i] = converter.fixedBySpace(bwin[i],6).green;
        }else if(bwin[i]>500000){
          bwin[i] = converter.fixedBySpace(bwin[i],6).red;
        }else{
          bwin[i] = converter.fixedBySpace(bwin[i],6);
        }
      }
      line();
      logger.log('必发盈亏  \t主胜 \t平局 \t主负'.grey);
      logger.log('         \t'+bwin[0]+'\t'+bwin[1]+'\t'+bwin[2]);
    }
  },
  jingcaiProfits = function (match){
    if(match.tradeRatio()){
      var jingcaiTrade = _.clone(match.jingcai.spf.trade);
      for(var i=0;i<jingcaiTrade.length;i++){
        if(jingcaiTrade[i]>10000){
          jingcaiTrade[i] = converter.fixedBySpace(jingcaiTrade[i],6).red;
        }else{
          jingcaiTrade[i] = converter.fixedBySpace(jingcaiTrade[i],6);
        }
      }
      var jingcaiRatio = match.tradeRatio();
      var jingcaiSp = match.jingcai.spf.sp[match.jingcai.spf.sp.length-1].data;
      var jingcaiPb = Match.probability(jingcaiSp);
      for(var i=0;i<jingcaiRatio.length;i++){
        if(jingcaiRatio[i]-jingcaiPb[i]>=0.1){
          jingcaiRatio[i] = converter.fixedNumber(jingcaiRatio[i],6).green;
        }else if(jingcaiRatio[i]-jingcaiPb[i]<=-0.1){
          jingcaiRatio[i] = converter.fixedNumber(jingcaiRatio[i],6).red;
        }else{
          jingcaiRatio[i] = converter.fixedNumber(jingcaiRatio[i],6);
        }
        jingcaiPb[i] = converter.fixedNumber(jingcaiPb[i],6);
      }
      line();
      logger.log('竞彩数据  \t主胜 \t平局 \t主负'.grey);
      line(true);
      logger.log('成交量   \t'+jingcaiTrade[0]+'\t'+jingcaiTrade[1]+'\t'+jingcaiTrade[2]);
      line(true);
      logger.log('成交比例 \t'+jingcaiRatio[0]+'\t'+jingcaiRatio[1]+'\t'+jingcaiRatio[2]);
      line(true);
      logger.log('赔率概率 \t'+jingcaiPb[0]+'\t'+jingcaiPb[1]+'\t'+jingcaiPb[2]);
    }
  },
  generatorSpider = function (spider_type){
    return {
      start: function (type){
        isLastLineStart = true;
        if(spider_dict[spider_type][type]){
          clearLine();
          logger.log((' • '+spider_dict[spider_type][type]).dim.grey);
        }
      },
      done: function (type){
        if(spider_dict[spider_type][type]){
          clearLine();
          deleteLine();
          logger.log((' √ '+spider_dict[spider_type][type]).grey);
        }
      }
    };
  },
  replaceAndLog = function (raw,raw_args,color){
    if(color === undefined){
      color = 'reset';
    }
    var args = Array.prototype.slice.call(raw_args);
    args.shift();
    logger.log(replacer(raw,args)[color]);
  }
  spider_dict = {
    day: {
      odds:   '基本信息',
      score:  '半全场比分',
      live:   '红黄牌',
      jcOdds: '竞彩赔率 ',
      jcTrade:'竞彩成交量 ',
      bwin:   '必发数据'
    },
    team: {
      home:   '主场数据',
      away:   '客场数据'
    },
    main: {
      day:{
        start:  '检查并抓取每日赛事数据...',
        done:   '自%d至%d的赛事数据已更新。'
      },
      team:{
        start:  '检查并抓取球队赛事数据...',
        done:   '%d支球队已更新完毕，重新检测需更新的球队...'
      },
      all:{
        start:  '开始抓取竞彩足球赛事数据：',
        done:   '全部%d支球队已更新完毕，耗时%d'
      }
    }
  },
  //通用输出
  common = {
    count: function (type){
      var dict = {
        match:  '共%d场比赛',
        team:   '共%d支球队',
        game:   '共%d场比赛'
      };
      if(dict[type]){
        line(true);
        replaceAndLog(' '+dict[type],arguments);
      }
    },
    progress: function (type,current,total,str){
      clearLine();
      progressBar(current,total,str);
    },
    save: function (data,update){
      update = update||false;
      var dot = { false: ' •'.red, true:' •'.green };
      if(data.mid){
        logger.log(dot[update], data.shortcut.grey, data.home.name+(data.neutral?'(中)'.dim.red:''),'VS'.grey, data.away.name, (data.score.full.home!==undefined?('('+data.score.full.home+':'+data.score.full.away+')'):'').grey);
      }else if(data.tid){
        logger.log(dot[update], data.name+(data.fullname?('/'+data.fullname).gray:'')+('/'+data.tid).dim.gray);
      }else if(data.gid){
        logger.log(dot[update], data.name+(data.fullname?('/'+data.fullname).gray:'')+('/'+data.gid).dim.gray);
      }
    },
    error: function (type,err){
      var dict = {
        needle:       { info:'数据抓取',retry:true },
        mongo_conn:   { info:'数据库连接',retry:false },
        mongo_query:  { info:'数据库读取',retry:false },
        mongo_save:   { info:'数据库写入',retry:true },
        json:         { info:'JSON解析',retry:true }
      };
      if(dict[type]){
        clearLine();
        isLastLineError = true;
        logger.error(' '+(dict[type].info+'出错，错误信息为：').red+String(err).grey);
        if(dict[type].retry){
          logger.error(' 重新请求内容...');
        }
      }
    },
    obj: function (obj){
      logger.log(JSON.stringify(obj,'','  '));
    },
    match: function (match){
      header('\n'+converter.dateToString(match.time).grey+'\t'+match.shortcut+(' '+match.game.name+' ').red+match.home.name+' VS '.dim.grey+match.away.name+'\n');
      europeOdds(match);
      bwinProfits(match);
      jingcaiProfits(match);
    }
  };
  return {
    spider: {
      day: function(){
        return _.assign({
          header:function (day){
            clearLine();
            header('正在抓取'+day+'的比赛数据...');
          }
        },generatorSpider('day'),common);
      },
      team: function(){
        return _.assign({
          header:function (team){
            clearLine();
            header('正在抓取'+team.name+('('+team.tid+')').grey+'的比赛数据...');
          }
        },generatorSpider('team'),common);
      },
      main: function(){
        return _.assign({
          start: function (type){
            if(spider_dict.main[type]){
              clearLine();
              replaceAndLog(spider_dict.main[type].start,arguments,'blue');
            }
          },
          done: function (type){
            if(spider_dict.main[type]){
              clearLine();
              replaceAndLog(spider_dict.main[type].done,arguments,'blue');
            }
          },
          header:function (team){
            header('开始抓取竞彩足球赛事数据...');
          }
        },common);
      }
    }
  };
};