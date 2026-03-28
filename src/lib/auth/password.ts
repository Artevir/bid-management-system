/**
 * 密码加密/解密服务
 * 使用bcryptjs进行密码哈希和验证
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // 加密强度（推荐10-12）

/**
 * 密码加密
 * @param password 明文密码
 * @returns 加密后的密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * 密码验证
 * @param password 明文密码
 * @param hashedPassword 已加密的密码哈希
 * @returns 是否匹配
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 生成随机密码
 * @param length 密码长度（默认12位）
 * @returns 随机密码
 */
export function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // 确保包含各种类型的字符
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // 填充剩余字符
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 密码强度评分（0-5）
 */
export function validatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  let score = 0;
  const feedback: string[] = [];
  
  // 长度检查
  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('密码长度至少8位');
  }
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('应包含大写字母');
  }
  
  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('应包含小写字母');
  }
  
  // 包含数字
  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('应包含数字');
  }
  
  // 包含特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    score++;
  } else {
    feedback.push('应包含特殊字符');
  }
  
  return { score, feedback };
}
