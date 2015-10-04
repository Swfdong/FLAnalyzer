var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var TeamSchema = new Schema({
  //唯一编号
  tid: { type: Number, index: true, unique: true },
  //队名
  name: { type: String, index: true },
  fullname: { type: String },
  updated: {type: Boolean, default: false, index: true }
});

//查找

TeamSchema.statics.getAllTeams = function (callback){
  this.find({}).exec(callback);
}

TeamSchema.statics.getTeamsNeedUpdate = function (callback){
  this.find({updated:false}).exec(callback);
}

TeamSchema.statics.getTeamById = function (tid, callback){
  this.findOne({tid: tid}, callback);
}

TeamSchema.statics.getTeamByName = function (name, callback){
  this.findOne({name:name}, callback);
}


TeamSchema.statics.removeAll = function (callback){
  this.remove({}, callback);
}

mongoose.model('Team', TeamSchema);

module.exports = mongoose.model('Team');