require('dotenv').config();
const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chatroom',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
});

// 测试连接
pool.on('connect', () => {
  console.log('数据库连接池已连接');
});

pool.on('error', (err) => {
  console.error('数据库连接池错误:', err);
});

// 数据库迁移函数 - 为现有表添加时间字段
async function migrateDatabase() {
  try {
    console.log('开始数据库迁移...');
    
    // 为accounts表添加时间字段
    await pool.query(`
      ALTER TABLE accounts 
      ADD COLUMN IF NOT EXISTS created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    // 为online_users表添加时间字段
    await pool.query(`
      ALTER TABLE online_users 
      ADD COLUMN IF NOT EXISTS created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    // 为messages表添加时间字段
    await pool.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    // 确保 user_id 字段是字符串类型
    console.log('确保 user_id 字段为字符串类型...');
    
    // 更新 online_users 表的 user_id 字段类型
    await pool.query(`
      ALTER TABLE online_users 
      ALTER COLUMN user_id TYPE VARCHAR(255)
    `);
    
    // 更新 messages 表的 user_id 字段类型
    await pool.query(`
      ALTER TABLE messages 
      ALTER COLUMN user_id TYPE VARCHAR(255)
    `);
    
    console.log('user_id 字段类型确认完成');
    
    // 创建触发器函数来自动更新update_time
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.update_time = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    // 为每个表创建触发器
    await pool.query(`
      DROP TRIGGER IF EXISTS update_accounts_modtime ON accounts;
      CREATE TRIGGER update_accounts_modtime 
        BEFORE UPDATE ON accounts 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_online_users_modtime ON online_users;
      CREATE TRIGGER update_online_users_modtime 
        BEFORE UPDATE ON online_users 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_messages_modtime ON messages;
      CREATE TRIGGER update_messages_modtime 
        BEFORE UPDATE ON messages 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);
    
    console.log('数据库迁移完成');
  } catch (error) {
    console.error('数据库迁移失败:', error);
    throw error;
  }
}

// 初始化数据库表
async function initDatabase() {
  try {
    // 创建用户账号表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建在线用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS online_users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建消息表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        username VARCHAR(50),
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'user',
        created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建触发器函数来自动更新update_time
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.update_time = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    // 为每个表创建触发器
    await pool.query(`
      DROP TRIGGER IF EXISTS update_accounts_modtime ON accounts;
      CREATE TRIGGER update_accounts_modtime 
        BEFORE UPDATE ON accounts 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_online_users_modtime ON online_users;
      CREATE TRIGGER update_online_users_modtime 
        BEFORE UPDATE ON online_users 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);
    
    await pool.query(`
      DROP TRIGGER IF EXISTS update_messages_modtime ON messages;
      CREATE TRIGGER update_messages_modtime 
        BEFORE UPDATE ON messages 
        FOR EACH ROW EXECUTE FUNCTION update_modified_column()
    `);

    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 数据库操作方法
const db = {
  // 账号相关操作
  async createAccount(username, password) {
    const result = await pool.query(
      'INSERT INTO accounts (username, password) VALUES ($1, $2) RETURNING id, username, created_time',
      [username, password]
    );
    return result.rows[0];
  },

  async findAccountByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE username = $1',
      [username]
    );
    return result.rows[0];
  },

  // 在线用户相关操作
  async addOnlineUser(socketId, username, userId) {
    await pool.query(
      'INSERT INTO online_users (id, username, user_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET username = $2, user_id = $3, update_time = CURRENT_TIMESTAMP',
      [socketId, username, userId]
    );
  },

  async findOnlineUserByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM online_users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  },

  async updateOnlineUserSocketId(userId, newSocketId) {
    await pool.query(
      'UPDATE online_users SET id = $1, update_time = CURRENT_TIMESTAMP WHERE user_id = $2',
      [newSocketId, userId]
    );
  },

  async removeOnlineUser(socketId) {
    const result = await pool.query(
      'DELETE FROM online_users WHERE id = $1 RETURNING *',
      [socketId]
    );
    return result.rows[0];
  },

  async getAllOnlineUsers() {
    const result = await pool.query(
      'SELECT * FROM online_users ORDER BY created_time'
    );
    return result.rows;
  },

  // 消息相关操作
  async addMessage(userId, username, content, messageType = 'user') {
    const result = await pool.query(
      'INSERT INTO messages (user_id, username, content, message_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, username, content, messageType]
    );
    return result.rows[0];
  },

  async getRecentMessages(limit = 5) {
    const result = await pool.query(
      'SELECT * FROM messages ORDER BY created_time DESC LIMIT $1',
      [limit]
    );
    return result.rows.reverse(); // 反转以保持时间正序
  },

  // 清理数据库（可选，用于测试）
  async clearAllData() {
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM online_users');
    await pool.query('DELETE FROM accounts');
  }
};

module.exports = {
  pool,
  initDatabase,
  migrateDatabase,
  db
}; 