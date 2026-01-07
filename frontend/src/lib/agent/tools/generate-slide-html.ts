/**
 * 生成幻灯片 HTML 工具
 * 根据大纲内容生成完整的 HTML 页面，支持 Infographic 和 Unsplash 集成
 */

import { sessionManager } from "../session-manager";
import type {
  GenerateSlideHTMLParams,
  ToolResult,
  SlideHTMLGenerationResult,
  WorkflowState,
} from "../types/workflow";
import { WorkflowStage } from "../types/workflow";
import { generateInfographicDSL } from "./use-infographic";
import { searchUnsplashImage } from "./search-unsplash-image";
import {
  generateCompleteHTML,
  extractTitle,
  extractDesc,
} from "./utils/html-templates";

export async function generateSlideHTML(
  params: GenerateSlideHTMLParams,
): Promise<ToolResult<SlideHTMLGenerationResult>> {
  try {
    const {
      sessionId,
      userId,
      slideIndex,
      outlineContent,
      includeInfographic,
      includeImage,
      theme = "default",
    } = params;

    // 获取会话
    const session = await sessionManager.getSession(sessionId, userId);
    if (!session) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    const workflowState = session.workflowState as unknown as WorkflowState;
    if (!workflowState) {
      return {
        success: false,
        error: "Workflow state not initialized",
      };
    }

    // 从大纲内容提取信息
    const slideTitle = extractTitle(outlineContent);
    const slideContent = outlineContent.replace(/^#\s+.+$/m, "").trim();

    let infographicDSL: string | undefined;
    let usedInfographic = false;

    // 1. 生成 Infographic (如果需要)
    if (includeInfographic) {
      const dslResult = await generateInfographicDSL({
        content: outlineContent,
        chartType: "auto",
      });

      if (dslResult.success && dslResult.data) {
        infographicDSL = dslResult.data.dsl;
        usedInfographic = true;
      }
    }

    let imageUrl: string | undefined;
    let imageAuthor: string | undefined;
    let imageAuthorUrl: string | undefined;
    let usedImage = false;

    // 2. 获取配图 (如果需要)
    if (includeImage) {
      // 生成图片搜索关键词
      const imageQuery = extractImageQuery(slideTitle, slideContent);

      const imageResult = await searchUnsplashImage({
        query: imageQuery,
        orientation: "landscape",
      });

      if (imageResult.success && imageResult.data) {
        imageUrl = imageResult.data.imageUrl;
        imageAuthor = imageResult.data.author;
        imageAuthorUrl = imageResult.data.authorUrl;
        usedImage = true;
      }
    }

    // 3. 生成完整 HTML
    const html = generateCompleteHTML({
      title: slideTitle,
      content: slideContent,
      infographicDSL,
      imageUrl,
      imageAuthor,
      imageAuthorUrl,
      theme,
      slideNumber: slideIndex + 1,
      totalSlides: workflowState.totalSlides,
    });

    // 4. 更新工作流状态
    if (!workflowState.slides[slideIndex]) {
      return {
        success: false,
        error: `Slide ${slideIndex} not found in workflow state`,
      };
    }

    workflowState.slides[slideIndex] = {
      ...workflowState.slides[slideIndex],
      html,
      status: "ready",
      infographicDSL,
      imageUrl,
      generatedAt: new Date(),
    };

    workflowState.stage = WorkflowStage.SLIDE_CONFIRMATION;
    workflowState.currentSlideIndex = slideIndex;

    // 5. 保存到数据库
    await sessionManager.updateSession(sessionId, userId, {
      workflowStage: WorkflowStage.SLIDE_CONFIRMATION,
      workflowState: workflowState as any,
      slides: workflowState.slides as any,
      currentSlideIndex: slideIndex,
    });

    return {
      success: true,
      data: {
        html,
        slideId: `slide-${slideIndex}`,
        preview: slideTitle,
        usedInfographic,
        usedImage,
      },
      message: `Generated slide ${slideIndex + 1}/${workflowState.totalSlides}`,
    };
  } catch (error) {
    console.error("Error generating slide HTML:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate slide HTML",
    };
  }
}

/**
 * 从标题和内容中提取图片搜索关键词
 */
function extractImageQuery(title: string, content: string): string {
  // 优先使用标题
  if (title && title !== "Untitled") {
    return title;
  }

  // 提取内容中的关键词
  const words = content
    .replace(/[^\w\s\u4e00-\u9fa5]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  return words.join(" ") || "professional presentation";
}
