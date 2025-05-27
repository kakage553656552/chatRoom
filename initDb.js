const { initDatabase } = require('./database');

async function setupDatabase() {
  try {
    console.log('开始初始化数据库...');
    
    await initDatabase();
    
    console.log('数据库初始化成功！');
    console.log('现在可以启动服务器了：node server.js');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    console.log('请检查：');
    console.log('1. PostgreSQL服务是否已启动');
    console.log('2. 数据库连接配置是否正确（.env文件）');
    console.log('3. 数据库是否已创建');
    process.exit(1);
  }
}

setupDatabase(); 