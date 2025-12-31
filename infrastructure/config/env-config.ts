/**
 * 环境变量配置
 * 从本地 .env 文件或环境变量中读取，并传递到 ECS 容器
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 尝试加载 infrastructure/.env 文件
const infraEnvPath = path.join(__dirname, '../.env');
const frontendEnvPath = path.join(__dirname, '../../frontend/.env');

if (fs.existsSync(infraEnvPath)) {
  console.log('✓ Loading environment variables from infrastructure/.env');
  dotenv.config({ path: infraEnvPath });
} else if (fs.existsSync(frontendEnvPath)) {
  console.log('✓ Loading environment variables from frontend/.env');
  dotenv.config({ path: frontendEnvPath });
} else {
  console.log('⚠ No .env file found, using system environment variables');
}

/**
 * 环境变量配置接口
 */
export interface EnvConfig {
  // Claude Agent SDK 配置
  claudeConfig: {
    useBedrock: boolean;
    anthropicApiKey?: string;
  };

  // AWS 配置
  aws: {
    region: string;
    profile?: string;
  };

  // Cognito 认证配置
  cognito: {
    adminEmail: string;
  };

  // 可选的第三方服务 API Keys
  thirdParty: {
    llmApiKey?: string;
    llmBaseUrl?: string;
    llmModelName?: string;
    yunwuApiKey?: string;
    dashscopeApiKey?: string;
    uploadthingToken?: string;
    tavilyApiKey?: string;
    unsplashAccessKey?: string;
  };
}

/**
 * 从环境变量读取配置
 */
export function getEnvConfig(): EnvConfig {
  return {
    claudeConfig: {
      useBedrock: process.env.CLAUDE_CODE_USE_BEDROCK === '1',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },
    aws: {
      region: process.env.AWS_REGION || 'us-east-1',
      profile: process.env.AWS_PROFILE,
    },
    cognito: {
      adminEmail: process.env.COGNITO_ADMIN_EMAIL || '',
    },
    thirdParty: {
      llmApiKey: process.env.LLM_API_KEY,
      llmBaseUrl: process.env.LLM_BASE_URL,
      llmModelName: process.env.LLM_MODEL_NAME,
      yunwuApiKey: process.env.YUNWU_API_KEY,
      dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
      uploadthingToken: process.env.UPLOADTHING_TOKEN,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
    },
  };
}

/**
 * 验证必需的环境变量
 */
export function validateEnvConfig(config: EnvConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证 Claude Agent SDK 配置
  if (config.claudeConfig.useBedrock) {
    console.log('✓ Using AWS Bedrock for Claude Agent SDK');
  } else if (config.claudeConfig.anthropicApiKey) {
    console.log('✓ Using Anthropic API Key for Claude Agent SDK');
  } else {
    errors.push(
      'Claude Agent SDK 配置缺失: 需要设置 CLAUDE_CODE_USE_BEDROCK=1 或 ANTHROPIC_API_KEY'
    );
  }

  // AWS Region 必需
  if (!config.aws.region) {
    errors.push('AWS_REGION 必需');
  }

  // 验证 Cognito 管理员邮箱
  if (!config.cognito.adminEmail) {
    errors.push('COGNITO_ADMIN_EMAIL 必需 - 用于创建初始管理员用户');
  } else {
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.cognito.adminEmail)) {
      errors.push(`COGNITO_ADMIN_EMAIL 格式无效: ${config.cognito.adminEmail}`);
    } else {
      console.log('✓ Admin email configured:', config.cognito.adminEmail);
    }
  }

  // 警告可选配置
  if (!config.thirdParty.uploadthingToken) {
    console.log('⚠ UPLOADTHING_TOKEN 未设置 - 文件上传功能将不可用');
  }
  if (!config.thirdParty.tavilyApiKey) {
    console.log('⚠ TAVILY_API_KEY 未设置 - 网络搜索功能将不可用');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 打印环境变量状态（隐藏敏感信息）
 */
export function printEnvStatus(config: EnvConfig): void {
  console.log('\n=== 环境变量配置状态 ===');
  console.log(`AWS Region: ${config.aws.region}`);
  console.log(`AWS Profile: ${config.aws.profile || '(未设置，使用默认)'}`);
  console.log(`Use Bedrock: ${config.claudeConfig.useBedrock ? '是' : '否'}`);
  console.log(
    `Anthropic API Key: ${config.claudeConfig.anthropicApiKey ? '✓ 已设置' : '未设置'}`
  );

  // Cognito 配置
  if (config.cognito.adminEmail) {
    // 隐藏部分邮箱地址
    const [localPart, domain] = config.cognito.adminEmail.split('@');
    const maskedLocal = localPart.length > 3
      ? localPart.substring(0, 3) + '***'
      : '***';
    console.log(`Admin Email: ${maskedLocal}@${domain}`);
  } else {
    console.log('Admin Email: 未设置');
  }

  console.log(`LLM API Key: ${config.thirdParty.llmApiKey ? '✓ 已设置' : '未设置'}`);
  console.log(`Tavily API Key: ${config.thirdParty.tavilyApiKey ? '✓ 已设置' : '未设置'}`);
  console.log(
    `UploadThing Token: ${config.thirdParty.uploadthingToken ? '✓ 已设置' : '未设置'}`
  );
  console.log('========================\n');
}
