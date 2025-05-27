# Token 校验功能说明

## 概述

本聊天室应用已经集成了完整的JWT（JSON Web Token）校验功能，确保只有经过认证的用户才能访问受保护的API和Socket.io连接。

## 功能特性

### 1. JWT Token 生成和验证
- 使用 `jsonwebtoken` 库生成和验证JWT token
- Token包含用户ID和用户名信息
- 默认过期时间为24小时（可通过环境变量配置）

### 2. API 保护
以下API端点需要有效的JWT token：
- `GET /api/messages` - 获取历史消息
- `GET /api/users` - 获取在线用户列表

### 3. Socket.io 连接保护
- Socket.io连接需要在握手时提供有效的JWT token
- 无效token将导致连接被拒绝

### 4. 前端Token管理
- 登录成功后自动保存token到本地存储
- 所有API请求自动携带Authorization头部
- Token过期时自动清除用户状态并要求重新登录

## 配置说明

### 环境变量
在 `.env` 文件中配置以下变量：

```env
# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
JWT_EXPIRES_IN=24h
```

**重要提示：** 在生产环境中，请务必更改 `JWT_SECRET` 为一个强密码！

## 使用流程

### 1. 用户登录
```javascript
// 前端发送登录请求
fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    // 保存token和用户信息
    localStorage.setItem('chatToken', data.token);
    localStorage.setItem('chatUserData', JSON.stringify(data.user));
  }
});
```

### 2. API请求
```javascript
// 自动添加Authorization头部
const headers = {};
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}

fetch('/api/messages', { headers })
  .then(response => {
    if (response.status === 401 || response.status === 403) {
      // Token无效，清除登录状态
      handleTokenExpired();
    }
    return response.json();
  });
```

### 3. Socket.io连接
```javascript
// 在连接时提供token
const socketOptions = {
  auth: {
    token: this.token
  }
};
const socket = io(serverUrl, socketOptions);
```

## 安全特性

### 1. Token过期处理
- Token过期时，API返回401/403状态码
- 前端自动检测并清除过期的认证状态
- 用户需要重新登录获取新token

### 2. 自动登出
- Token无效时自动清除本地存储
- 断开Socket.io连接
- 重定向到登录界面

### 3. 错误处理
- Socket.io认证失败时显示相应错误信息
- API请求失败时提供用户友好的错误提示

## 测试

运行以下命令测试JWT功能：

```bash
node test-token.js
```

## 文件结构

```
├── auth.js                 # JWT工具模块
├── server.js              # 服务器主文件（包含token验证中间件）
├── src/components/ChatRoom.vue  # 前端组件（包含token处理逻辑）
├── .env                   # 环境变量配置
└── test-token.js          # JWT功能测试文件
```

## 注意事项

1. **生产环境安全**：
   - 必须更改默认的JWT_SECRET
   - 考虑使用HTTPS协议
   - 定期更新token过期时间

2. **Token存储**：
   - 当前使用localStorage存储token
   - 考虑使用httpOnly cookies提高安全性

3. **错误处理**：
   - 网络错误和认证错误需要区别处理
   - 提供用户友好的错误信息

## 扩展功能

可以考虑添加以下功能：
- Token刷新机制
- 多设备登录管理
- 用户权限分级
- 登录日志记录 