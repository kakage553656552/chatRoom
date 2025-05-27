# Token管理系统文档

## 概述

本项目实现了一个完整的JWT token管理系统，包括token的生成、存储、验证、撤销和清理功能。该系统提供了更高的安全性，支持多设备登录管理和token生命周期管理。

## 功能特性

### 1. 安全的Token存储
- Token哈希值存储在数据库中，而非明文
- 支持设备信息和IP地址记录
- 自动过期时间管理

### 2. 多设备支持
- 用户可以在多个设备上同时登录
- 每个设备的token独立管理
- 支持查看所有活跃的登录设备

### 3. Token生命周期管理
- 自动清理过期token
- 支持单个token撤销
- 支持撤销用户所有token

## 数据库结构

### user_tokens表
```sql
CREATE TABLE user_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    device_info TEXT,
    ip_address TEXT,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES accounts(id)
);
```

## API接口

### 1. 登录接口
**POST** `/api/login`

**请求体:**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

**响应:**
```json
{
  "success": true,
  "message": "登录成功",
  "token": "JWT_TOKEN",
  "user": {
    "id": 1,
    "username": "用户名"
  },
  "tokenInfo": {
    "id": 1,
    "device_info": "浏览器信息",
    "ip_address": "IP地址",
    "expires_at": "过期时间"
  }
}
```

### 2. 登出接口
**POST** `/api/logout`

**请求头:**
```
Authorization: Bearer JWT_TOKEN
```

**响应:**
```json
{
  "success": true,
  "message": "登出成功"
}
```

### 3. 全部登出接口
**POST** `/api/logout-all`

**请求头:**
```
Authorization: Bearer JWT_TOKEN
```

**响应:**
```json
{
  "success": true,
  "message": "已撤销所有设备的登录",
  "revokedCount": 3
}
```

## 核心功能模块

### 1. Token生成和保存
```javascript
const { generateAndSaveToken } = require('./auth');

// 生成并保存token
const tokenData = await generateAndSaveToken(
  { id: userId, username: username },
  deviceInfo,
  ipAddress
);
```

### 2. Token验证
```javascript
const { verifyTokenWithDB } = require('./auth');

// 验证token（包含数据库验证）
const userData = await verifyTokenWithDB(token);
```

### 3. Token撤销
```javascript
const { revokeToken, revokeAllUserTokens } = require('./auth');

// 撤销单个token
await revokeToken(token);

// 撤销用户所有token
await revokeAllUserTokens(userId);
```

### 4. 数据库操作
```javascript
const { db } = require('./database');

// 获取用户活跃token
const activeTokens = await db.getUserActiveTokens(userId);

// 清理过期token
const cleanedCount = await db.cleanExpiredTokens();
```

## 安全特性

### 1. Token哈希存储
- 使用SHA256算法对token进行哈希
- 数据库中只存储哈希值，不存储原始token
- 即使数据库泄露，也无法直接获取有效token

### 2. 设备和IP跟踪
- 记录每个token的设备信息
- 记录登录IP地址
- 便于安全审计和异常检测

### 3. 自动清理机制
- 每小时自动清理过期和无效token
- 防止数据库中积累大量无用数据
- 提高查询性能

## 中间件认证

### 1. HTTP请求认证
```javascript
const { authenticateToken } = require('./auth');

// 在路由中使用
app.get('/api/protected', authenticateToken, (req, res) => {
  // req.user 包含用户信息
  res.json({ user: req.user });
});
```

### 2. Socket连接认证
```javascript
const { authenticateSocketToken } = require('./auth');

// 在Socket.IO中使用
io.use(authenticateSocketToken);
```

## 测试

### 运行token功能测试
```bash
node test-token-db.js
```

测试包括：
- Token生成和保存
- Token验证
- 查看活跃token
- Token撤销
- 过期token清理

## 配置

### JWT密钥配置
在 `auth.js` 中配置JWT密钥：
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
```

### Token过期时间
默认token有效期为24小时，可在 `generateAndSaveToken` 函数中修改：
```javascript
const expiresIn = '24h'; // 可修改为其他时间
```

## 部署注意事项

1. **环境变量**: 生产环境中务必设置 `JWT_SECRET` 环境变量
2. **数据库备份**: 定期备份 `user_tokens` 表数据
3. **监控**: 监控token清理任务的执行情况
4. **日志**: 记录重要的token操作日志

## 故障排除

### 常见问题

1. **Token验证失败**
   - 检查token是否过期
   - 检查数据库中token记录是否存在
   - 检查token是否被撤销

2. **数据库连接问题**
   - 确保数据库文件存在
   - 检查数据库权限
   - 运行 `node initDb.js` 初始化数据库

3. **清理任务不工作**
   - 检查服务器日志
   - 确认定时任务是否启动
   - 手动运行 `db.cleanExpiredTokens()` 测试

## 更新日志

### v1.0.0
- 实现基础token管理功能
- 添加数据库存储支持
- 实现多设备登录管理
- 添加自动清理机制
- 完善API接口和中间件 