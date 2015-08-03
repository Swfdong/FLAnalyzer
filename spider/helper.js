exports.done = function (ep,next,printer){
  return function (step){
    return function (err, response) {
      if (err){
        ep.unbind();
        printer.error('needle',err);
        //自动重试
        return next();
      }else{
        step(response);
      }
    }
  }
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