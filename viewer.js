var mongoose    = require('mongoose');

var converter   = require('./app/utils/converter'),
    normalizer  = require('./app/utils/normalizer'),
    time        = require('./app/utils/time'),
    printer     = require('./app/printer').viewer;

var dbconfig    = require('./app/configs/database'),
    Match       = require('./app/models/match'),
    Game        = require('./app/models/game'),
    Team        = require('./app/models/team');

var program     = require('commander');

program
  .version('0.4.0')
  .option('-d, --date [value]', '按日期[value]筛选')
  .option('-g, --game [value]', '按联赛[value]筛选')
  .option('-t, --team [value]', '按球队[value]筛选')
  .option('-h, --home [value]', '按主场球队[value]筛选')
  .option('-a, --away [value]', '按客场球队[value]筛选')
  .parse(process.argv);

mongoose.connect(dbconfig.url);
mongoose.connection.on('error', function (err) {
  printer.error('mongo_conn',err);
});

var queryCallback = function (e,ms){
  if(!e){
    if(ms.length>0){
      ms.forEach(function (m){ 
        printer.match(m);
      });
    }else{
      console.log('未找到赛事数据。');
    } 
  }
};

var sort  = {time:-1},
    limit = 100,
    query = {'simple': false};

['date','game','home','away'].forEach(function(type){
  if(program[type]){
    if(type=='home'||type=='away'){
      query[type+'.name'] = program[type];
    }else{
      query[type] = program[type];
    }
  }
});
if(program.team){
  query['$or'] = [
  {'home.name':program.team},
  {'away.name':program.team}];
}
Match.getByQuery(query,limit,sort,queryCallback);
