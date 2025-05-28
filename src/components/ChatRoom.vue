<template>
  <div class="chat-container">
    <div v-if="!isAuthenticated" class="auth-container">
      <div class="tabs">
        <button 
          :class="['tab-btn', { active: authTab === 'login' }]" 
          @click="authTab = 'login'; loginError = ''; registerError = ''"
        >
          登录
        </button>
        <button 
          :class="['tab-btn', { active: authTab === 'register' }]" 
          @click="authTab = 'register'; loginError = ''; registerError = ''"
        >
          注册
        </button>
      </div>
      
      <!-- 登录表单 -->
      <div v-if="authTab === 'login'" class="auth-form">
        <h2>登录聊天室</h2>
        <div class="input-group">
          <label>用户名</label>
          <input 
            type="text" 
            v-model="loginForm.username" 
            placeholder="请输入用户名"
          />
        </div>
        <div class="input-group">
          <label>密码</label>
          <input 
            type="password" 
            v-model="loginForm.password" 
            placeholder="请输入密码"
            @keyup.enter="login"
          />
        </div>
        <div v-if="loginError" class="error-message">{{ loginError }}</div>
        <button 
          class="auth-btn" 
          @click="login" 
          :disabled="!loginForm.username || !loginForm.password"
        >
          登录
        </button>
      </div>
      
      <!-- 注册表单 -->
      <div v-if="authTab === 'register'" class="auth-form">
        <h2>注册新账号</h2>
        <div class="input-group">
          <label>用户名</label>
          <input 
            type="text" 
            v-model="registerForm.username" 
            placeholder="请输入用户名"
          />
        </div>
        <div class="input-group">
          <label>密码</label>
          <input 
            type="password" 
            v-model="registerForm.password" 
            placeholder="请输入密码"
          />
        </div>
        <div class="input-group">
          <label>确认密码</label>
          <input 
            type="password" 
            v-model="registerForm.confirmPassword" 
            placeholder="请再次输入密码"
            @keyup.enter="register"
          />
        </div>
        <div v-if="registerError" class="error-message">{{ registerError }}</div>
        <button 
          class="auth-btn" 
          @click="register" 
          :disabled="!registerForm.username || !registerForm.password || !registerForm.confirmPassword"
        >
          注册
        </button>
      </div>
    </div>
    
    <div v-else class="chat-room">
      <div class="chat-header">
        <h2>在线聊天室</h2>
        <div class="user-info">
          <span>欢迎, {{ username }}</span>
          <button class="logout-account-btn" @click="logoutAccount">退出账号</button>
        </div>
      </div>
      
      <div class="chat-body">
        <div class="users-list">
          <h3>在线用户 ({{ users.length }})</h3>
          <ul>
            <li v-for="user in users" :key="user.id">
              {{ user.username }}
            </li>
          </ul>
        </div>
        
        <div class="messages-container">
          <div class="messages-list" ref="messagesList">
            <div class="history-notice" v-if="messages.length > 0">
              <span>显示所有历史消息</span>
            </div>
            <div 
              v-for="message in messages" 
              :key="message.id"
              :class="['message', message.type === 'system' ? 'system-message' : (message.userId === socketId ? 'own-message' : 'other-message')]"
            >
              <div class="message-header" v-if="message.type !== 'system'">
                <strong>{{ message.username }}</strong>
                <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
              </div>
              <div class="message-content">{{ message.content }}</div>
            </div>
          </div>
          
          <div class="message-input">
            <input 
              type="text" 
              v-model="newMessage" 
              placeholder="输入消息..." 
              @keyup.enter="sendMessage"
            />
            <button @click="sendMessage" :disabled="!newMessage.trim()">发送</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import io from 'socket.io-client';

export default {
  name: 'ChatRoom',
  data() {
    return {
      socket: null,
      socketId: null,
      username: '',
      users: [],
      messages: [],
      newMessage: '',
      serverUrl: 'http://localhost:3000',
      authTab: 'login',
      isAuthenticated: false,
      currentUser: null,
      token: null,
      loginForm: {
        username: '',
        password: ''
      },
      registerForm: {
        username: '',
        password: '',
        confirmPassword: ''
      },
      loginError: '',
      registerError: '',
      hasJoinedChat: false
    };
  },
  created() {
    // 从本地存储恢复用户状态
    const savedUserData = localStorage.getItem('chatUserData');
    const savedToken = localStorage.getItem('chatToken');
    if (savedUserData && savedToken) {
      try {
        const userData = JSON.parse(savedUserData);
        this.isAuthenticated = true;
        this.currentUser = userData;
        this.token = savedToken;
        
        // 直接使用账号用户名作为聊天昵称
        this.username = userData.username;
        
        // 如果用户已登录，初始化Socket连接
        this.initializeSocketConnection();
      } catch (e) {
        console.error('解析用户数据失败', e);
        localStorage.removeItem('chatUserData');
        localStorage.removeItem('chatToken');
      }
    }
  },
  beforeDestroy() {
    // 在组件销毁前断开连接
    if (this.socket) {
      this.socket.disconnect();
    }
  },
  methods: {
    // 初始化Socket连接
    initializeSocketConnection() {
      // 断开可能存在的连接
      if (this.socket) {
        console.log('断开旧的Socket连接');
        
        // 移除所有事件监听器，防止重复监听
        this.socket.removeAllListeners();
        
        // 断开连接
        this.socket.disconnect();
        
        // 确保足够的时间让旧连接完全关闭
        setTimeout(() => {
          this.createSocketConnection();
        }, 300);
      } else {
        // 初始化新连接
        this.createSocketConnection();
      }
    },
    
    // 创建Socket连接
    createSocketConnection() {
      console.log('创建Socket连接');
      const socketOptions = {
        auth: {}
      };
      
      // 只有在已登录且有有效token时才添加认证信息
      if (this.isAuthenticated && this.token) {
        socketOptions.auth.token = this.token;
        console.log('使用token创建认证连接');
      } else {
        console.log('创建匿名连接（无token）');
      }
      
      this.socket = io(this.serverUrl, socketOptions);
      
      // 设置事件监听器
      this.setupSocketListeners();
      
      // 只有在已登录时才获取历史消息
      if (this.isAuthenticated && this.token) {
        this.fetchHistoryMessages();
      }
    },
    
    // 获取历史消息
    fetchHistoryMessages() {
      // 准备请求头
      const headers = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      fetch(`${this.serverUrl}/api/messages`, { headers })
        .then(response => {
          if (response.status === 401 || response.status === 403) {
            // Token无效，处理token过期但不抛出错误
            this.handleTokenExpired();
            return null; // 返回null表示没有数据
          }
          return response.json();
        })
        .then(data => {
          // 只有在有数据时才更新消息列表
          if (data) {
            this.messages = data;
            this.$nextTick(() => {
              this.scrollToBottom();
            });
          }
        })
        .catch(error => console.error('获取历史消息失败:', error));
    },
    
    setupSocketListeners() {
      // 连接成功事件
      this.socket.on('connect', () => {
        console.log('已连接到服务器');
        this.socketId = this.socket.id;
        this.hasJoinedChat = false;
        
        // 如果已登录并有用户名，自动重新加入聊天
        if (this.isAuthenticated && this.username) {
          this.joinChatWithUsername(this.username);
        }
        
        // 请求最新的用户列表
        this.socket.emit('get_users');
      });
      
      // 连接错误事件
      this.socket.on('connect_error', (error) => {
        console.error('Socket连接错误:', error);
        
        // 检查是否是认证错误，并且只有在用户已经登录的情况下才处理
        if (error.message && error.message.includes('Authentication error') && this.isAuthenticated && this.token) {
          console.error('Socket认证失败:', error.message);
          this.handleTokenExpired();
        }
      });
      
      // 断开连接事件
      this.socket.on('disconnect', (reason) => {
        console.log('与服务器断开连接:', reason);
      });
      
      // 监听消息事件
      this.socket.on('message', (message) => {
        this.messages.push(message);
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      });
      
      // 监听用户列表更新
      this.socket.on('users_list', (usersList) => {
        this.users = usersList;
      });
      
      // 监听强制登出事件（当账户在其他设备登录时）
      this.socket.on('force_logout', (data) => {
        console.log('收到强制登出事件:', data.message);
        
        // 显示提示信息
        alert(data.message || '您的账户在其他设备上登录，当前连接将被断开');
        
        // 执行登出操作
        this.handleForceLogout();
      });
    },
    
    login() {
      // 清除之前的错误信息
      this.loginError = '';
      
      // 验证表单
      if (!this.loginForm.username || !this.loginForm.password) {
        this.loginError = '请填写用户名和密码';
        return;
      }
      
      // 发送登录请求
      fetch(`${this.serverUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.loginForm)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 登录成功
          this.isAuthenticated = true;
          this.currentUser = data.user;
          this.token = data.token;
          
          // 保存用户数据和token到本地存储
          localStorage.setItem('chatUserData', JSON.stringify(data.user));
          localStorage.setItem('chatToken', data.token);
          
          // 直接使用账号用户名作为聊天昵称
          this.username = data.user.username;
          
          // 清空表单
          this.loginForm = { username: '', password: '' };
          
          // 重置hasJoinedChat标志
          this.hasJoinedChat = false;
          
          // 重新初始化连接并加入聊天
          this.messages = []; // 清空之前的消息
          
          // 如果已经有一个连接，先断开
          if (this.socket && this.socket.connected) {
            this.socket.disconnect();
          }
          
          this.initializeSocketConnection();
        } else {
          // 登录失败
          this.loginError = data.message || '登录失败，请检查用户名和密码';
        }
      })
      .catch(error => {
        console.error('登录请求失败:', error);
        this.loginError = '登录请求失败，请稍后再试';
      });
    },
    register() {
      // 清除之前的错误信息
      this.registerError = '';
      
      // 验证表单
      if (!this.registerForm.username || !this.registerForm.password) {
        this.registerError = '请填写用户名和密码';
        return;
      }
      
      if (this.registerForm.password !== this.registerForm.confirmPassword) {
        this.registerError = '两次输入的密码不一致';
        return;
      }
      
      // 发送注册请求
      fetch(`${this.serverUrl}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.registerForm.username,
          password: this.registerForm.password
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // 注册成功，自动登录
          this.isAuthenticated = true;
          this.currentUser = data.user;
          this.token = data.token;
          
          // 保存用户数据和token到本地存储
          localStorage.setItem('chatUserData', JSON.stringify(data.user));
          localStorage.setItem('chatToken', data.token);
          
          // 直接使用账号用户名作为聊天昵称
          this.username = data.user.username;
          
          // 清空表单
          this.registerForm = { username: '', password: '', confirmPassword: '' };
          
          // 重置hasJoinedChat标志
          this.hasJoinedChat = false;
          
          // 重新初始化连接并加入聊天
          this.messages = []; // 清空之前的消息
          
          // 如果已经有一个连接，先断开
          if (this.socket && this.socket.connected) {
            this.socket.disconnect();
          }
          
          this.initializeSocketConnection();
        } else {
          // 注册失败
          this.registerError = data.message || '注册失败，请尝试其他用户名';
        }
      })
      .catch(error => {
        console.error('注册请求失败:', error);
        this.registerError = '注册请求失败，请稍后再试';
      });
    },
    logoutAccount() {
      // 清除账号信息
      localStorage.removeItem('chatUserData');
      localStorage.removeItem('chatToken');
      
      // 重置状态
      this.isAuthenticated = false;
      this.currentUser = null;
      this.token = null;
      this.username = '';
      this.hasJoinedChat = false;
      
      // 处理Socket连接 - 断开连接但不重连
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null; // 清空socket引用
      }
      
      // 重置表单
      this.loginForm = { username: '', password: '' };
      this.registerForm = { username: '', password: '', confirmPassword: '' };
    },
    joinChatWithUsername(username) {
      // 避免重复加入聊天室
      if (this.hasJoinedChat) {
        console.log('已经加入聊天室，避免重复加入');
        return;
      }
      
      if (!this.socket || !this.socket.connected) {
        console.warn('Socket未连接，尝试重新连接');
        this.initializeSocketConnection();
        
        // 稍后再尝试加入
        setTimeout(() => {
          if (this.socket && this.socket.connected && !this.hasJoinedChat) {
            this.socket.emit('user_join', {
              username: username,
              userId: this.currentUser.id
            });
            this.hasJoinedChat = true;
          }
        }, 1000);
        return;
      }
      
      // 通知服务器用户已加入
      this.socket.emit('user_join', {
        username: username,
        userId: this.currentUser.id
      });
      this.hasJoinedChat = true;
    },
    sendMessage() {
      if (this.newMessage.trim() && this.username) {
        const messageData = {
          username: this.username,
          content: this.newMessage
        };
        
        // 发送消息到服务器
        this.socket.emit('send_message', messageData);
        
        // 清空输入框
        this.newMessage = '';
      }
    },
    scrollToBottom() {
      if (this.$refs.messagesList) {
        this.$refs.messagesList.scrollTop = this.$refs.messagesList.scrollHeight;
      }
    },
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    },
    handleTokenExpired() {
      // 清除本地存储的用户数据和token
      localStorage.removeItem('chatUserData');
      localStorage.removeItem('chatToken');
      
      // 处理Token无效的逻辑
      this.isAuthenticated = false;
      this.currentUser = null;
      this.token = null;
      this.username = '';
      this.hasJoinedChat = false;
      
      // 处理Socket连接 - 断开当前连接但不立即重连
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null; // 清空socket引用，避免重复连接
      }
      
      // 重置表单
      this.loginForm = { username: '', password: '' };
      this.registerForm = { username: '', password: '', confirmPassword: '' };
      
      // 显示错误提示
      this.loginError = 'Token已过期，请重新登录';
    },
    handleForceLogout() {
      // 执行登出操作
      this.logoutAccount();
    }
  }
};
</script>

<style scoped>
.chat-container {
  max-width: 1000px;
  margin: 0 auto;
  font-family: Arial, sans-serif;
}

.auth-container {
  max-width: 400px;
  margin: 100px auto;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #666;
}

.tab-btn.active {
  color: #4CAF50;
  border-bottom: 2px solid #4CAF50;
}

.auth-form {
  padding: 10px 0;
}

.auth-form h2 {
  text-align: center;
  margin-bottom: 20px;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  color: #555;
}

.input-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.auth-btn {
  width: 100%;
  padding: 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.auth-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-bottom: 10px;
  font-size: 14px;
}

.chat-room {
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.chat-header {
  background-color: #4CAF50;
  color: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h2 {
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logout-account-btn {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.logout-account-btn:hover {
  background-color: #c0392b;
}

.chat-body {
  display: flex;
  height: 600px;
}

.users-list {
  width: 200px;
  background-color: #f5f5f5;
  padding: 15px;
  border-right: 1px solid #ddd;
  overflow-y: auto;
}

.users-list h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.users-list ul {
  list-style-type: none;
  padding: 0;
}

.users-list li {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-list {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
}

.message {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 5px;
  max-width: 70%;
}

.own-message {
  background-color: #e3f2fd;
  align-self: flex-end;
  margin-left: auto;
}

.other-message {
  background-color: #f1f1f1;
  align-self: flex-start;
}

.system-message {
  background-color: #fff3cd;
  color: #856404;
  text-align: center;
  margin: 10px auto;
  padding: 5px 10px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.85em;
}

.timestamp {
  color: #888;
}

.message-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #ddd;
}

.message-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  outline: none;
}

.message-input button {
  padding: 10px 15px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.message-input button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.history-notice {
  text-align: center;
  color: #888;
  font-size: 0.8em;
  margin-bottom: 15px;
  padding: 5px;
  background-color: #f8f9fa;
  border-radius: 5px;
}
</style> 