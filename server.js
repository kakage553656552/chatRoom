const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
app.use(cors());
app.use(express.json());

// 创建服务器
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 设置数据库
const adapter = new FileSync('db.json');
const db = low(adapter);

// 初始化数据库结构
db.defaults({ messages: [], users: [], accounts: [] }).write();

// API路由
app.get('/api/messages', (req, res) => {
  // 获取最近的五条消息
  const limit = req.query.limit ? parseInt(req.query.limit) : 5;
  const messages = db.get('messages')
    .orderBy(['timestamp'], ['desc'])
    .take(limit)
    .value()
    .reverse(); // 反转以保持时间正序
  
  res.json(messages);
});

// 获取在线用户列表API
app.get('/api/users', (req, res) => {
  const users = db.get('users').value();
  res.json(users);
});

// 用户注册API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  // 检查用户名是否已存在
  const existingUser = db.get('accounts').find({ username }).value();
  if (existingUser) {
    return res.status(400).json({ success: false, message: '用户名已存在' });
  }
  
  // 创建新用户账号
  const newUser = {
    id: Date.now().toString(),
    username,
    password, // 实际应用中应该对密码进行加密
    createdAt: new Date()
  };
  
  // 保存到数据库
  db.get('accounts').push(newUser).write();
  
  // 返回成功消息（不返回密码）
  const userWithoutPassword = { ...newUser };
  delete userWithoutPassword.password;
  res.status(201).json({
    success: true,
    message: '注册成功',
    user: userWithoutPassword
  });
});

// 用户登录API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // 查找用户
  const user = db.get('accounts').find({ username }).value();
  
  // 验证用户和密码
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
  
  // 登录成功（不返回密码）
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password;
  res.json({
    success: true,
    message: '登录成功',
    user: userWithoutPassword
  });
});

// Socket.io连接处理
io.on('connection', (socket) => {
  console.log('用户已连接:', socket.id);
  
  // 用户请求在线用户列表
  socket.on('get_users', () => {
    const users = db.get('users').value();
    socket.emit('users_list', users);
  });
  
  // 用户加入聊天
  socket.on('user_join', (userData) => {
    const username = typeof userData === 'string' ? userData : userData.username;
    const userId = typeof userData === 'string' ? socket.id : userData.userId;
    
    // 检查用户是否已经在聊天室中
    const existingUser = db.get('users').find({ userId: userId }).value();
    
    // 如果用户已经存在，但socket ID改变了（例如重新连接）
    if (existingUser) {
      console.log(`用户 ${username} (${userId}) 已经在聊天室中，更新socket ID`);
      
      // 仅更新socket ID，不发送新的加入消息
      db.get('users')
        .find({ userId: userId })
        .assign({ id: socket.id })
        .write();
      
      // 广播最新的用户列表给所有客户端
      const users = db.get('users').value();
      io.emit('users_list', users);
      
      return;
    }
    
    // 添加新用户
    const user = {
      id: socket.id,
      username,
      userId: userId,
      joinedAt: new Date()
    };
    
    db.get('users').push(user).write();
    
    // 广播用户加入消息
    const joinMessage = {
      id: Date.now(),
      type: 'system',
      content: `${username} 加入了聊天室`,
      timestamp: new Date()
    };
    
    db.get('messages').push(joinMessage).write();
    io.emit('message', joinMessage);
    
    // 广播最新的用户列表给所有客户端
    const users = db.get('users').value();
    io.emit('users_list', users);
  });
  
  // 接收消息
  socket.on('send_message', (messageData) => {
    const message = {
      id: Date.now(),
      userId: socket.id,
      username: messageData.username,
      content: messageData.content,
      timestamp: new Date(),
      type: 'user'
    };
    
    // 保存消息到数据库
    db.get('messages').push(message).write();
    
    // 广播消息给所有客户端
    io.emit('message', message);
  });
  
  // 用户断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
    
    // 获取断开连接的用户
    const user = db.get('users').find({ id: socket.id }).value();
    
    if (user) {
      // 从用户列表中移除
      db.get('users').remove({ id: socket.id }).write();
      
      // 广播用户离开消息
      const leaveMessage = {
        id: Date.now(),
        type: 'system',
        content: `${user.username} 离开了聊天室`,
        timestamp: new Date()
      };
      
      db.get('messages').push(leaveMessage).write();
      io.emit('message', leaveMessage);
      
      // 广播更新后的用户列表
      const updatedUsers = db.get('users').value();
      io.emit('users_list', updatedUsers);
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 