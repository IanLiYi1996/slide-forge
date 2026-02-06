/**
 * Workflow 类型定义
 * 定义 Agent 工作流的所有状态、数据结构和工具返回类型
 */

/**
 * 工作流阶段枚举
 */
export enum WorkflowStage {
  IDLE = "IDLE",
  OUTLINE_GENERATION = "OUTLINE_GENERATION",
  OUTLINE_CONFIRMATION = "OUTLINE_CONFIRMATION",
  OUTLINE_MODIFICATION = "OUTLINE_MODIFICATION",
  SLIDE_GENERATION = "SLIDE_GENERATION",
  SLIDE_CONFIRMATION = "SLIDE_CONFIRMATION",
  SLIDE_MODIFICATION = "SLIDE_MODIFICATION",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

/**
 * 幻灯片数据结构
 */
export interface SlideData {
  id: string;
  index: number;
  outlineContent: string;
  html?: string;
  status: "pending" | "generating" | "ready" | "error";
  infographicDSL?: string;
  imageUrl?: string;
  slideType?: "html" | "image";
  imageQuery?: string;
  imageAuthor?: string;
  imageAuthorUrl?: string;
  modificationCount: number;
  generatedAt?: Date;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
}

/**
 * 完整的工作流状态
 */
export interface WorkflowState {
  stage: WorkflowStage;
  outline: string[];
  outlineTitle: string | null;
  slides: SlideData[];
  currentSlideIndex: number;
  totalSlides: number;
  config: {
    enableInfographic: boolean;
    enableUnsplash: boolean;
    theme: string;
    language: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  lastModifiedAt?: Date;
}

/**
 * 工具调用返回结果的统一格式
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 大纲生成工具参数
 */
export interface GenerateOutlineParams {
  sessionId: string;
  userId: string;
  topic: string;
  numberOfSlides: number;
  language: string;
  useWebSearch?: boolean;
  additionalContext?: string;
}

/**
 * 大纲确认工具参数
 */
export interface ConfirmOutlineParams {
  sessionId: string;
  userId: string;
  confirmed: boolean;
  modifications?: string;
}

/**
 * 生成幻灯片 HTML 工具参数
 */
export interface GenerateSlideHTMLParams {
  sessionId: string;
  userId: string;
  slideIndex: number;
  outlineContent: string;
  includeInfographic: boolean;
  includeImage: boolean;
  theme?: string;
}

/**
 * 确认幻灯片工具参数
 */
export interface ConfirmSlideParams {
  sessionId: string;
  userId: string;
  slideIndex: number;
  confirmed: boolean;
  modifications?: string;
  action?: "next" | "regenerate" | "modify";
}

/**
 * 生成 Infographic DSL 工具参数
 */
export interface GenerateInfographicDSLParams {
  content: string;
  chartType?: string; // 'auto' 或指定模板名
}

/**
 * 搜索 Unsplash 图片工具参数
 */
export interface SearchUnsplashImageParams {
  query: string;
  orientation?: "landscape" | "portrait" | "squarish";
}

/**
 * 获取工作流状态工具参数
 */
export interface GetWorkflowStateParams {
  sessionId: string;
  userId: string;
}

/**
 * Infographic DSL 生成结果
 */
export interface InfographicDSLResult {
  dsl: string;
  template: string;
}

/**
 * Unsplash 图片搜索结果
 */
export interface UnsplashImageResult {
  imageUrl: string;
  imageId: string;
  author: string;
  authorUrl: string;
}

/**
 * 大纲生成结果
 */
export interface OutlineGenerationResult {
  outline: string[];
  title: string;
  metadata?: {
    searchResults?: any[];
    generatedAt: Date;
  };
}

/**
 * 幻灯片 HTML 生成结果
 */
export interface SlideHTMLGenerationResult {
  html: string;
  slideId: string;
  preview: string;
  usedInfographic: boolean;
  usedImage: boolean;
}

/**
 * 修改历史记录项
 */
export interface ModificationHistoryItem {
  timestamp: Date;
  stage: WorkflowStage;
  itemIndex?: number; // 用于 outline 或 slide index
  oldValue: string;
  newValue: string;
  userFeedback?: string;
}
