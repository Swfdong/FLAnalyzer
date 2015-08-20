var _           = require('lodash'),
    util        = require('util'),
    colors      = require('colors'),
    ansi        = require('ansi'),
    time        = require('util'),
    cursor      = ansi(process.stdout);

var replacer = function (str,args){
  if(args){
    while(args.length>0){
      str = str.replace('%d',String(args.shift()));
    }
  }
  return str;
}

var progressBar = function (cur,total,str){
  var len = 20;
  var progress = Math.min(len,Math.ceil(cur/total*len));
  cursor.horizontalAbsolute(0).eraseLine().write(' '+(new Array(progress+1).join('█')).grey+(new Array(len+1-progress).join('█')).dim.grey+' '+(cur+'/'+total).grey+(str?str:'').dim.grey).hide();
}

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
    }
  };
  return {
    spider: {
      day: function(){
        return _.assign({
          header:function (day){
            header('正在抓取'+day+'的比赛数据...');
          }
        },generatorSpider('day'),common);
      },
      team: function(){
        return _.assign({
          header:function (team){
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