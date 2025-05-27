# 在线聊天室

一个使用Vue.js、Express、Socket.io和PostgreSQL构建的简单在线聊天应用。

## 功能特点

- 实时消息传递
- 用户在线状态显示
- 系统消息通知（用户加入/离开）
- 消息持久化存储（PostgreSQL）
- 用户注册和登录系统
- 简洁美观的UI界面

## 技术栈

- 前端：Vue.js 2.x
- 后端：Express.js
- 实时通信：Socket.io
- 数据库：PostgreSQL
- 数据库驱动：node-postgres (pg)

## 项目结构

- `server.js` - 后端服务器（Express + Socket.io + PostgreSQL）
- `database.js` - 数据库连接和操作模块
- `src/` - 前端Vue.js应用
  - `components/ChatRoom.vue` - 聊天室组件
  - `App.vue` - 主应用组件
  - `main.js` - Vue应用入口

## 安装

### 1. 安装依赖
```bash
npm install
```

### 2. 安装和配置PostgreSQL

#### Windows:
1. 下载并安装PostgreSQL: https://www.postgresql.org/download/windows/
2. 安装过程中设置postgres用户的密码

#### macOS:
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. 创建数据库
```bash
# 连接到PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE chatroom;

# 退出psql
\q
```

### 4. 配置环境变量
复制 `.env.example` 文件为 `.env` 并修改数据库配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件，设置你的数据库连接信息：
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chatroom
DB_USER=postgres
DB_PASSWORD=你的密码
PORT=3000
```

## 启动应用

1. 启动后端服务器
```bash
node server.js
```

2. 在另一个终端窗口启动前端Vue应用
```bash
npm run serve
```

3. 打开浏览器访问 `http://localhost:8080`

## 数据库管理

### 重置数据库
如果需要清空所有数据：
```bash
node resetDb.js
```

### 数据库表结构

#### accounts 表（用户账号）
- id: 主键，自增（整数类型）
- username: 用户名，唯一
- password: 密码
- created_at: 创建时间

#### online_users 表（在线用户）
- id: Socket ID，主键
- username: 用户名
- user_id: 用户账号ID（字符串类型，来自 accounts.id 的字符串转换）
- joined_at: 加入时间

#### messages 表（消息）
- id: 主键，自增
- user_id: 发送者用户ID（字符串类型，与 online_users.user_id 对应）
- username: 发送者用户名
- content: 消息内容
- message_type: 消息类型（user/system）
- timestamp: 发送时间

**重要说明**：
- `accounts.id` 是数据库自增的整数类型
- `online_users.user_id` 和 `messages.user_id` 都是字符串类型（VARCHAR(255)）
- 在登录/注册时，系统会将 `accounts.id` 转换为字符串后返回给前端
- 前端使用这个字符串 ID 作为 `userId` 参与聊天功能

## 使用方法

1. 首次使用需要注册账号
2. 使用注册的用户名和密码登录
3. 登录后自动进入聊天室
4. 在消息输入框中输入消息，按回车键或点击发送按钮发送消息
5. 查看右侧用户列表了解当前在线用户
6. 页面刷新后会自动恢复登录状态

## 开发说明

- 数据库连接使用连接池管理
- 所有数据库操作都使用参数化查询防止SQL注入
- 密码存储为明文（生产环境应使用bcrypt等加密）
- 支持环境变量配置
- 自动创建数据库表结构
