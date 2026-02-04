/**
 * Bedrock Claude Service
 * 使用 AWS Bedrock Converse API 调用 Claude 模型
 * 支持：
 * - 图片分析生成幻灯片内容 (A)
 * - 文本内容生成 (B)
 *
 * 使用 Cross-Region Inference Profile 实现高可用性
 */

import "server-only";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type ImageFormat,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "@/env";

// 支持的图片格式
const SUPPORTED_IMAGE_FORMATS = ["jpeg", "png", "gif", "webp"] as const;
type SupportedImageFormat = (typeof SUPPORTED_IMAGE_FORMATS)[number];

// 图片分析请求
export interface ImageAnalysisRequest {
  imageData: string; // base64 encoded image data
  mimeType: string; // e.g., "image/jpeg", "image/png"
  language?: string; // 输出语言，默认中文
  slideCount?: number; // 期望的幻灯片数量
  additionalContext?: string; // 额外上下文
}

// 图片分析响应
export interface ImageAnalysisResponse {
  success: boolean;
  title?: string;
  outline?: string[];
  content?: string;
  error?: string;
}

// 内容生成请求
export interface ContentGenerationRequest {
  topic: string;
  slideCount: number;
  language?: string;
  tone?: string; // 演示风格：professional, casual, academic
  additionalContext?: string;
}

// 内容生成响应
export interface ContentGenerationResponse {
  success: boolean;
  title?: string;
  outline?: string[];
  error?: string;
}

/**
 * Bedrock Claude 服务类
 * 使用 Cross-Region Inference Profile 实现高可用性
 */
export class BedrockClaudeService {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    // 初始化 Bedrock Runtime 客户端
    // 在 ECS/EC2 环境中，SDK 会自动使用 Task Role / Instance Profile
    // 凭证获取顺序 (Default Credential Provider Chain):
    // 1. 环境变量 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Web Identity Token (IRSA for EKS)
    // 3. SSO credentials
    // 4. ~/.aws/credentials 文件中的 profile
    // 5. ECS Container Credentials (Task Role) ← 推荐用于 ECS
    // 6. EC2 Instance Metadata (Instance Profile)
    this.client = new BedrockRuntimeClient({
      region: env.AWS_REGION || "us-east-1",
      // 不显式配置 credentials，让 SDK 自动使用默认凭证链
    });

    // 使用 Global Cross-Region Inference Profile (Claude Sonnet 4.5)
    this.modelId = env.BEDROCK_MODEL_ID || "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

    console.log(`[BedrockClaudeService] Initialized with model: ${this.modelId}`);
    console.log(`[BedrockClaudeService] Region: ${env.AWS_REGION || "us-east-1"}`);
    console.log(`[BedrockClaudeService] Using default credential provider chain (ECS Task Role / EC2 Instance Profile)`);
  }

  /**
   * 分析图片并生成幻灯片大纲
   * 功能 A：图片 -> 幻灯片内容
   */
  async analyzeImageForSlides(request: ImageAnalysisRequest): Promise<ImageAnalysisResponse> {
    try {
      console.log(`[BedrockClaudeService] Analyzing image for slides`);

      // 解析图片格式
      const format = this.parseImageFormat(request.mimeType);
      if (!format) {
        return {
          success: false,
          error: `Unsupported image format: ${request.mimeType}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(", ")}`,
        };
      }

      // 构建系统提示
      const systemPrompt = this.buildImageAnalysisSystemPrompt(
        request.language || "中文",
        request.slideCount || 10
      );

      // 构建用户消息（包含图片）
      const userContent: ContentBlock[] = [
        {
          image: {
            format: format as ImageFormat,
            source: {
              bytes: Buffer.from(request.imageData, "base64"),
            },
          },
        },
        {
          text: request.additionalContext
            ? `请分析这张图片并生成演示文稿大纲。\n\n额外要求：${request.additionalContext}`
            : "请分析这张图片并生成演示文稿大纲。",
        },
      ];

      // 调用 Converse API
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: systemPrompt }],
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
          inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9,
          },
        })
      );

      // 解析响应
      const responseText = this.extractTextFromResponse(response.output?.message);

      if (!responseText) {
        return {
          success: false,
          error: "No response text from model",
        };
      }

      // 解析大纲结构
      const parsed = this.parseOutlineResponse(responseText);

      return {
        success: true,
        title: parsed.title,
        outline: parsed.outline,
        content: responseText,
      };
    } catch (error) {
      console.error(`[BedrockClaudeService] Error analyzing image:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze image",
      };
    }
  }

  /**
   * 生成演示文稿内容/大纲
   * 功能 B：主题 -> 幻灯片大纲
   */
  async generatePresentationContent(
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResponse> {
    try {
      console.log(`[BedrockClaudeService] Generating presentation content for: ${request.topic}`);

      // 构建系统提示
      const systemPrompt = this.buildContentGenerationSystemPrompt(
        request.language || "中文",
        request.tone || "professional"
      );

      // 构建用户消息
      const userPrompt = `请为以下主题创建一个 ${request.slideCount} 页的演示文稿大纲：

主题：${request.topic}

${request.additionalContext ? `额外要求：${request.additionalContext}` : ""}

请按照指定格式输出大纲。`;

      // 调用 Converse API
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: systemPrompt }],
          messages: [
            {
              role: "user",
              content: [{ text: userPrompt }],
            },
          ],
          inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9,
          },
        })
      );

      // 解析响应
      const responseText = this.extractTextFromResponse(response.output?.message);

      if (!responseText) {
        return {
          success: false,
          error: "No response text from model",
        };
      }

      // 解析大纲结构
      const parsed = this.parseOutlineResponse(responseText);

      return {
        success: true,
        title: parsed.title,
        outline: parsed.outline,
      };
    } catch (error) {
      console.error(`[BedrockClaudeService] Error generating content:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate content",
      };
    }
  }

  /**
   * 多轮对话：根据用户反馈修改内容
   */
  async refineContent(
    messages: Message[],
    userFeedback: string
  ): Promise<ContentGenerationResponse> {
    try {
      console.log(`[BedrockClaudeService] Refining content based on feedback`);

      // 添加用户反馈到对话历史
      const updatedMessages: Message[] = [
        ...messages,
        {
          role: "user",
          content: [{ text: userFeedback }],
        },
      ];

      // 调用 Converse API
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          messages: updatedMessages,
          inferenceConfig: {
            maxTokens: 4096,
            temperature: 0.7,
            topP: 0.9,
          },
        })
      );

      // 解析响应
      const responseText = this.extractTextFromResponse(response.output?.message);

      if (!responseText) {
        return {
          success: false,
          error: "No response text from model",
        };
      }

      const parsed = this.parseOutlineResponse(responseText);

      return {
        success: true,
        title: parsed.title,
        outline: parsed.outline,
      };
    } catch (error) {
      console.error(`[BedrockClaudeService] Error refining content:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to refine content",
      };
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 解析图片格式
   */
  private parseImageFormat(mimeType: string): SupportedImageFormat | null {
    const formatMap: Record<string, SupportedImageFormat> = {
      "image/jpeg": "jpeg",
      "image/jpg": "jpeg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    return formatMap[mimeType.toLowerCase()] || null;
  }

  /**
   * 从响应中提取文本内容
   */
  private extractTextFromResponse(message: Message | undefined): string | null {
    if (!message?.content) return null;

    const textBlocks = message.content.filter(
      (block): block is { text: string } => "text" in block && typeof block.text === "string"
    );

    return textBlocks.map((block) => block.text).join("\n") || null;
  }

  /**
   * 解析大纲响应
   */
  private parseOutlineResponse(text: string): { title: string; outline: string[] } {
    const lines = text.split("\n").filter((line) => line.trim());
    let title = "";
    const outline: string[] = [];

    // 尝试提取标题
    const titleMatch = text.match(/<TITLE>(.*?)<\/TITLE>/s);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    } else {
      // 查找第一个 # 标题
      const firstHeading = lines.find((line) => line.startsWith("# "));
      if (firstHeading) {
        title = firstHeading.replace(/^#\s*/, "").trim();
      }
    }

    // 提取大纲点（## 开头的行）
    for (const line of lines) {
      if (line.startsWith("## ") || line.match(/^Slide\s*\d+:/i)) {
        outline.push(line.replace(/^##\s*/, "").replace(/^Slide\s*\d+:\s*/i, "").trim());
      }
    }

    // 如果没有找到 ## 格式，尝试 # Slide N 格式
    if (outline.length === 0) {
      for (const line of lines) {
        if (line.match(/^#\s*Slide\s*\d+/i)) {
          outline.push(line.replace(/^#\s*Slide\s*\d+[:\s]*/i, "").trim());
        }
      }
    }

    return { title, outline };
  }

  /**
   * 构建图片分析系统提示
   */
  private buildImageAnalysisSystemPrompt(language: string, slideCount: number): string {
    return `你是一位专业的演示文稿设计师。你的任务是分析用户提供的图片，并基于图片内容生成一个完整的演示文稿大纲。

## 输出要求

1. **语言**：使用${language}输出
2. **幻灯片数量**：生成约 ${slideCount} 页幻灯片的大纲
3. **格式**：使用以下格式输出

<TITLE>演示文稿标题</TITLE>

## Slide 1: 引言/开场
- 要点 1
- 要点 2

## Slide 2: 主题介绍
- 要点 1
- 要点 2
- 要点 3

... (继续其他幻灯片)

## 分析指南

1. 仔细观察图片中的所有元素：文字、图表、数据、图形、照片等
2. 理解图片的主题和核心信息
3. 将信息组织成逻辑清晰的演示文稿结构
4. 每张幻灯片应聚焦一个核心观点
5. 为每张幻灯片提供 2-4 个要点

## 内容风格

- 专业且易于理解
- 每个要点简洁有力
- 适合演示场合`;
  }

  /**
   * 构建内容生成系统提示
   */
  private buildContentGenerationSystemPrompt(language: string, tone: string): string {
    const toneDescriptions: Record<string, string> = {
      professional: "专业、正式、商务风格",
      casual: "轻松、友好、易于理解",
      academic: "学术、严谨、引用丰富",
    };

    return `你是一位专业的演示文稿设计师。你的任务是根据用户提供的主题，生成一个完整的演示文稿大纲。

## 输出要求

1. **语言**：使用${language}输出
2. **风格**：${toneDescriptions[tone] || toneDescriptions.professional}
3. **格式**：使用以下格式输出

<TITLE>演示文稿标题</TITLE>

## Slide 1: 引言/开场
- 要点 1
- 要点 2

## Slide 2: 主题介绍
- 要点 1
- 要点 2
- 要点 3

... (继续其他幻灯片)

## 结构指南

1. 开场：引入主题，吸引注意
2. 主体：核心内容，逻辑递进
3. 结尾：总结要点，行动号召

## 内容要求

- 每张幻灯片聚焦一个核心观点
- 每个要点简洁有力（不超过 15 个字）
- 整体结构逻辑清晰
- 适合演示场合`;
  }
}

// 导出单例实例
let bedrockClaudeServiceInstance: BedrockClaudeService | null = null;

export function getBedrockClaudeService(): BedrockClaudeService {
  if (!bedrockClaudeServiceInstance) {
    bedrockClaudeServiceInstance = new BedrockClaudeService();
  }
  return bedrockClaudeServiceInstance;
}
