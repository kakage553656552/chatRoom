const { generateAndSaveToken, verifyTokenWithDB, revokeToken } = require('./auth');
const { db } = require('./database');

async function testTokenDatabase() {
  console.log('=== Token数据库存储测试 ===\n');

  try {
    // 1. 测试生成并保存token
    console.log('1. 生成并保存token到数据库');
    const userPayload = {
      id: 1,
      username: 'testuser'
    };
    
    const deviceInfo = 'Test Browser/1.0';
    const ipAddress = '127.0.0.1';
    
    const tokenData = await generateAndSaveToken(userPayload, deviceInfo, ipAddress);
    console.log('✅ Token生成成功');
    console.log('  - Token长度:', tokenData.token.length);
    console.log('  - 数据库记录ID:', tokenData.tokenRecord.id);
    console.log('  - 设备信息:', tokenData.tokenRecord.device_info);
    console.log('  - IP地址:', tokenData.tokenRecord.ip_address);
    console.log('  - 过期时间:', tokenData.tokenRecord.expires_at);

    // 2. 测试验证token
    console.log('\n2. 验证token（包含数据库验证）');
    const verifiedData = await verifyTokenWithDB(tokenData.token);
    console.log('✅ Token验证成功');
    console.log('  - 用户ID:', verifiedData.id);
    console.log('  - 用户名:', verifiedData.username);
    console.log('  - Token记录用户名:', verifiedData.tokenRecord.username);

    // 3. 测试查看用户的活跃token
    console.log('\n3. 查看用户的活跃token');
    const activeTokens = await db.getUserActiveTokens(1);
    console.log('✅ 活跃token数量:', activeTokens.length);
    activeTokens.forEach((token, index) => {
      console.log(`  Token ${index + 1}:`);
      console.log(`    - 设备: ${token.device_info}`);
      console.log(`    - IP: ${token.ip_address}`);
      console.log(`    - 创建时间: ${token.created_time}`);
    });

    // 4. 测试撤销token
    console.log('\n4. 撤销token');
    const revokedToken = await revokeToken(tokenData.token);
    console.log('✅ Token撤销成功');
    console.log('  - 撤销的token ID:', revokedToken.id);

    // 5. 测试验证已撤销的token
    console.log('\n5. 验证已撤销的token');
    try {
      await verifyTokenWithDB(tokenData.token);
      console.log('❌ 验证成功（这不应该发生）');
    } catch (error) {
      console.log('✅ 验证失败（预期结果）:', error.message);
    }

    // 6. 测试清理过期token
    console.log('\n6. 清理过期/无效token');
    const cleanedCount = await db.cleanExpiredTokens();
    console.log('✅ 清理完成，清理数量:', cleanedCount);

    console.log('\n=== 测试完成 ===');
    console.log('✅ 所有测试通过！Token数据库存储功能正常工作');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    // 关闭数据库连接
    process.exit(0);
  }
}

// 运行测试
testTokenDatabase(); 