var converter   = require('./converter');
var colors      = require('colors');
var Match       = require('../models/match');




var header = exports.header = function (msg){
  console.log('——————————————————————————————————————————————');
  console.log(msg);
  console.log('——————————————————————————————————————————————');
}

exports.match = function (match){
  header(('\t['+match.game.name+'] ').red+match.home.name+' VS '.grey+match.away.name,
          '\n\t 比赛时间：'+converter.dateToString(match.time));
  europeOdds(match);
}

var line = exports.line = function (){
  console.log('——————————————————————————————————————————————'.dim.grey);
}

var europeOdds = exports.europeOdds = function (match){
  var updown = function (odds){
    var result = [odds.now[0],odds.now[1],odds.now[2]];
    for(var i=0;i<3;i++){
      if(result[i]<odds.first[i]){
        result[i] = converter.fixedBySpace(result[i]).green;
      }else if(result[i]>odds.first[i]){
        result[i] = converter.fixedBySpace(result[i]).red;
      }else{
        result[i] = converter.fixedBySpace(result[i]);
      }
    }
    return result;
  }
  var ud = updown(match.odds.europe.average);
  console.log('欧赔\t 赔率 \t  欧赔  \t 概率'.grey,
            '\n主胜：\t'.grey, converter.numberToString(match.jingcai.sp[0]), '\t ', ud[0], '\t', converter.numberToString(Match.probability(match.odds.europe.average.now)[0]),
            '\n平局：\t'.grey, converter.numberToString(match.jingcai.sp[1]), '\t ', ud[1], '\t', converter.numberToString(Match.probability(match.odds.europe.average.now)[1]),
            '\n主负：\t'.grey, converter.numberToString(match.jingcai.sp[2]), '\t ', ud[2], '\t', converter.numberToString(Match.probability(match.odds.europe.average.now)[2]));
  if(match.jingcai.sp[0]!==undefined){
    console.log('赔付率：'.grey, converter.numberToString(Match.claimRatio(match.jingcai.sp)));
  }
}

// exports.predict = function (match, result, handicap, score){
//   console.log('\n权重\t胜平负\t 让球('+converter.signedNumber(match.handicap.num)+')\t  比分',
//             '\n主胜：\t', converter.fixedNumber(converter.fixFloat(result[0]),4),'\t ',converter.fixedNumber(converter.fixFloat(handicap[0]),4),' \t ', converter.fixedNumber(converter.fixFloat(score[0])),
//             '\n平局：\t', converter.fixedNumber(converter.fixFloat(result[1]),4),'\t ',converter.fixedNumber(converter.fixFloat(handicap[1]),4),
//             '\n主负：\t', converter.fixedNumber(converter.fixFloat(result[2]),4),'\t ',converter.fixedNumber(converter.fixFloat(handicap[2]),4),' \t ', converter.fixedNumber(converter.fixFloat(score[1])));
// }
exports.asiaOdds = function (match){
  var updown = function (odds){
    var result = [odds.now[0],odds.now[1],odds.now[2]];
    for(var i=0;i<3;i++){
      if(result[i]<odds.first[i]){
        result[i] = converter.fixedBySpace(result[i]).green;
      }else if(result[i]>odds.first[i]){
        result[i] = converter.fixedBySpace(result[i]).red;
      }else{
        result[i] = converter.fixedBySpace(result[i]);
      }
    }
    return result;
  }
  var dict = {
    '-0.25':  '平手/半球',
    '-0.5':   '半球',
    '-0.75':  '半球/一球',
    '-1':     '一球',
    '-1.25':  '一球/球半',
    '-1.5':   '球半',
    '-1.75':  '球半/两球',
    '-2':     '两球',
    '-2.25':  '两球/两球半',
    '-2.5':   '两球半',
    '-2.75':  '两球半/三球',
    '-3':     '三球',
    '-3.25':  '三球/三球半',
    '-3.5':   '三球半',
    '-3.75':  '三球半/四球',
    '-4':     '四球',
    '-4.25':  '四球/四球半',
    '-4.5':   '四球半',
    '-4.75':  '四球半/五球',
    '-5':     '五球',
    '0':      '平手',
    '0.25':   '受平手/半球',
    '0.5':    '受半球',
    '0.75':   '受半球/一球',
    '1':      '受一球',
    '1.25':   '受一球/球半',
    '1.5':    '受球半',
    '1.75':   '受球半/两球',
    '2':      '受两球',
    '2.25':   '受两球/两球半',
    '2.5':    '受两球半',
    '2.75':   '受两球半/三球',
    '3':      '受三球',
    '3.25':   '受三球/三球半',
    '3.5':    '受三球半',
    '3.75':   '受三球半/四球',
    '4':      '受四球',
    '4.25':   '受四球/四球半',
    '4.5':    '受四球半',
    '4.75':   '受四球半/五球',
    '5':      '受五球   '
  }
  console.log('\n亚盘\t 主水 \t  盘口   \t 客水'.grey);
  if(match.odds.asia.bet365.now){
    console.log('B365：\t'.grey,converter.fixFloat(match.odds.asia.bet365.now[0]),'\t ',converter.fixedBySpace(dict[String(match.odds.asia.bet365.now[1])],7),'\t',converter.fixFloat(match.odds.asia.bet365.now[2]),
                '\n初盘：\t'.grey,converter.fixFloat(match.odds.asia.bet365.first[0]),'\t ',converter.fixedBySpace(dict[String(match.odds.asia.bet365.first[1])],7),'\t',converter.fixFloat(match.odds.asia.bet365.first[2]));
  }
  if(match.odds.asia.macau.now){
    console.log('澳门：\t'.grey,converter.fixFloat(match.odds.asia.macau.now[0]),'\t ',converter.fixedBySpace(dict[String(match.odds.asia.macau.now[1])],7),'\t',converter.fixFloat(match.odds.asia.macau.now[2]),
                '\n初盘：\t'.grey,converter.fixFloat(match.odds.asia.macau.first[0]),'\t ',converter.fixedBySpace(dict[String(match.odds.asia.macau.first[1])],7),'\t',converter.fixFloat(match.odds.asia.macau.first[2]));
  }
}

exports.predict = function (match, result, score){
  var map = [2,1,null,0];
  weights = [converter.fixedNumber(converter.fixFloat(result[0]),4),converter.fixedNumber(converter.fixFloat(result[1]),4),converter.fixedNumber(converter.fixFloat(result[2]),4)];
  if(match.done){
    var flag = [0,0];
    //找到概率最高的比赛结果
    for(var i = 0;i<3;i++){
      if(result[i]>flag[0]){
        flag[0] = result[i];
        flag[1] = i;
      }
    }
    if(flag[1]!=map[match.result()]){
      weights[flag[1]] = weights[flag[1]].underline;
    }
    weights[map[match.result()]] = weights[map[match.result()]].bgRed;
  }
  
  console.log('\n预测 \t 权重 \t  投注比\t 比分'.grey,
            '\n主胜：\t'.grey, weights[0],'\t ', converter.numberToString(match.ratio()[0]), '\t', converter.fixedNumber(converter.fixFloat(score[0])),
            '\n平局：\t'.grey, weights[1],'\t ', converter.numberToString(match.ratio()[1]),
            '\n主负：\t'.grey, weights[2],'\t ', converter.numberToString(match.ratio()[2]), '\t', converter.fixedNumber(converter.fixFloat(score[1])));
}

exports.guess = function (scores){
  console.log('\n猜分：\t',scores.join('、 '));
}

exports.score = function (match){
  //如果已有赛果
  if(match.score.full.home!==undefined){
    console.log('赛果：\t',match.score.full.home+':'+match.score.full.away);
  }
}