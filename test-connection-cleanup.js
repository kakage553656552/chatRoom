const { db } = require('./database');

async function testConnectionCleanup() {
  console.log('开始测试连接清理机制...');
  
  try {
    // 1. 查看当前在线用户
    console.log('\n1. 当前在线用户:');
    const onlineUsers = await db.getAllOnlineUsers();
    console.log(`在线用户数量: ${onlineUsers.length}`);
    onlineUsers.forEach(user => {
      console.log(`- ${user.username} (${user.user_id}) - Socket: ${user.id}`);
    });
    
    // 2. 模拟添加一个测试用户
    console.log('\n2. 添加测试用户...');
    const testSocketId = 'test-socket-' + Date.now();
    const testUsername = 'TestUser';
    const testUserId = 'test-user-' + Date.now();
    
    await db.addOnlineUser(testSocketId, testUsername, testUserId);
    console.log(`已添加测试用户: ${testUsername} (${testUserId})`);
    
    // 3. 再次查看在线用户
    console.log('\n3. 添加后的在线用户:');
    const updatedUsers = await db.getAllOnlineUsers();
    console.log(`在线用户数量: ${updatedUsers.length}`);
    updatedUsers.forEach(user => {
      console.log(`- ${user.username} (${user.user_id}) - Socket: ${user.id}`);
    });
    
    // 4. 模拟清理断开的连接（移除测试用户）
    console.log('\n4. 清理测试用户...');
    const removedUser = await db.removeOnlineUser(testSocketId);
    if (removedUser) {
      console.log(`已清理用户: ${removedUser.username} (${removedUser.user_id})`);
    } else {
      console.log('未找到要清理的用户');
    }
    
    // 5. 最终查看在线用户
    console.log('\n5. 清理后的在线用户:');
    const finalUsers = await db.getAllOnlineUsers();
    console.log(`在线用户数量: ${finalUsers.length}`);
    finalUsers.forEach(user => {
      console.log(`- ${user.username} (${user.user_id}) - Socket: ${user.id}`);
    });
    
    console.log('\n✅ 连接清理机制测试完成');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testConnectionCleanup().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testConnectionCleanup }; 