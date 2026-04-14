/**
 * 加密测试 API
 * 用于测试数据加密功能
 */

import { NextRequest, NextResponse } from 'next/server';
import EncryptionService from '@/lib/encryption/encryption-service';
import { withAdmin } from '@/lib/auth/middleware';

// ============================================
// GET - 获取加密测试信息
// ============================================

async function getEncryptionTestInfo(_request: NextRequest, _userId: number) {
  return NextResponse.json({
    success: true,
    data: {
      algorithm: 'AES-256-GCM',
      features: [
        'text_encryption',
        'object_encryption',
        'password_hashing',
        'token_generation',
        'hmac_signing',
        'data_masking',
      ],
      examples: {
        maskPhone: EncryptionService.maskPhone('13800138000'),
        maskEmail: EncryptionService.maskEmail('test@example.com'),
        maskIdCard: EncryptionService.maskIdCard('110101199001011234'),
        maskBankCard: EncryptionService.maskBankCard('6222021234567890123'),
      },
    },
  });
}

// ============================================
// POST - 执行加密操作
// ============================================

async function runEncryptionTest(request: NextRequest, _userId: number) {
  try {
    const body = await request.json();
    const { action, data, password } = body;

    if (!action) {
      return NextResponse.json({
        success: false,
        error: '缺少 action 参数',
      }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'encrypt':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.encrypt(data, password);
        break;

      case 'decrypt':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.decrypt(data, password);
        break;

      case 'encryptObject':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.encryptObject(data, password);
        break;

      case 'decryptObject':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.decryptObject(data, password);
        break;

      case 'hashPassword':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.hashPassword(data);
        break;

      case 'verifyPassword':
        if (!data || !password) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 或 password 参数',
          }, { status: 400 });
        }
        result = EncryptionService.verifyPassword(data, password);
        break;

      case 'generateToken':
        const length = data || 32;
        result = EncryptionService.generateToken(length);
        break;

      case 'sign':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 参数',
          }, { status: 400 });
        }
        result = EncryptionService.sign(data, password);
        break;

      case 'verify':
        if (!data || !password) {
          return NextResponse.json({
            success: false,
            error: '缺少 data 或 password 参数（password为签名）',
          }, { status: 400 });
        }
        result = EncryptionService.verify(data, password);
        break;

      case 'maskPhone':
        result = EncryptionService.maskPhone(data);
        break;

      case 'maskEmail':
        result = EncryptionService.maskEmail(data);
        break;

      case 'maskIdCard':
        result = EncryptionService.maskIdCard(data);
        break;

      case 'maskBankCard':
        result = EncryptionService.maskBankCard(data);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `未知的操作: ${action}`,
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Encryption API] 请求失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '请求失败',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return withAdmin(request, getEncryptionTestInfo);
}

export async function POST(request: NextRequest) {
  return withAdmin(request, runEncryptionTest);
}
