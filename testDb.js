require('dotenv').config();
const { pool } = require('./database');

async function testConnection() {
  try {
    console.log('测试数据库连接...');
    console.log('连接配置:');
    console.log('- Host:', process.env.DB_HOST || 'localhost');
    console.log('- Port:', process.env.DB_PORT || 5432);
    console.log('- Database:', process.env.DB_NAME || 'chatroom');
    console.log('- User:', process.env.DB_USER || 'postgres');
    console.log('- Password:', process.env.DB_PASSWORD ? '***' : '未设置');
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    
    console.log('✅ 数据库连接成功！');
    console.log('当前时间:', result.rows[0].now);
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    console.error('完整错误:', error);
    console.log('\n请检查：');
    console.log('1. PostgreSQL服务是否已启动');
    console.log('2. .env文件中的数据库配置是否正确');
    console.log('3. 数据库用户是否有权限访问指定数据库');
    process.exit(1);
  }
}

testConnection(); 