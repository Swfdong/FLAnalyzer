var validator   = require('validator');

var score = /\((\d+):(\d+)\) (\d+):(\d+)/;

var fixFloat = function (number){
  return Math.round(number*10000)/10000;
}

var int = exports.int = function (str){
  str = validator.trim(str);
  return parseInt(str);
}

exports.number = function (str){
  str = validator.trim(str);
  str = str.replace(/,/g,'');
  var num;
  //如果包含百分号
  if(str.indexOf('%')!=-1){
    num = parseFloat(str.substring(0,str.indexOf("%")))/100;
  }else{
    num = parseFloat(str);
  }
  return fixFloat(num);
}

exports.tid = function (el){
  if(el.find('a').attr('href')){
    return int(el.find('a').attr('href').match("http://liansai.500.com/team/([0-9]+)/")[1]);
  }
  return 0;
}

exports.sid = function (el){
  if(el.find('a').attr('href')){
    return int(el.find('a').attr('href').match("http://liansai.500.com/zuqiu-([0-9]+)/")[1]);
  }
  return 0;
}

exports.trtd = function (el,tr,td){
  return exports.trim(el.find('tr').eq(tr).find('td').eq(td).text());
}

exports.date = function (str){
  return Date.parse(str.replace(/-/g,"/"));
}

exports.trim = function (str){
  return validator.trim(str.replace(/ /g,''));
}

exports.score = function (str){
  return str.match(score);
}

exports.handicap = function (str){
  return parseInt(str.substr(1,2));
}

exports.price = function (str){
  //如果有球队身价
  if(str.indexOf('球队身价')!=-1&&str.indexOf('--')==-1&&str.indexOf('€')!==-1){
    return parseInt(str.substring(str.indexOf('€')+2,str.indexOf('万')));
  }
  return 0;
}