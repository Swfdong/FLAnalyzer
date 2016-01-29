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
  .version('0.3.0')
  .option('-d, --date [value]', '按日期[value]浏览竞彩赛事')
  .parse(process.argv);

mongoose.connect(dbconfig.url);
mongoose.connection.on('error', function (err) {
  printer.error('mongo_conn',err);
});

var queryCallback = function (e,ms){
  if(!e){
    ms.forEach(function (m){ 
      printer.match(m);
    });
  }
};

if(program.date){
  Match.getJingcaiByDate(program.date,queryCallback);
}