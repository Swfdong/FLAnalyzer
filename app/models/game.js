var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var GameSchema = new Schema({
  //唯一编号
  gid: { type: Number, index: true, unique: true },
  //比赛名
  name: { type: String, index: true },
  //全名
  fullname: { type: String }
});

//查找
GameSchema.statics.getById = function (gid, callback){
  this.findOne({gid: gid}, callback);
}
GameSchema.statics.getByName = function (Name, callback){
  this.findOne({name: name}, callback);
}
GameSchema.statics.getAll = function (callback){
  this.find({}, callback);
}

GameSchema.statics.removeAll = function (callback){
  this.remove({}, callback);
}

mongoose.model('Game', GameSchema);

module.exports = mongoose.model('Game');