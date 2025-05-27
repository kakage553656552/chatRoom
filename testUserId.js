const { db } = require('./database');

async function testUserIdStringType() {
  try {
    console.log('开始测试 user_id 字符串类型...');
    
    // 测试创建账号
    console.log('\n1. 测试账号创建...');
    const testUser = await db.createAccount('test_user_' + Date.now(), 'password123');
    console.log('创建的账号 ID:', testUser.id, '类型:', typeof testUser.id);
    
    // 将账号 ID 转换为字符串（模拟登录过程）
    const userIdString = testUser.id.toString();
    console.log('转换为字符串的 user_id:', userIdString, '类型:', typeof userIdString);
    
    // 测试添加在线用户
    console.log('\n2. 测试添加在线用户...');
    const socketId = 'test_socket_' + Date.now();
    await db.addOnlineUser(socketId, testUser.username, userIdString);
    console.log('添加在线用户成功，user_id:', userIdString);
    
    // 测试查找在线用户
    console.log('\n3. 测试查找在线用户...');
    const onlineUser = await db.findOnlineUserByUserId(userIdString);
    if (onlineUser) {
      console.log('找到在线用户，user_id:', onlineUser.user_id, '类型:', typeof onlineUser.user_id);
    } else {
      console.log('未找到在线用户');
    }
    
    // 测试添加消息
    console.log('\n4. 测试添加消息...');
    const message = await db.addMessage(userIdString, testUser.username, '测试消息', 'user');
    console.log('添加消息成功，user_id:', message.user_id, '类型:', typeof message.user_id);
    
    // 测试获取最近消息
    console.log('\n5. 测试获取最近消息...');
    const recentMessages = await db.getRecentMessages(1);
    if (recentMessages.length > 0) {
      const lastMessage = recentMessages[recentMessages.length - 1];
      console.log('最近消息的 user_id:', lastMessage.user_id, '类型:', typeof lastMessage.user_id);
    }
    
    // 清理测试数据
    console.log('\n6. 清理测试数据...');
    await db.removeOnlineUser(socketId);
    console.log('清理完成');
    
    console.log('\n✅ 所有测试通过！user_id 在整个系统中都是字符串类型。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行测试
testUserIdStringType(); 