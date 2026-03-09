import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().optional(),
    TAVILY_API_KEY: z.string(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // OpenAI Compatible LLM Configuration
    LLM_API_KEY: z.string(),
    LLM_BASE_URL: z.string().optional(), // Optional: defaults to OpenAI if not set
    LLM_MODEL_NAME: z.string().default("gpt-4o-mini"),
    // Image Generation APIs
    YUNWU_API_KEY: z.string(),
    DASHSCOPE_API_KEY: z.string().optional(), // 🆕 新增：z-image-turbo API key (可选)
    // Bedrock Claude 配置 (用于图片分析和内容生成)
    BEDROCK_MODEL_ID: z.string().default("global.anthropic.claude-sonnet-4-5-20250929-v1:0"), // Global cross-region inference profile
    // Claude Agent SDK - Amazon Bedrock 配置
    CLAUDE_CODE_USE_BEDROCK: z.string().default("0"),
    ENABLE_CLAUDE_AGENT: z.string().default("false"),
    AGENT_SESSION_TIMEOUT: z.string().default("3600000"),
    // AWS 凭证配置（可选，取决于认证方式）
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_PROFILE: z.string().optional(),
    COGNITO_CLIENT_ID: z.string(),
    COGNITO_CLIENT_SECRET: z.string(),
    COGNITO_ISSUER: z.string(),
    UNSPLASH_ACCESS_KEY: z.string().optional(), // Optional: not used anymore
    NEXTAUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL ? z.string() : z.string().url(),
    ),
    NEXTAUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET,
    COGNITO_ISSUER: process.env.COGNITO_ISSUER,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL_NAME: process.env.LLM_MODEL_NAME,
    YUNWU_API_KEY: process.env.YUNWU_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY, // 🆕 新增
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
    ENABLE_CLAUDE_AGENT: process.env.ENABLE_CLAUDE_AGENT,
    AGENT_SESSION_TIMEOUT: process.env.AGENT_SESSION_TIMEOUT,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_PROFILE: process.env.AWS_PROFILE,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
