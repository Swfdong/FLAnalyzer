var _           = require('lodash'),
    util        = require('util'),
    colors      = require('colors'),
    Jetty       = require('jetty');

var jetty = new Jetty(process.stdout);

var progressBar = function (cur,total,str){
  var len = 20;
  var progress = Math.min(len,Math.ceil(cur/total*len));
  jetty.text(' '+(new Array(progress+1).join('█')).grey+(new Array(len+1-progress).join('█')).dim.grey+' '+(cur+'/'+total).grey+(str?str:'').dim.grey+'\r');
}

module.exports    = function(logger){
  //clearline用于长时间抓取的进度显示准备工作，
  //进度显示仅在终端显示时输出，如logger为第三方日志库不会写入日志。
  var clearline   = function(){};
  if(logger === console){
    clearline = function(after){
      jetty.clearLine();
      if(after){
        after();
      }
    }
  }
  var line        = function(grey){
    if(grey){
      logger.log('——————————————————————————————————————————————'.dim.grey);
    }else{
      logger.log('——————————————————————————————————————————————');
    }
  },
  spider_done   = {
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
    }
  },
  //通用输出
  common        = {
    count: function (type,num){
      var dict = {
        match:  '共%d场比赛',
        team:   '共%d支球队',
        game:   '共%d场比赛'
      };
      if(dict[type]){
        line(true);
        logger.log(dict[type].replace('%d',String(num)));
      }
    },
    progress: function (type,current,total,str){
      clearline(function(){
        progressBar(current,total,str);
      });
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
    error: function (type,err,url){
      var dict = {
        needle:  '数据抓取',
        mongo:   '数据库操作',
        json:    'JSON解析'
      };
      if(dict[type]){
        clearline();
        logger.error((dict[type]+'出错，错误信息为：').red+String(err).grey);
        if(url){
          logger.error('重新请求内容：'.grey+url.dim.grey);
        }else{
          logger.error('重新抓取数据...');
        }
      }
    },
    obj: function (obj){
      logger.log(util.inspect(obj, false, null));
    }
  };
  return {
    spider: {
      day: function(){
        return _.assign({
          done: function (type){
            if(spider_done.day[type]){
              clearline();
              logger.log((' √ '+spider_done.day[type]).dim.grey);
            }
          },
          header:function (day){
            line();
            logger.log('正在抓取'+day+'的比赛数据...');
            line();
          }
        },common);
      },
      team: function(){
        return _.assign({
          done: function (type){
            if(spider_done.team[type]){
              logger.log((' √ '+spider_done.team[type]).dim.grey);
            }
          },
          header:function (team){
            line();
            logger.log('正在抓取'+team.name+('('+team.tid+')').grey+'的比赛数据...');
            line();
          }
        },common);
      }
    }
  };
};