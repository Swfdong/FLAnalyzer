var spider    = require('./app/spider');

spider();

//强制更新并跳过耗时的竞彩和必发部分
// spider(true,[
//   'jcOdds',
//   'jcTrade',
//   'bwin'
// ]);