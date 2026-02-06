import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    // S3 Storage
    UPLOADS_BUCKET: z.string().optional(),

    // OpenAI Compatible LLM Configuration
    LLM_API_KEY: z.string().optional(),
    LLM_BASE_URL: z.string().optional(),
    LLM_MODEL_NAME: z.string().default("gpt-4o-mini"),

    // Image Generation APIs
    YUNWU_API_KEY: z.string().optional(),
    DASHSCOPE_API_KEY: z.string().optional(),

    // Bedrock Claude Configuration
    BEDROCK_MODEL_ID: z.string().default("global.anthropic.claude-sonnet-4-5-20250929-v1:0"),
    CLAUDE_CODE_USE_BEDROCK: z.string().default("0"),
    ENABLE_CLAUDE_AGENT: z.string().default("false"),
    AGENT_SESSION_TIMEOUT: z.string().default("3600000"),

    // AWS Configuration
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default("us-east-1"),
    AWS_PROFILE: z.string().optional(),

    // Cognito Authentication
    COGNITO_CLIENT_ID: z.string(),
    COGNITO_CLIENT_SECRET: z.string(),
    COGNITO_ISSUER: z.string(),

    // AgentCore Runtime
    AGENTCORE_RUNTIME_URL: z.string().optional(),

    // Optional Services
    TAVILY_API_KEY: z.string().optional(),
    UNSPLASH_ACCESS_KEY: z.string().optional(),

    // NextAuth
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
    NODE_ENV: process.env.NODE_ENV,
    UPLOADS_BUCKET: process.env.UPLOADS_BUCKET,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL_NAME: process.env.LLM_MODEL_NAME,
    YUNWU_API_KEY: process.env.YUNWU_API_KEY,
    DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    CLAUDE_CODE_USE_BEDROCK: process.env.CLAUDE_CODE_USE_BEDROCK,
    ENABLE_CLAUDE_AGENT: process.env.ENABLE_CLAUDE_AGENT,
    AGENT_SESSION_TIMEOUT: process.env.AGENT_SESSION_TIMEOUT,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_PROFILE: process.env.AWS_PROFILE,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET,
    COGNITO_ISSUER: process.env.COGNITO_ISSUER,
    AGENTCORE_RUNTIME_URL: process.env.AGENTCORE_RUNTIME_URL,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
