<template>
  <div class="chat-container">
    <!-- 服务器状态提示 -->
    <div v-if="!serverOnline" class="server-status-alert">
      <div class="alert-content">
        <i class="status-icon">!</i>
        <span>服务器连接失败，请检查服务器是否在线</span>
        <button @click="checkServerStatus" class="retry-btn">重试连接</button>
      </div>
    </div>

    <div v-if="!isAuthenticated" class="auth-container">
      <div class="tabs">
        <button 
          :class="['tab-btn', { active: authTab === 'login' }]" 
          @click="authTab = 'login'"
        >
          登录
        </button>
        <button 
          :class="['tab-btn', { active: authTab === 'register' }]" 
          @click="authTab = 'register'"
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
              <span>仅显示最近5条消息历史</span>
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
      serverOnline: true,
      checkingServer: false,
      reconnectInterval: null
    };
  },
  created() {
    // 初始检查服务器状态
    this.checkServerStatus();
    
    // 从本地存储恢复用户状态
    const savedUserData = localStorage.getItem('chatUserData');
    if (savedUserData) {
      try {
        const userData = JSON.parse(savedUserData);
        this.isAuthenticated = true;
        this.currentUser = userData;
        
        // 直接使用账号用户名作为聊天昵称
        this.username = userData.username;
      } catch (e) {
        console.error('解析用户数据失败', e);
        localStorage.removeItem('chatUserData');
      }
    }
  },
  beforeDestroy() {
    // 清除重连定时器
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    
    // 在组件销毁前断开连接
    if (this.socket) {
      this.socket.disconnect();
    }
  },
  methods: {
    // 检查服务器状态
    checkServerStatus() {
      if (this.checkingServer) return;
      
      this.checkingServer = true;
      
      // 尝试连接服务器
      fetch(`${this.serverUrl}/api/users`)
        .then(response => {
          if (response.ok) {
            this.serverOnline = true;
            
            // 如果之前服务器不在线，重新初始化Socket连接
            if (!this.socket || !this.socket.connected) {
              this.initializeSocketConnection();
            }
            
            // 停止自动重连
            if (this.reconnectInterval) {
              clearInterval(this.reconnectInterval);
              this.reconnectInterval = null;
            }
            
            return response.json();
          } else {
            throw new Error('服务器响应错误');
          }
        })
        .then(data => {
          // 更新用户列表
          this.users = data;
        })
        .catch(error => {
          console.error('服务器连接失败:', error);
          this.serverOnline = false;
          
          // 启动自动重连
          if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
              this.checkServerStatus();
            }, 5000); // 每5秒尝试重连
          }
        })
        .finally(() => {
          this.checkingServer = false;
        });
    },
    
    // 初始化Socket连接
    initializeSocketConnection() {
      // 断开可能存在的连接
      if (this.socket) {
        this.socket.disconnect();
      }
      
      // 初始化新连接
      this.socket = io(this.serverUrl);
      
      // 设置事件监听器
      this.setupSocketListeners();
      
      // 获取历史消息（限制5条）
      fetch(`${this.serverUrl}/api/messages?limit=5`)
        .then(response => response.json())
        .then(data => {
          this.messages = data;
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        })
        .catch(error => console.error('获取历史消息失败:', error));
    },
    
    setupSocketListeners() {
      // 连接成功事件
      this.socket.on('connect', () => {
        console.log('已连接到服务器');
        this.socketId = this.socket.id;
        this.serverOnline = true;
        
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
        this.serverOnline = false;
      });
      
      // 断开连接事件
      this.socket.on('disconnect', (reason) => {
        console.log('与服务器断开连接:', reason);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          // 服务器主动断开或网络问题
          this.serverOnline = false;
        }
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
    },
    
    login() {
      // 如果服务器不在线，提示用户
      if (!this.serverOnline) {
        this.loginError = '服务器不在线，请稍后再试';
        return;
      }
      
      // 重置错误信息
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
          
          // 保存用户数据到本地存储
          localStorage.setItem('chatUserData', JSON.stringify(data.user));
          
          // 直接使用账号用户名作为聊天昵称
          this.username = data.user.username;
          
          // 清空表单
          this.loginForm = { username: '', password: '' };
          
          // 重新初始化连接并加入聊天
          this.messages = []; // 清空之前的消息
          this.initializeSocketConnection();
          
          // 稍后加入聊天（等待连接和消息加载完成）
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              this.joinChatWithUsername(this.username);
            }
          }, 500);
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
      // 如果服务器不在线，提示用户
      if (!this.serverOnline) {
        this.registerError = '服务器不在线，请稍后再试';
        return;
      }
      
      // 重置错误信息
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
          
          // 保存用户数据到本地存储
          localStorage.setItem('chatUserData', JSON.stringify(data.user));
          
          // 直接使用账号用户名作为聊天昵称
          this.username = data.user.username;
          
          // 清空表单
          this.registerForm = { username: '', password: '', confirmPassword: '' };
          
          // 重新初始化连接并加入聊天
          this.messages = []; // 清空之前的消息
          this.initializeSocketConnection();
          
          // 稍后加入聊天（等待连接和消息加载完成）
          setTimeout(() => {
            if (this.socket && this.socket.connected) {
              this.joinChatWithUsername(this.username);
            }
          }, 500);
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
      
      // 重置状态
      this.isAuthenticated = false;
      this.currentUser = null;
      this.username = '';
      
      // 处理Socket连接
      if (this.socket) {
        this.socket.disconnect();
        
        // 重新连接
        setTimeout(() => {
          if (this.serverOnline) {
            this.initializeSocketConnection();
          }
        }, 500);
      }
      
      // 重置表单
      this.loginForm = { username: '', password: '' };
      this.registerForm = { username: '', password: '', confirmPassword: '' };
    },
    joinChatWithUsername(username) {
      // 检查服务器和连接状态
      if (!this.serverOnline) {
        console.warn('服务器不在线，无法加入聊天');
        return;
      }
      
      if (!this.socket || !this.socket.connected) {
        console.warn('Socket未连接，尝试重新连接');
        this.initializeSocketConnection();
        
        // 稍后再尝试加入
        setTimeout(() => {
          if (this.socket && this.socket.connected) {
            this.socket.emit('user_join', {
              username: username,
              userId: this.currentUser.id
            });
          }
        }, 1000);
        return;
      }
      
      // 通知服务器用户已加入
      this.socket.emit('user_join', {
        username: username,
        userId: this.currentUser.id
      });
    },
    sendMessage() {
      // 如果服务器不在线，不允许发送消息
      if (!this.serverOnline) {
        alert('服务器不在线，无法发送消息');
        return;
      }
      
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
    }
  }
};
</script>

<style scoped>
/* 添加服务器状态提示样式 */
.server-status-alert {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px;
  z-index: 1000;
  text-align: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.alert-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.status-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  background-color: #721c24;
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 24px;
  font-weight: bold;
  font-style: normal;
}

.retry-btn {
  background-color: #721c24;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  margin-left: 10px;
}

.retry-btn:hover {
  background-color: #5a171d;
}

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