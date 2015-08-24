var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MatchSchema = new Schema({
  //是否为简单场次（简单场次多为早期赛事，可能会缺少部分赔率数据、红黄牌数据，仅用作胜负关系参考）
  simple: { type: Boolean, default: false },
  //赛事
  game: {
    name: { type: String, index: true },
    gid: { type: Number, index: true }
  },
  //比赛所在日期（注：是国内竞彩的对应日期）
  date: {type: String, index: true },
  //开赛时间
  time: {type: Date, index: true },
  //当日代号
  shortcut: { type: String },
  //唯一编号
  mid: { type: Number, index: true, unique: true },
  //信息ID
  iid: { type: Number },
  //是否已结束
  done: { type: Boolean, default: false, index: true },

  //是否为中立场
  neutral: { type: Boolean, default: false },
  //主队
  home: {
    //全称
    fullname: { type: String },
    //缩写
    name: { type: String, index: true },
    //队伍ID
    tid: { type: Number, index: true }
  },
  //客队
  away: {
    fullname: { type: String },
    name: { type: String, index: true },
    tid: { type: Number, index: true }
  },
  //国内竞彩
  jingcai:{
    //胜平负
    spf: {
      //是否开售单关
      //single: { type: Boolean, default: false },
      //成交量：[主胜，平局，客胜]
      trade:[ Number ],
      //赔率：[主胜，平局，客胜]，变赔时间
      sp:[{ data:[ Number ], time: Date }]
    },
    //让球胜平负
    rqspf: {
      //让球数
      rq: Number,
      //是否开售单关
      //single: { type: Boolean, default: false },
      //成交量：[主胜，平局，客胜]
      trade:[ Number ],
      //赔率：[主胜，平局，客胜]，变赔时间
      sp:[{ data:[ Number ], time: Date }]
    }
  },
  //必发盈亏
  bwin: [ Number ],
  
  //各家赔率
  odds:{
    europe:{
      average:{
        first:[ Number ],
        now:[ Number ]
      },
      bet365:{
        first:[ Number ],
        now:[ Number ]
      },
      macau:{
        first:[ Number ],
        now:[ Number ]
      },
      william:{
        first:[ Number ],
        now:[ Number ]
      }
    },
    asia:{
      bet365:{
        first:[ Number ],
        now:[ Number ]
      },
      macau:{ 
        first:[ Number ],
        now:[ Number ]
      }
    }
  },
  //赛果
  score:{
    full:{
      home: { type: Number },
      away: { type: Number }
    },
    half:{
      home: { type: Number },
      away: { type: Number }
    }
  },
  //红黄牌
  card:{
    yellow:{
      home: { type: Number },
      away: { type: Number }
    },
    red:{
      home: { type: Number },
      away: { type: Number }
    }
  }
});

//虚拟属性
['spf','rqspf'].forEach(function (jcType){
  //初赔和终赔
  MatchSchema.virtual('jingcai.'+jcType+'.first').get(function(){
    if(this.jingcai[jcType].sp&&this.jingcai[jcType].sp[0]){
      return this.jingcai[jcType].sp[0].data;
    }
    return undefined;
  });
  MatchSchema.virtual('jingcai.'+jcType+'.now').get(function(){
    if(this.jingcai[jcType].sp&&this.jingcai[jcType].sp[0]){
      return this.jingcai[jcType].sp[this.jingcai[jcType].sp.length-1].data;
    }
    return undefined;
  });
  //成交比例
  MatchSchema.virtual('jingcai.'+jcType+'.ratio').get(function(){
    if(this.jingcai[jcType].trade&&this.jingcai[jcType].trade[0]){
      var trade = this.jingcai[jcType].trade;
      var total = Math.floor(trade[0]+trade[1]+trade[2]);
      return [trade[0]/total,trade[1]/total,trade[2]/total];
    }
    return undefined;
  });
  //根据比分计算赛果
  MatchSchema.virtual('jingcai.'+jcType+'.results').get(function(){
    if(this.score.full.home){
      var o = { home:this.score.full.home, away:this.score.full.away };
      if(jcType === "rqspf"){
        o.home += this.jingcai.rqspf.rq;
      }
      if(o.home > o.away){
        return [1,0,0];
      }else if(o.home === o.away){
        return [0,1,0];
      }
      return [0,0,1];
    }
    return undefined;
  });
  MatchSchema.virtual('jingcai.'+jcType+'.result').get(function(){
    if(this.score.full.home){
      var o = { home:this.score.full.home, away:this.score.full.away };
      if(jcType === "rqspf"){
        o.home += this.jingcai.rqspf.rq;
      }
      if(o.home > o.away){
        return 3;
      }else if(o.home === o.away){
        return 1;
      }
      return 0;
    }
    return undefined;
  });
});

//是否为主队
MatchSchema.methods.homeOrAway = function (team,reverse){
  if(this.home.tid===team.tid||this.home.name===team.name){
    return(reverse?'away':'home');
  }else if(this.away.tid===team.tid||this.away.name===team.name){
    return(reverse?'home':'away');
  }
  return 'not';
}

//是否赢球
MatchSchema.methods.isWin = function (team){
  if(this.home.tid===team.tid||this.home.name===team.name){
    return this.result();
  }else if(this.away.tid===team.tid||this.away.name===team.name){
    var dict = [3,1,0,0];
    return dict[this.result()];
  }
  return -1;
}

//赔付率
MatchSchema.statics.claimRatio = function (o){
  return o[0]*o[1]*o[2]/(o[0]*o[1]+o[1]*o[2]+o[0]*o[2]);
}
//根据期望算概率
MatchSchema.statics.probability = function (o){
  var hd = o[0]*o[1];
  var da = o[1]*o[2];
  var ha = o[0]*o[2];
  var t = hd+da+ha;
  return [da/t, ha/t, hd/t];
}

//查找
MatchSchema.statics.getMatchById = function (mid, callback){
  this.findOne({mid: mid}, callback);
}

MatchSchema.statics.getMatchesByDate = function (date, callback){
  this.find({'date': date}).sort({time:1}).exec(callback);
}

MatchSchema.statics.getMatchesByTeam = function (team, query, limit, callback){
  var q;
  if(query.home){
    q = {'home.tid':team.tid, done:true};
  }else if(query.away){
    q = {'away.tid':team.tid, done:true};
  }else{
    q = {$or:[{'home.tid':team.tid},{'away.tid':team.tid}],done:true};
  }
  if(query.game){
    q['game.gid'] = game.gid;
  }
  this.find(q).lt('time',time).limit(limit).sort({time:-1}).exec(callback);
}

MatchSchema.statics.getMatchesByGame = function (game, limit, callback){
  this.find({'game.name': game}).limit(limit).sort({time:-1}).exec(callback);
}

MatchSchema.statics.getDoneMatchesByGame = function (game, skip, limit, callback){
  this.find({'game.name': game, done:true}).skip(skip).limit(limit).sort({time:-1}).exec(callback);
}

MatchSchema.statics.getDoneMatches = function (skip, limit, callback){
  this.find({done:true}).skip(skip).limit(limit).sort({time:-1}).exec(callback);
}

MatchSchema.statics.getMatches = function (skip, limit, callback){
  this.find({}).skip(skip).limit(limit).sort({time:-1}).exec(callback);
}

MatchSchema.statics.getMatchesByQuery = function (query, limit, sort, callback){
  this.find(query).limit(limit).sort(sort).exec(callback);
}
//清空
MatchSchema.statics.removeAll = function (callback){
  this.remove({}, callback);
}

MatchSchema.statics.removeByDate = function (date,callback){
  this.remove({date:date}, callback);
}

mongoose.model('Match', MatchSchema);

module.exports = mongoose.model('Match');
