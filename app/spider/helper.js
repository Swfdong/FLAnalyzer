var _           = require('lodash'),
    needle      = require('needle');

needle.defaults({
  open_timeout:2500,
  read_timeout:5000,
  json:true,
  headers:{
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Encoding': 'gzip, deflate, sdch'
  }
});
exports.step = function (steps,skip,printer){
  return function(){
    //跳过步骤
    while(_.indexOf(skip,steps[0].code)!=-1){
      steps.shift();
    }
    //如果剩余步骤
    if(steps.length>0){
      var next = steps.shift();
      if(next.code!=='save'){
        printer.start(next.code);
      }
      next.func();
    }
  }
}

exports.poster = function(printer){
  var handler = function (url,step){
    needle.get(url, function (err,response){
      //出错自动重试
      if (err || response.statusCode !== 200){
        printer.error('needle',err);
        _.delay(function(){
          handler(url,step)
        },1000);
      }else{
        step(response);
      }
    });
  };
  var jsonHandler = function (url,step){
    handler(url,function (response){
      var result;
      //解析出错自动重试
      try{
        result = JSON.parse(response.body);
      }catch (err) {
        printer.error('json',err);
        return jsonHandler(url,step);
      }
      return step(result);
    });
  }
  return {get:handler,json:jsonHandler};
}

exports.intake = function (data,obj){
  [ ['game','game','gid'],
    ['team','home','tid'],
    ['team','away','tid']].forEach(function (arr){
    if(data[arr[0]][obj[arr[1]][arr[2]]]===undefined){
      data[arr[0]][obj[arr[1]][arr[2]]] = obj[arr[1]];
      data[arr[0]+'Count']++;
    }
  });
}

exports.saveAll = function (data,ep,printer,handlers){
  //保存事件响应
  ep.after('match', data.count, function () {
    printer.count('team',data.teamCount);
    _.forEach(data.team,handlers.team);
  });
  ep.after('team', data.teamCount, function () {
    printer.count('game',data.gameCount);
    _.forEach(data.game,handlers.game);
  });
  ep.after('game', data.gameCount, handlers.next);
  ep.fail(function (err){
    ep.unbind();
    printer.error('mongo_save',err);
    return handlers.retry();
  });
  //保存数据
  printer.count('match',data.count);
  _.forEach(data.match,handlers.match);
}