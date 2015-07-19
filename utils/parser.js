var validator   = require('validator');

var score = /\((\d+):(\d+)\) (\d+):(\d+)/;
var handicap = /\(([+-]\d)\)$/;

var fixFloat = function (number){
  return Math.round(number*10000)/10000;
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

exports.int = function (str){
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