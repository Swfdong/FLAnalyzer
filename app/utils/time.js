var fixedInt = function (num){
  var str = ''+num;
  while(str.length<2){
    str = '0'+str;
  }
  return str;
}

var dateToString = exports.dateToString = function (d){
  return d.getFullYear()+'-'+fixedInt((d.getMonth()+1))+'-'+fixedInt(d.getDate());
}

exports.timeToString = function (d){
  return fixedInt(d.getHours())+':'+fixedInt(d.getMinutes());
}

exports.today = function (){
  return dateToString(new Date(Date.now()));
}

exports.tomorrow = function (dt,n){
  dt = new Date(dt);
  dt.setDate(dt.getDate()+(n===undefined?1:n));
  return dateToString(dt);
}

exports.yesterday = function (dt,n){
  dt = new Date(dt);
  dt.setDate(dt.getDate()-(n===undefined?1:n));
  return dateToString(dt);
}

exports.compare = function (d1,d2){
  var dd1 = new Date(d1);
  var dd2 = new Date(d2);
  if(dd1>dd2){
    return 1;
  }else if(dd1<dd2){
    return -1;
  }
  return 0;
}

var duration = function (d){
  d = Math.floor((Date.now() - d)/1000);
  var time = d>=0?     (d%60+'秒') : '';
      time = d>=60?    (Math.floor(d/60)%60+'分'+time) : time;
      time = d>=3600?  (Math.floor(d/3600)+'时'+time) : time;
  return time;
}

var timestamp;
exports.start = function (){
  timestamp = Date.now();
}

exports.mark = function (){
  return duration(timestamp);
}