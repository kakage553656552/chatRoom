# 单设备登录功能

## 功能概述

为了提高账户安全性，系统现在实现了单设备登录限制。这意味着：

- 每个用户账户在同一时间只能在一个设备上保持登录状态
- 当用户在新设备上登录时，之前设备上的登录会话将被自动终止
- 被强制登出的设备会收到通知并自动跳转到登录页面

## 实现原理

### 后端实现

1. **Token管理**
   - 在用户登录时，系统会先撤销该用户的所有现有token
   - 然后生成新的token并保存到数据库
   - 这确保了用户在任何时候只有一个有效的token

2. **Socket连接管理**
   - 服务器维护一个用户Socket映射表 (`userSocketMap`)
   - 当认证用户连接时，检查是否已有其他Socket连接
   - 如果发现重复连接，会强制断开旧连接

3. **强制登出机制**
   - 当检测到重复登录时，向旧设备发送 `force_logout` 事件
   - 旧设备收到事件后会自动执行登出操作

### 前端实现

1. **强制登出监听**
   - 前端监听 `force_logout` Socket事件
   - 收到事件时显示提示信息并执行登出操作

2. **自动重连处理**
   - 当连接断开时，系统会清理相关状态
   - 用户需要重新登录才能继续使用

## 代码修改

### 服务器端 (server.js)

```javascript
// 添加用户Socket映射
const userSocketMap = new Map(); // userId -> socketId

// 修改登录API
app.post('/api/login', async (req, res) => {
  // ... 验证用户 ...
  
  // 撤销所有现有token（实现单设备登录）
  await revokeAllUserTokens(user.id);
  
  // 生成新token
  const tokenData = await generateAndSaveToken(/* ... */);
  
  // ... 返回响应 ...
});

// 修改Socket连接处理
io.on('connection', (socket) => {
  if (socket.isAuthenticated && socket.user) {
    const userId = socket.user.id.toString();
    const existingSocketId = userSocketMap.get(userId);
    
    // 强制断开旧连接
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.emit('force_logout', { 
          message: '您的账户在其他设备上登录，当前连接将被断开' 
        });
        existingSocket.disconnect(true);
      }
    }
    
    // 更新映射
    userSocketMap.set(userId, socket.id);
  }
});
```

### 前端 (ChatRoom.vue)

```javascript
// 添加强制登出事件监听
this.socket.on('force_logout', (data) => {
  alert(data.message || '您的账户在其他设备上登录，当前连接将被断开');
  this.handleForceLogout();
});

// 处理强制登出
handleForceLogout() {
  this.logoutAccount();
}
```

## 测试

运行测试文件来验证功能：

```bash
node test-single-device-login.js
```

测试将验证：
1. 设备A登录成功
2. 设备B登录时撤销设备A的token
3. 设备A的token失效
4. 设备B的token仍然有效
5. 用户只有一个活跃token

## 用户体验

### 正常登录流程
1. 用户在设备A上登录 ✅
2. 用户正常使用聊天功能 ✅

### 多设备登录场景
1. 用户在设备A上已登录 ✅
2. 用户在设备B上登录 ✅
3. 设备A收到强制登出通知 📱
4. 设备A自动跳转到登录页面 🔄
5. 设备B正常使用 ✅

### 安全优势
- 防止账户被盗用后的多设备同时使用
- 确保用户能够控制自己的登录状态
- 提供明确的登录状态反馈

## 注意事项

1. **网络断开重连**
   - 如果是网络问题导致的断开重连，不会触发强制登出
   - 只有在新设备登录时才会强制断开旧设备

2. **浏览器刷新**
   - 浏览器刷新会重新建立Socket连接
   - 由于使用相同的token，不会被视为新设备登录

3. **Token过期**
   - Token过期和强制登出是两个不同的机制
   - Token过期时用户需要重新登录
   - 强制登出是由于其他设备登录导致的

## 配置选项

目前单设备登录是强制启用的，如果需要允许多设备登录，可以：

1. 在登录API中注释掉 `revokeAllUserTokens` 调用
2. 在Socket连接处理中注释掉强制断开逻辑

但出于安全考虑，建议保持单设备登录限制。 