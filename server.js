require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { initDatabase, db } = require('./database');

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

// 初始化数据库
initDatabase().catch(error => {
  console.error('数据库初始化失败:', error);
  process.exit(1);
});

// API路由
app.get('/api/messages', async (req, res) => {
  try {
    // 获取最近的五条消息
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const messages = await db.getRecentMessages(limit);
    
    // 格式化消息数据以匹配前端期望的格式
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      userId: msg.user_id,
      username: msg.username,
      content: msg.content,
      type: msg.message_type,
      timestamp: msg.created_time
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 获取在线用户列表API
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllOnlineUsers();
    
    // 格式化用户数据以匹配前端期望的格式
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      userId: user.user_id,
      joinedAt: user.created_time
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 用户注册API
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 检查用户名是否已存在
    const existingUser = await db.findAccountByUsername(username);
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }
    
    // 创建新用户账号
    const newUser = await db.createAccount(username, password);
    
    // 返回成功消息（不返回密码）
    res.status(201).json({
      success: true,
      message: '注册成功',
      user: {
        id: newUser.id.toString(),
        username: newUser.username,
        createdAt: newUser.created_time
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ success: false, message: '注册失败，请稍后再试' });
  }
});

// 用户登录API
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查找用户
    const user = await db.findAccountByUsername(username);
    
    // 验证用户和密码
    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 登录成功（不返回密码）
    res.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.id.toString(),
        username: user.username,
        createdAt: user.created_time
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, message: '登录失败，请稍后再试' });
  }
});

// Socket.io连接处理
io.on('connection', (socket) => {
  console.log('用户已连接:', socket.id);
  
  // 用户请求在线用户列表
  socket.on('get_users', async () => {
    try {
      const users = await db.getAllOnlineUsers();
      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        userId: user.user_id,
        joinedAt: user.created_time
      }));
      socket.emit('users_list', formattedUsers);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  });
  
  // 用户加入聊天
  socket.on('user_join', async (userData) => {
    try {
      const username = typeof userData === 'string' ? userData : userData.username;
      const userId = typeof userData === 'string' ? socket.id : userData.userId;
      
      // 检查用户是否已经在聊天室中
      const existingUser = await db.findOnlineUserByUserId(userId);
      
      // 如果用户已经存在，但socket ID改变了（例如重新连接）
      if (existingUser) {
        console.log(`用户 ${username} (${userId}) 已经在聊天室中，更新socket ID`);
        
        // 仅更新socket ID，不发送新的加入消息
        await db.updateOnlineUserSocketId(userId, socket.id);
        
        // 广播最新的用户列表给所有客户端
        const users = await db.getAllOnlineUsers();
        const formattedUsers = users.map(user => ({
          id: user.id,
          username: user.username,
          userId: user.user_id,
          joinedAt: user.created_time
        }));
        io.emit('users_list', formattedUsers);
        
        return;
      }
      
      // 添加新用户
      await db.addOnlineUser(socket.id, username, userId);
      
      // 广播用户加入消息
      const joinMessage = await db.addMessage(socket.id, username, `${username} 加入了聊天室`, 'system');
      
      // 格式化消息数据
      const formattedMessage = {
        id: joinMessage.id,
        userId: joinMessage.user_id,
        username: joinMessage.username,
        content: joinMessage.content,
        type: joinMessage.message_type,
        timestamp: joinMessage.created_time
      };
      
      io.emit('message', formattedMessage);
      
      // 广播最新的用户列表给所有客户端
      const users = await db.getAllOnlineUsers();
      const formattedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        userId: user.user_id,
        joinedAt: user.created_time
      }));
      io.emit('users_list', formattedUsers);
    } catch (error) {
      console.error('用户加入失败:', error);
    }
  });
  
  // 接收消息
  socket.on('send_message', async (messageData) => {
    try {
      const message = await db.addMessage(
        socket.id,
        messageData.username,
        messageData.content,
        'user'
      );
      
      // 格式化消息数据
      const formattedMessage = {
        id: message.id,
        userId: message.user_id,
        username: message.username,
        content: message.content,
        type: message.message_type,
        timestamp: message.created_time
      };
      
      // 广播消息给所有客户端
      io.emit('message', formattedMessage);
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  });
  
  // 用户断开连接
  socket.on('disconnect', async () => {
    try {
      console.log('用户断开连接:', socket.id);
      
      // 获取断开连接的用户
      const user = await db.removeOnlineUser(socket.id);
      
      if (user) {
        // 广播用户离开消息
        const leaveMessage = await db.addMessage(
          socket.id,
          user.username,
          `${user.username} 离开了聊天室`,
          'system'
        );
        
        // 格式化消息数据
        const formattedMessage = {
          id: leaveMessage.id,
          userId: leaveMessage.user_id,
          username: leaveMessage.username,
          content: leaveMessage.content,
          type: leaveMessage.message_type,
          timestamp: leaveMessage.created_time
        };
        
        io.emit('message', formattedMessage);
        
        // 广播更新后的用户列表
        const updatedUsers = await db.getAllOnlineUsers();
        const formattedUsers = updatedUsers.map(user => ({
          id: user.id,
          username: user.username,
          userId: user.user_id,
          joinedAt: user.created_time
        }));
        io.emit('users_list', formattedUsers);
      }
    } catch (error) {
      console.error('处理用户断开连接失败:', error);
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 