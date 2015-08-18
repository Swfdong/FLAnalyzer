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


exports.get = function(printer){
  var handler = function (url,step){
    needle.get(url, function (err,response){
      //出错自动重试
      if (err){
        printer.error('needle',err,url);
        _.delay(function(){
          handler(url,step)
        },1000);
      }else{
        step(response);
      }
    });
  }
  return handler;
}

exports.json = function (data,next,printer){
  var result;
  try{
    result = JSON.parse(data);
  }catch (err) {
    printer.error('json',err);
    return next();
  }
  return result;
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