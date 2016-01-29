var _ = require('lodash');

var reciprocal = function (n){
  if(!n) return 0;
  return 1/n;
}

var log = function (n){
  n = n + 1;
  if(!n) return 0;
  return Math.log(n)/Math.LN10;
}

var pow = function (n){
  if(!n) return 0;
  return Math.pow(10,n) - 1;
}

var fixFloat = exports.fixFloat = function (number){
  return Math.round(number*10000)/10000;
}

exports.profit = function (raw){
  var result = [0,0,0];
  //必发盈亏位数对
  var digi = [0,0.025,0.05,0.1,0.2,0.3,0.4,0.45,0.5];
  var factor = [0,0.0025,0.005,0.01,0.01,0.005,0.005,0];
  for(var i = 0; i<3; i++){
    var q = raw[i]<0?-1:1;
    var s = String(Math.abs(raw[i]));
    result[i] = (digi[s.length-1]+parseInt(s.substr(0,1)) * factor[s.length-1]) * q;
  }
  return result;
}

exports.score = function (score){
  var dict = {
    '0': 0,
    '1': 0.25,
    '2': 0.5,
    '3': 0.65,
    '4': 0.75,
    '5': 0.85,
    '6': 0.9,
    '7': 0.95,
    '8': 0.975,
    '9': 0.99,
    '10': 1
  }
  if( score.full !== undefined ){
    return [dict[String(score.full.home)], dict[String(score.full.away)]];
  }
  return guess(score);
}

var guess = function (raw){
  var p = 0;
  var tmp = [[],[]];
  var result = [];
  while(p<raw.length){
    if(raw[p]<0.2){
      tmp[p].push(0);
    }else if(raw[p]<0.3){
      tmp[p].push(1);
      tmp[p].push(0);
    }else if(raw[p]<0.45){
      tmp[p].push(1);
      tmp[p].push(2);
    }else if(raw[p]<0.65){
      tmp[p].push(2);
      tmp[p].push(3);
    }else if(raw[p]<0.75){
      tmp[p].push(3);
      tmp[p].push(4);
    }else if(raw[p]<0.85){
      tmp[p].push(4);
      tmp[p].push(5);
    }else if(raw[p]<0.95){
      tmp[p].push(5);
      tmp[p].push(6);
    }else{
      tmp[p].push(6);
      tmp[p].push(7);
    }
    p++;
  }
  for(var i = 0;i<tmp[0].length;i++){
    for(var j = 0;j<tmp[1].length;j++){
      result.push(tmp[0][i]+':'+tmp[1][j]);
    }
  }
  return result;
}

var diff = exports.diff = function (a, b){
  var result = [];
  for(var i = 0;i<a.length;i++){
    result.push((b[i]-a[i])/a[i]);
  }
  return result;
}

exports.percent = function (raw){
  var total = raw[0]+raw[1]+raw[2];
  return [raw[0]/total, raw[1]/total, raw[2]/total];
}

exports.europeOdds = function (odds){
  var arr = [reciprocal(odds[0]), reciprocal(odds[1]), reciprocal(odds[2])];
  if(odds[3]!==undefined){
    arr.push(0.5 - reciprocal(odds[3])/2);
  }
  return arr;
}

exports.asiaOdds = function (odds){
  var dict = {
    '-0.25': 0.45,
    '-0.5': 0.4,
    '-0.75': 0.35,
    '-1': 0.3,
    '-1.25': 0.275,
    '-1.5': 0.25,
    '-1.75': 0.225,
    '-2': 0.2,
    '-2.25': 0.175,
    '-2.5': 0.15,
    '-2.75': 0.125,
    '-3': 0.1,
    '-3.25': 0.09,
    '-3.5': 0.08,
    '-3.75': 0.07,
    '-4': 0.06,
    '-4.25': 0.05,
    '-4.5': 0.04,
    '-4.75': 0.03,
    '-5': 0.02,
    '0': 0.5,
    '0.25': 0.55,
    '0.5': 0.6,
    '0.75': 0.65,
    '1': 0.7,
    '1.25': 0.725,
    '1.5': 0.75,
    '1.75': .775,
    '2': 0.8,
    '2.25': 0.825,
    '2.5': 0.85,
    '2.75': 0.875,
    '3': 0.9,
    '3.25': 0.91,
    '3.5': 0.92,
    '3.75': 0.93,
    '4': 0.94,
    '4.25': 0.95,
    '4.5': 0.96,
    '4.75': 0.97,
    '5': 0.98
  }
  var arr = [odds[0]/1.4, dict[String(odds[1])], odds[2]/1.4];
  return arr;
}

