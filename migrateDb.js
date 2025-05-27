const { migrateDatabase } = require('./database');

async function runMigration() {
  try {
    console.log('开始执行数据库迁移...');
    
    await migrateDatabase();
    
    console.log('数据库迁移成功完成！');
    console.log('所有表现在都包含了 created_time 和 update_time 字段');
    console.log('update_time 字段会在记录更新时自动更新');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    console.log('请检查：');
    console.log('1. PostgreSQL服务是否已启动');
    console.log('2. 数据库连接配置是否正确（.env文件）');
    console.log('3. 数据库是否已创建');
    console.log('4. 用户是否有足够的权限修改表结构');
    process.exit(1);
  }
}

runMigration(); 