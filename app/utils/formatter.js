var _           = require('lodash'),
    validator   = require('validator');

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

var fixedInt = exports.fixedInt = function (num,dig){
  var str = ''+num;
  while(str.length<dig){
    str = '0'+str;
  }
  return str;
}

var fixFloat = exports.fixFloat = function (number){
  return Math.round(number*10000)/10000;
}

var signedNumber = exports.signedNumber = function (num){
  var str = ''+num;
  if(num > 0){
    str = '+'+str;
  }
  return str;
}

var fixedNumber = exports.fixedNumber = function (num,dig){
  if(num===undefined||num===null){
    return ' - ';
  }
  dig = dig|4;
  var str = ''+num;
  if(str.length < dig){
    if(str.indexOf('.') === -1){
      str+='.0';
    }
    if(str.indexOf('0') === 0){
      while(str.length<dig){
        str = str+'0';
      }
    }else{
      while(str.length<dig){
        if(str.indexOf('.')==Math.ceil((dig-1)/2)){
          str = str+'0';
        }else{
          str = '0'+str;
        }
      }
    }
  }else if(str.length > dig){
    str = str.substr(0,dig);
  }
  
  return str;
}

var fixedBySpace = exports.fixedBySpace = function (s,dig){
  if(s===undefined||s===null){
    return ' - ';
  }else if(_.isArray(s)){
    var r = _.clone(s);
    for(var i=0;i<r.length;i++){
      r[i] = fixedBySpace(r[i],dig);
    }
    return s;
  }else{
    dig = dig|5;
    var str = ''+s;
    while(str.length<dig){
      str = str+' ';
    }
    return str;
  }
}

exports.dateToString = function (d){
  return d.getFullYear()+'-'+fixedInt((d.getMonth()+1),2)+'-'+fixedInt(d.getDate(),2);
}

exports.numberToString = function (num){
  if(num===undefined||num===null||isNaN(num)){
    return '  -  ';
  }
  if(num<1&&num>0.001){
    return fixedNumber(Math.round(num*10000)/100,5)+'%';
  }else if(num==1||num<0.001){
    return '  '+String(num)+'  ';
  }
  return String(num);
}
