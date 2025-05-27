/**
 * 单设备登录功能测试
 * 
 * 这个测试文件用于验证单设备登录功能是否正常工作
 * 
 * 测试场景：
 * 1. 用户在设备A登录
 * 2. 用户在设备B登录（应该会撤销设备A的token）
 * 3. 设备A的请求应该被拒绝
 */

const { db } = require('./database');
const { generateAndSaveToken, verifyTokenWithDB, revokeAllUserTokens } = require('./auth');

async function testSingleDeviceLogin() {
  try {
    console.log('开始测试单设备登录功能...\n');
    
    // 创建测试用户（如果不存在）
    let testUser;
    try {
      testUser = await db.findAccountByUsername('testuser');
      if (!testUser) {
        testUser = await db.createAccount('testuser', 'testpassword');
        console.log('创建测试用户:', testUser);
      } else {
        console.log('使用现有测试用户:', testUser);
      }
    } catch (error) {
      console.error('创建/查找测试用户失败:', error);
      return;
    }
    
    console.log('\n=== 测试步骤 1: 设备A登录 ===');
    const deviceAToken = await generateAndSaveToken(
      { id: testUser.id, username: testUser.username },
      'Device A - Chrome/Windows',
      '192.168.1.100'
    );
    console.log('设备A token生成成功');
    
    // 验证设备A的token
    const deviceAVerification = await verifyTokenWithDB(deviceAToken.token);
    console.log('设备A token验证成功:', deviceAVerification.username);
    
    console.log('\n=== 测试步骤 2: 设备B登录（应该撤销设备A的token）===');
    
    // 模拟登录时撤销所有现有token
    const revokedTokens = await revokeAllUserTokens(testUser.id);
    console.log(`撤销了 ${revokedTokens.length} 个现有token`);
    
    const deviceBToken = await generateAndSaveToken(
      { id: testUser.id, username: testUser.username },
      'Device B - Safari/iPhone',
      '192.168.1.101'
    );
    console.log('设备B token生成成功');
    
    // 验证设备B的token
    const deviceBVerification = await verifyTokenWithDB(deviceBToken.token);
    console.log('设备B token验证成功:', deviceBVerification.username);
    
    console.log('\n=== 测试步骤 3: 验证设备A的token已失效 ===');
    try {
      await verifyTokenWithDB(deviceAToken.token);
      console.log('❌ 错误：设备A的token仍然有效！');
    } catch (error) {
      console.log('✅ 正确：设备A的token已失效 -', error.message);
    }
    
    console.log('\n=== 测试步骤 4: 验证设备B的token仍然有效 ===');
    try {
      const verification = await verifyTokenWithDB(deviceBToken.token);
      console.log('✅ 正确：设备B的token仍然有效 -', verification.username);
    } catch (error) {
      console.log('❌ 错误：设备B的token失效了！', error.message);
    }
    
    console.log('\n=== 测试步骤 5: 查看用户的活跃token ===');
    const activeTokens = await db.getUserActiveTokens(testUser.id);
    console.log(`用户当前有 ${activeTokens.length} 个活跃token`);
    activeTokens.forEach((token, index) => {
      console.log(`Token ${index + 1}:`, {
        device: token.device_info,
        ip: token.ip_address,
        created: token.created_time
      });
    });
    
    console.log('\n✅ 单设备登录功能测试完成！');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testSingleDeviceLogin()
    .then(() => {
      console.log('\n测试执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testSingleDeviceLogin }; 