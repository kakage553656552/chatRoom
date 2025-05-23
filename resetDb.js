const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// 设置数据库
const adapter = new FileSync('db.json');
const db = low(adapter);

// 重置数据库到初始状态
db.setState({
  messages: [],
  users: [],
  accounts: []
}).write();

// 确保写入正确的初始结构
db.defaults({
  messages: [],
  users: [],
  accounts: []
}).write();

console.log('数据库已成功重置！'); 