var _           = require('lodash'),
    validator   = require('validator');

var fixFloat = function (number){
  return Math.round(number*10000)/10000;
}

var fixedNumber = function (num,dig){
  dig = dig===undefined?5:dig;
  var str = ''+num;
  if(str.length < dig){
    if(str.indexOf('.') === -1){
      str+='.0';
    }
    while(str.length<dig){
      str = str+'0';
    }
  }else if(str.length > dig){
    str = str.substr(0,dig);
  }
  return str;
}

var numberToString = function (num){
  if(!isFinite(num)){
    return '-';
  }
  if(num<1&&num>0.001){
    return fixedNumber(Math.round(num*10000)/100)+'%';
  }else if(_.isInteger(num)){
    return String(num);
  }
  return String(fixedNumber(num,4));
}

var ansiTrim = function (str){
  var r = new RegExp('\x1b(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|' +
  '\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)', 'g');
  return str.replace(r, '');
};

var ansiLength = function (str){  
  var len = 0;
  str = ansiTrim(str);
  for (var i=0; i<str.length; i++) {
    var c = str.charCodeAt(i);
    if((c >= 0x0001 && c <= 0x007e) || (0xff60<=c && c<=0xff9f)) {   
      len ++;
    }else{
      len += 2;
    }
  }
  return len;
};

var column = function (str,len,align){
  len = len===undefined?10:len;
  align = align===undefined?'left':align;
  if(str === undefined || str === null){
    str = '-';
  }else if(_.isNumber(str)){
    str = numberToString(str);
  }
  var strLen = ansiLength(str);
  if(strLen>len){
    while(ansiLength(str)>len){
      str = str.slice(0,str.length-1);
    }
  }else if(strLen<len){
    if(align==='center'){
      var halfLen = (len-strLen)/2+1;
      str = Array(Math.floor(halfLen)).join(' ')
            + str
            + Array(Math.ceil(halfLen)).join(' ');
    }else if(align==='right'){
      str = Array(len-strLen+1).join(' ')+str;
    }else{
      str += Array(len-strLen+1).join(' ');
    }
  }
  return str;
}

var addMethod = function (method, func) {
  Number.prototype[method] = function(arg1,arg2){
    return func(Number(this),arg1,arg2);
  };
  String.prototype[method] = function(arg1,arg2){
    return func(this,arg1,arg2);
  };
  Array.prototype[method] = function(arg1,arg2){
    var mapper = function(a){
      return func(a,arg1,arg2);
    };
    return this.map(mapper);
  };
};

addMethod('column',column);

Number.prototype.signed = function (){
  var str = ''+this;
  if(this > 0){
    str = '+'+str;
  }
  return str;
}

exports.score = function (str){
  return {
    '0':[ '  █████  ',
          '  █   █  ',
          '  █   █  ',
          '  █   █  ',
          '  █████  '],
    '1':[ '   ██    ',
          '  █ █    ',
          '    █    ',
          '    █    ',
          '  █████  '],
    '2':[ '   ███   ',
          '  █   █  ',
          '     █   ',
          '    █    ',
          '  █████  '],
    '3':[ '  █████  ',
          '      █  ',
          '  ████   ',
          '      █  ',
          '  ████   '],
    '4':[ '  █  █   ',
          '  █  █   ',
          '  █  █   ',
          '  █████  ',
          '     █   '],
    '5':[ '  █████  ',
          '  █      ',
          '  ████   ',
          '      █  ',
          '  ████   '],
    '6':[ '   ████  ',
          '  █      ',
          '  █████  ',
          '  █   █  ',
          '  █████  '],
    '7':[ '  █████  ',
          '      █  ',
          '     █   ',
          '    █    ',
          '   █     '],
    '8':[ '  █████  ',
          '  █   █  ',
          '   ███   ',
          '  █   █  ',
          '  █████  '],
    '9':[ '  █████  ',
          '  █   █  ',
          '  █████  ',
          '      █  ',
          '  █████  '],
    ':':[ '         ',
          '    █    ',
          '         ',
          '    █    ',
          '         ']
  }[str];
}
