var _ = require('lodash');

//赔付率
exports.claimRatio = function (o){
  return o[0]*o[1]*o[2]/(o[0]*o[1]+o[1]*o[2]+o[0]*o[2]);
}
//根据期望算概率
exports.probability = function (o){
  var hd = o[0]*o[1];
  var da = o[1]*o[2];
  var ha = o[0]*o[2];
  var t = hd+da+ha;
  return [da/t, ha/t, hd/t];
}