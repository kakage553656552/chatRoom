const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('./database');

// JWT密钥，在生产环境中应该从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * 生成token的SHA256哈希值
 * @param {string} token - JWT token
 * @returns {string} token的哈希值
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 生成JWT token并保存到数据库
 * @param {Object} payload - 要编码到token中的数据
 * @param {string} deviceInfo - 设备信息
 * @param {string} ipAddress - IP地址
 * @returns {Object} 包含token和数据库记录的对象
 */
async function generateAndSaveToken(payload, deviceInfo = null, ipAddress = null) {
  // 生成JWT token
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  
  // 计算token哈希
  const tokenHash = hashToken(token);
  
  // 计算过期时间
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);
  
  // 保存到数据库
  const tokenRecord = await db.saveToken(
    payload.id,
    tokenHash,
    deviceInfo,
    ipAddress,
    expiresAt
  );
  
  return {
    token,
    tokenRecord
  };
}

/**
 * 验证JWT token（包含数据库验证）
 * @param {string} token - 要验证的token
 * @returns {Object} 解码后的payload和数据库信息
 */
async function verifyTokenWithDB(token) {
  try {
    // 首先验证JWT token的格式和签名
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 计算token哈希
    const tokenHash = hashToken(token);
    
    // 从数据库验证token
    const tokenRecord = await db.findTokenByHash(tokenHash);
    
    if (!tokenRecord) {
      throw new Error('Token not found in database or expired');
    }
    
    return {
      ...decoded,
      tokenRecord
    };
  } catch (error) {
    throw new Error('Invalid token: ' + error.message);
  }
}

/**
 * 生成JWT token（原有方法，保持兼容性）
 * @param {Object} payload - 要编码到token中的数据
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证JWT token（原有方法，保持兼容性）
 * @param {string} token - 要验证的token
 * @returns {Object} 解码后的payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Express中间件：验证JWT token（使用数据库验证）
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '访问被拒绝，需要提供token' 
    });
  }

  verifyTokenWithDB(token)
    .then(decoded => {
      req.user = decoded;
      next();
    })
    .catch(error => {
      return res.status(403).json({ 
        success: false, 
        message: 'Token无效或已过期: ' + error.message
      });
    });
}

/**
 * Socket.io中间件：验证JWT token（使用数据库验证）
 * 允许匿名连接，但会区分认证用户和匿名用户
 */
function authenticateSocketToken(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

  if (!token) {
    // 允许匿名连接，但标记为匿名用户
    socket.user = null;
    socket.isAuthenticated = false;
    return next();
  }

  verifyTokenWithDB(token)
    .then(decoded => {
      socket.user = decoded;
      socket.isAuthenticated = true;
      next();
    })
    .catch(error => {
      // Token无效时，也允许连接但标记为匿名用户
      console.warn('Socket认证失败，允许匿名连接:', error.message);
      socket.user = null;
      socket.isAuthenticated = false;
      next();
    });
}

/**
 * 撤销token
 * @param {string} token - 要撤销的token
 * @returns {Object} 撤销结果
 */
async function revokeToken(token) {
  const tokenHash = hashToken(token);
  return await db.revokeToken(tokenHash);
}

/**
 * 撤销用户的所有token
 * @param {number} userId - 用户ID
 * @returns {Array} 撤销的token列表
 */
async function revokeAllUserTokens(userId) {
  return await db.revokeAllUserTokens(userId);
}

module.exports = {
  generateToken,
  verifyToken,
  generateAndSaveToken,
  verifyTokenWithDB,
  authenticateToken,
  authenticateSocketToken,
  revokeToken,
  revokeAllUserTokens,
  hashToken
}; 