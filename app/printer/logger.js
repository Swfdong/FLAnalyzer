var _           = require('lodash'),
    util        = require('util'),
    colors      = require('colors'),
    ansi        = require('ansi'),
    time        = require('../utils/time'),
    cli         = require('../utils/cli'),
    converter   = require('../utils/converter'),
    cursor      = ansi(process.stdout);

var CONFIG      = require('../configs/printer'),
    COMPANY     = require('../configs/company');

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
  line = function (grey,len){
    len = len===undefined?CONFIG.COLUMN_LINE:len;
    var str = Array(len).join(grey?'—':'━');
    if(grey){
      logger.log(str.dim.grey);
    }else{
      logger.log(str);
    }
  },
  emptyLine = function(){
    logger.log();
  },
  updown = function (odds,asia){
    var convert = function(num,i){
      if(asia){
        num = String(num);
        if(i===1){
          return CONFIG.PANKOU[num].column(CONFIG.COLUMN_PANKOU,'center');
        }else if(i===0){
          return num.column(CONFIG.COLUMN_YAPAN_LEFT,'right');
        }
      }
      return num.column();
    }
    var result = [odds.now[0],odds.now[1],odds.now[2]];
    for(var i=0;i<3;i++){
      if(result[i]<odds.first[i]){
        result[i] = convert(result[i],i).green;
      }else if(result[i]>odds.first[i]){
        result[i] = convert(result[i],i).red;
      }else{
        result[i] = convert(result[i],i);
      }
    }
    return result;
  },
  printHDA = function (title,arr,noline){
    if(noline === undefined||!noline){
      line(true);
    }
    logger.log(title.column(CONFIG.COLUMN_HEADER)+arr.join(''));
  },
  europeOdds = function (match){
    logger.log('欧赔'.column(CONFIG.COLUMN_HEADER)+('主胜'.column()+'平局'.column()+'主负'.column()+'赔付率'.column()).grey);
    _.forEach(COMPANY.europe,function (comp){
      var data  = match.odds.europe[comp.name];
      if(data.first&&data.first[0]){
        var ud    = updown(data),
            first = data.first.concat();
        ud.push(converter.claimRatio(data.now).column());
        first.push(converter.claimRatio(data.first));
        printHDA(comp.print.grey,ud);
        printHDA('        ',first.column(),true);
      }
    });
  },
  asiaOdds = function (match){
    logger.log('亚盘'.column(CONFIG.COLUMN_HEADER)+('主胜'.column(CONFIG.COLUMN_YAPAN_LEFT,'right')+'盘口'.column(CONFIG.COLUMN_PANKOU,'center')+'主负'.column()).grey);
    _.forEach(COMPANY.asia,function (comp){
      var data  = match.odds.asia[comp.name];
      if(data.first&&data.first[0]){
        var ud    = updown(data,true),
            first = data.first.map(String);
        first = [first[0].column(CONFIG.COLUMN_YAPAN_LEFT,'right'),CONFIG.PANKOU[first[1]].column(CONFIG.COLUMN_PANKOU,'center'),first[2].column()];
        printHDA(comp.print.grey,ud);
        printHDA('        ',first,true);
      }
    });
  },
  bwinProfits = function (match){
    if(match.bwin[0]){
      var bwin = _.clone(match.bwin);
      for(var i=0;i<bwin.length;i++){
        if(bwin[i]<-500000){
          bwin[i] = bwin[i].column().green;
        }else if(bwin[i]>500000){
          bwin[i] = bwin[i].column().red;
        }else{
          bwin[i] = bwin[i].column();
        }
      }
      printHDA('必发盈亏',bwin);
    }
  },
  jingcaiProfits = function (match){
    ['spf','rqspf'].forEach(function (type){
      if(match.jingcai[type].now){
        var jingcaiSp = _.clone(match.jingcai[type].now),
            jingcaiPb = converter.probability(jingcaiSp);
        for(var i=0;i<jingcaiSp.length;i++){
          if(match.jingcai[type].results){
            jingcaiSp[i] = (match.jingcai[type].results[i]?String(jingcaiSp[i]).inverse:jingcaiSp[i]).column();
          }else{
            jingcaiSp[i] = jingcaiSp[i].column();
          }
        }
        jingcaiSp.push(converter.claimRatio(match.jingcai[type].now).column());
        if(type==='spf'){
          printHDA('竞彩赔率',jingcaiSp);
        }else{
          var jingcaiRq = match.jingcai.rqspf.rq;
          jingcaiRq = jingcaiRq === undefined? 0:jingcaiRq;
          printHDA('让球'+('('+jingcaiRq.signed()+')').red,jingcaiSp);
        }
        printHDA('赔率概率'.grey,jingcaiPb.column(),true);

        if(match.jingcai[type].trade){
          var jingcaiTrade = _.clone(match.jingcai[type].trade);
          for(var i=0;i<jingcaiTrade.length;i++){
            if(jingcaiTrade[i]>10000){
              jingcaiTrade[i] = jingcaiTrade[i].column().red;
            }else{
              jingcaiTrade[i] = jingcaiTrade[i].column();
            }
          }
          printHDA('成交量'.grey,jingcaiTrade,true);
        }

        if(match.jingcai[type].ratio){
          var jingcaiRatio = _.clone(match.jingcai[type].ratio);
          for(var i=0;i<jingcaiRatio.length;i++){
            if(jingcaiRatio[i]-jingcaiPb[i]>=0.15){
              jingcaiRatio[i] = jingcaiRatio[i].column().green;
            }else if(jingcaiRatio[i]-jingcaiPb[i]<=-0.15){
              jingcaiRatio[i] = jingcaiRatio[i].column().red;
            }else{
              jingcaiRatio[i] = jingcaiRatio[i].column();
            }
          }
          printHDA('成交比例'.grey,jingcaiRatio,true);
        }
      }
    });

  },
  scoreAndPredict = function (match){
    if(match.score.full.home!==undefined){
      printHDA('终场比分',[match.score.full.home,':',match.score.full.away].column(CONFIG.COLUMN_SCORE));
      printHDA('半场比分'.grey,[match.score.half.home,':',match.score.half.away].column(CONFIG.COLUMN_SCORE),true);
    }
  },
  scoreBanner = function (match){
    if(match.score.full.home!==undefined){
      var score = (match.score.full.home+':'+match.score.full.away).split('');
      score = score.map(cli.score);
      var banner = '';
      for(var i=0;i<score[0].length;i++){
        for(var j=0;j<score.length;j++){
          banner += score[j][i];
        }
        banner += '\n'+''.column(CONFIG.COLUMN_HEADER);
      }
      logger.log('终场比分'.column(CONFIG.COLUMN_HEADER)+banner.grey);
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
      away:   '客场数据',
      price:  '球队身价',
      future: '未来赛事'
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
        logger.log(dot[update], data.shortcut?data.shortcut.grey:'', data.home.name+(data.neutral?'(中)'.dim.red:''),'VS'.grey, data.away.name, (data.score.full.home!==undefined?('('+data.score.full.home+':'+data.score.full.away+')'):'').grey);
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
    viewer: _.assign({
      match: function (match){
        ["home","away"].forEach(function(type){
          if(match[type].fullname == undefined){
            match[type].fullname = "";
          }
        });
        header(
          time.dateToString(match.time).column(CONFIG.COLUMN_HEADER,'center').dim.grey
          + ''.column(CONFIG.COLUMN_HEADER)
          + match.game.name.column(CONFIG.COLUMN_VS,'center').cyan
          + '\n'
          + (match.shortcut||'').column(CONFIG.COLUMN_HEADER,'center')
          + match.home.name.column(CONFIG.COLUMN_HEADER,'right')
          + ' VS '.column(CONFIG.COLUMN_VS,'center').dim.grey
          + match.away.name.column(CONFIG.COLUMN_HEADER)
          + '\n'
          + time.timeToString(match.time).column(CONFIG.COLUMN_HEADER,'center').dim.grey
          + match.home.fullname.dim.grey.column(CONFIG.COLUMN_HEADER,'right')
          + (match.neutral?'中立'.dim.red:'').column(CONFIG.COLUMN_VS,'center')
          + match.away.fullname.dim.grey.column(CONFIG.COLUMN_HEADER)
        );
        asiaOdds(match);
        line(true);
        europeOdds(match);
        bwinProfits(match);
        jingcaiProfits(match);
        scoreAndPredict(match);
        //scoreBanner(match);
        emptyLine();
      }
    },common),
    spider: {
      day: _.assign({
        header:function (day){
          clearLine();
          header('正在抓取'+day+'的比赛数据...');
        }
      },generatorSpider('day'),common),
      team: _.assign({
        header:function (team){
          clearLine();
          header('正在抓取'+team.name+('('+team.tid+')').grey+'的比赛数据...');
        }
      },generatorSpider('team'),common),
      main: _.assign({
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
      },common)
    }
  };
};