/**
 * 数据加密服务
 * 使用 AES-256-GCM 算法对敏感数据进行加密和解密
 */

import crypto from 'crypto';

// ============================================
// 配置
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 初始化向量长度
const SALT_LENGTH = 64; // 盐值长度
const TAG_LENGTH = 16; // 认证标签长度
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// 从环境变量获取密钥
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_encryption_key_change_in_production';

// ============================================
// 密钥派生函数
// ============================================

/**
 * 从主密钥派生加密密钥
 * @param password 主密钥
 * @param salt 盐值
 * @returns 派生的密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// ============================================
// 加密服务类
// ============================================

export class EncryptionService {
  /**
   * 加密文本
   * @param plaintext 明文
   * @param password 密码（可选，默认使用环境变量中的密钥）
   * @returns 加密后的文本（Base64编码）
   */
  static encrypt(plaintext: string, password?: string): string {
    try {
      // 生成随机盐值和初始化向量
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // 派生密钥
      const key = deriveKey(password || ENCRYPTION_KEY, salt);
      
      // 创建加密器
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      
      // 加密
      let encrypted = cipher.update(plaintext, 'utf8', 'binary');
      encrypted += cipher.final('binary');
      
      // 获取认证标签
      const tag = cipher.getAuthTag();
      
      // 组合：盐值 + IV + 标签 + 加密数据
      const buffer = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'binary')]);
      
      // 返回Base64编码
      return buffer.toString('base64');
    } catch (error) {
      console.error('[Encryption] 加密失败:', error);
      throw new Error('加密失败');
    }
  }

  /**
   * 解密文本
   * @param ciphertext 密文（Base64编码）
   * @param password 密码（可选，默认使用环境变量中的密钥）
   * @returns 明文
   */
  static decrypt(ciphertext: string, password?: string): string {
    try {
      // 解码Base64
      const buffer = Buffer.from(ciphertext, 'base64');
      
      // 检查长度
      if (buffer.length < ENCRYPTED_POSITION) {
        throw new Error('密文格式错误');
      }
      
      // 提取盐值、IV、标签和加密数据
      const salt = buffer.subarray(0, SALT_LENGTH);
      const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
      const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
      const encrypted = buffer.subarray(ENCRYPTED_POSITION);
      
      // 派生密钥
      const key = deriveKey(password || ENCRYPTION_KEY, salt);
      
      // 创建解密器
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      // 解密
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[Encryption] 解密失败:', error);
      throw new Error('解密失败');
    }
  }

  /**
   * 加密对象（序列化后加密）
   * @param obj 对象
   * @param password 密码（可选）
   * @returns 加密后的文本（Base64编码）
   */
  static encryptObject(obj: any, password?: string): string {
    try {
      const plaintext = JSON.stringify(obj);
      return this.encrypt(plaintext, password);
    } catch (error) {
      console.error('[Encryption] 加密对象失败:', error);
      throw new Error('加密对象失败');
    }
  }

  /**
   * 解密对象（解密后反序列化）
   * @param ciphertext 密文（Base64编码）
   * @param password 密码（可选）
   * @returns 对象
   */
  static decryptObject<T = any>(ciphertext: string, password?: string): T {
    try {
      const plaintext = this.decrypt(ciphertext, password);
      return JSON.parse(plaintext);
    } catch (error) {
      console.error('[Encryption] 解密对象失败:', error);
      throw new Error('解密对象失败');
    }
  }

  /**
   * 哈希密码（单向加密，用于密码存储）
   * @param password 明文密码
   * @returns 哈希后的密码
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * 验证密码
   * @param password 明文密码
   * @param hashedPassword 哈希后的密码
   * @returns 是否匹配
   */
  static verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      return hash === verifyHash;
    } catch (error) {
      console.error('[Encryption] 验证密码失败:', error);
      return false;
    }
  }

  /**
   * 生成随机字符串
   * @param length 长度
   * @returns 随机字符串
   */
  static randomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成UUID
   * @returns UUID字符串
   */
  static uuid(): string {
    return crypto.randomUUID();
  }

  /**
   * 生成安全的令牌
   * @param length 长度（字节）
   * @returns Base64编码的令牌
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * HMAC签名
   * @param data 数据
   * @param secret 密钥
   * @returns 签名（Base64编码）
   */
  static sign(data: string, secret?: string): string {
    const hmac = crypto.createHmac('sha256', secret || ENCRYPTION_KEY);
    hmac.update(data);
    return hmac.digest('base64');
  }

  /**
   * 验证HMAC签名
   * @param data 数据
   * @param signature 签名
   * @param secret 密钥
   * @returns 是否匹配
   */
  static verify(data: string, signature: string, secret?: string): boolean {
    const computedSignature = this.sign(data, secret);
    return computedSignature === signature;
  }

  /**
   * 掩码敏感信息（部分隐藏）
   * @param value 原始值
   * @param showLength 显示的字符数
   * @param maskChar 掩码字符
   * @returns 掩码后的值
   */
  static maskSensitive(
    value: string,
    showLength: number = 4,
    maskChar: string = '*'
  ): string {
    if (!value || value.length <= showLength) {
      return maskChar.repeat(value?.length || 0);
    }

    const start = value.substring(0, showLength);
    const end = value.substring(value.length - showLength);
    const mask = maskChar.repeat(Math.max(0, value.length - showLength * 2));

    return `${start}${mask}${end}`;
  }

  /**
   * 掩码手机号
   * @param phone 手机号
   * @returns 掩码后的手机号
   */
  static maskPhone(phone: string): string {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 掩码邮箱
   * @param email 邮箱
   * @returns 掩码后的邮箱
   */
  static maskEmail(email: string): string {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;
    
    const maskedUsername = username.substring(0, 2) + '***';
    return `${maskedUsername}@${domain}`;
  }

  /**
   * 掩码身份证号
   * @param idCard 身份证号
   * @returns 掩码后的身份证号
   */
  static maskIdCard(idCard: string): string {
    if (!idCard || idCard.length < 8) return idCard;
    return idCard.replace(/(\d{6})\d*(\d{4})/, '$1********$2');
  }

  /**
   * 掩码银行卡号
   * @param bankCard 银行卡号
   * @returns 掩码后的银行卡号
   */
  static maskBankCard(bankCard: string): string {
    if (!bankCard || bankCard.length < 8) return bankCard;
    return bankCard.replace(/(\d{4})\d*(\d{4})/, '$1 **** **** $2');
  }
}

// ============================================
// 敏感字段加密装饰器
// ============================================

/**
 * 自动加密敏感字段的装饰器
 * @param fields 要加密的字段列表
 */
export function withEncryption<_T extends Record<string, any>>(fields: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        // 在保存前加密敏感字段
        const result = await originalMethod.apply(this, args);

        // 如果返回的是数据对象，自动加密敏感字段
        if (result && typeof result === 'object') {
          for (const field of fields) {
            if (result[field] && typeof result[field] === 'string') {
              result[field] = EncryptionService.encrypt(result[field]);
            }
          }
        }

        return result;
      } catch (error) {
        console.error('[Encryption] 加密装饰器执行失败:', error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 自动解密敏感字段的装饰器
 * @param fields 要解密的字段列表
 */
export function withDecryption<_T extends Record<string, any>>(fields: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args);

        // 如果返回的是数据对象或数组，自动解密敏感字段
        const decryptObject = (obj: any): any => {
          if (!obj || typeof obj !== 'object') return obj;

          if (Array.isArray(obj)) {
            return obj.map(decryptObject);
          }

          const decrypted = { ...obj };
          for (const field of fields) {
            if (decrypted[field] && typeof decrypted[field] === 'string') {
              try {
                decrypted[field] = EncryptionService.decrypt(decrypted[field]);
              } catch {
                // 解密失败，保持原样
              }
            }
          }
          return decrypted;
        };

        return decryptObject(result);
      } catch (error) {
        console.error('[Encryption] 解密装饰器执行失败:', error);
        throw error;
      }
    };

    return descriptor;
  };
}

// ============================================
// 导出
// ============================================

export default EncryptionService;
