# 在线聊天室

一个使用Vue.js、Express、Socket.io和LowDB构建的简单在线聊天应用。

## 功能特点

- 实时消息传递
- 用户在线状态显示
- 系统消息通知（用户加入/离开）
- 消息持久化存储
- 简洁美观的UI界面

## 项目结构

- `server.js` - 后端服务器（Express + Socket.io + LowDB）
- `src/` - 前端Vue.js应用
  - `components/ChatRoom.vue` - 聊天室组件
  - `App.vue` - 主应用组件
  - `main.js` - Vue应用入口

## 安装

```bash
# 安装依赖
npm install
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

## 使用方法

1. 输入用户名加入聊天室
2. 在消息输入框中输入消息，按回车键或点击发送按钮发送消息
3. 查看右侧用户列表了解当前在线用户

## 技术栈

- 前端：Vue.js 2.x
- 后端：Express.js
- 实时通信：Socket.io
- 数据存储：LowDB（轻量级JSON数据库）
