const { db } = require('./database');

async function resetDatabase() {
  try {
    console.log('开始重置数据库...');
    
    // 清空所有数据
    await db.clearAllData();
    
    console.log('数据库重置完成！');
    process.exit(0);
  } catch (error) {
    console.error('重置数据库失败:', error);
    process.exit(1);
  }
}

resetDatabase(); 