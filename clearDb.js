const { pool } = require('./database');

async function clearDatabase() {
  try {
    console.log('开始清空数据库...');
    
    // 删除所有触发器
    console.log('删除触发器...');
    await pool.query('DROP TRIGGER IF EXISTS update_accounts_modtime ON accounts');
    await pool.query('DROP TRIGGER IF EXISTS update_online_users_modtime ON online_users');
    await pool.query('DROP TRIGGER IF EXISTS update_messages_modtime ON messages');
    
    // 删除触发器函数
    console.log('删除触发器函数...');
    await pool.query('DROP FUNCTION IF EXISTS update_modified_column()');
    
    // 删除所有表
    console.log('删除数据表...');
    await pool.query('DROP TABLE IF EXISTS messages CASCADE');
    await pool.query('DROP TABLE IF EXISTS online_users CASCADE');
    await pool.query('DROP TABLE IF EXISTS accounts CASCADE');
    
    console.log('数据库清空完成！');
    console.log('现在可以重新初始化数据库了：npm run init-db');
    process.exit(0);
  } catch (error) {
    console.error('清空数据库失败:', error);
    console.log('请检查：');
    console.log('1. PostgreSQL服务是否已启动');
    console.log('2. 数据库连接配置是否正确（.env文件）');
    console.log('3. 用户是否有足够的权限删除表');
    process.exit(1);
  }
}

clearDatabase(); 