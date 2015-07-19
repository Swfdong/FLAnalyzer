exports.tomorrow = function (dt,n){
  dt = new Date(dt);
  dt.setDate(dt.getDate()+(n||1));
  return dt;
}

exports.yesterday = function (dt,n){
  dt = new Date(dt);
  dt.setDate(dt.getDate()-(n||1));
  return dt;
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