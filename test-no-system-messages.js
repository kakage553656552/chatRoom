/**
 * 测试系统消息过滤功能
 * 
 * 验证：
 * 1. 用户消息正常保存和获取
 * 2. 系统消息不会出现在历史消息中
 * 3. getRecentMessages只返回用户消息
 */

const { db } = require('./database');

async function testNoSystemMessages() {
  try {
    console.log('开始测试系统消息过滤功能...\n');
    
    // 清理测试数据
    console.log('清理测试数据...');
    await db.clearAllData();
    
    // 创建测试用户
    const testUser = await db.createAccount('testuser', 'testpassword');
    console.log('创建测试用户:', testUser.username);
    
    console.log('\n=== 测试步骤 1: 添加用户消息 ===');
    const userMessage1 = await db.addMessage('socket1', 'testuser', '这是第一条用户消息', 'user');
    console.log('添加用户消息1:', userMessage1.content);
    
    const userMessage2 = await db.addMessage('socket1', 'testuser', '这是第二条用户消息', 'user');
    console.log('添加用户消息2:', userMessage2.content);
    
    console.log('\n=== 测试步骤 2: 添加系统消息（应该被过滤） ===');
    const systemMessage1 = await db.addMessage('socket1', 'testuser', 'testuser 加入了聊天室', 'system');
    console.log('添加系统消息1:', systemMessage1.content);
    
    const systemMessage2 = await db.addMessage('socket1', 'testuser', 'testuser 离开了聊天室', 'system');
    console.log('添加系统消息2:', systemMessage2.content);
    
    console.log('\n=== 测试步骤 3: 添加更多用户消息 ===');
    const userMessage3 = await db.addMessage('socket1', 'testuser', '这是第三条用户消息', 'user');
    console.log('添加用户消息3:', userMessage3.content);
    
    console.log('\n=== 测试步骤 4: 获取历史消息（应该只包含用户消息） ===');
    const recentMessages = await db.getRecentMessages(10);
    
    console.log(`获取到 ${recentMessages.length} 条历史消息:`);
    recentMessages.forEach((msg, index) => {
      console.log(`消息 ${index + 1}: [${msg.message_type}] ${msg.content}`);
    });
    
    console.log('\n=== 验证结果 ===');
    const userMessages = recentMessages.filter(msg => msg.message_type === 'user');
    const systemMessages = recentMessages.filter(msg => msg.message_type === 'system');
    
    console.log(`用户消息数量: ${userMessages.length}`);
    console.log(`系统消息数量: ${systemMessages.length}`);
    
    if (systemMessages.length === 0) {
      console.log('✅ 正确：历史消息中没有系统消息');
    } else {
      console.log('❌ 错误：历史消息中仍包含系统消息');
    }
    
    if (userMessages.length === 3) {
      console.log('✅ 正确：所有用户消息都被正确获取');
    } else {
      console.log('❌ 错误：用户消息数量不正确');
    }
    
    console.log('\n✅ 系统消息过滤功能测试完成！');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testNoSystemMessages()
    .then(() => {
      console.log('\n测试执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testNoSystemMessages }; 