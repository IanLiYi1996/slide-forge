/**
 * 幻灯片确认工具
 * 处理用户对当前幻灯片的确认或修改请求
 */

import { sessionManager } from "../session-manager";
import type {
  ConfirmSlideParams,
  ToolResult,
  WorkflowState,
  ModificationHistoryItem,
} from "../types/workflow";
import { WorkflowStage } from "../types/workflow";

export async function confirmSlide(
  params: ConfirmSlideParams,
): Promise<
  ToolResult<{ nextSlideIndex?: number; isComplete: boolean; message: string }>
> {
  try {
    const {
      sessionId,
      userId,
      slideIndex,
      confirmed,
      modifications,
      action = "next",
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

    const currentSlide = workflowState.slides[slideIndex];
    if (!currentSlide) {
      return {
        success: false,
        error: `Slide ${slideIndex} not found`,
      };
    }

    // 如果确认当前幻灯片
    if (confirmed) {
      const nextIndex = slideIndex + 1;
      const isLastSlide = nextIndex >= workflowState.totalSlides;

      if (isLastSlide) {
        // 所有幻灯片已完成
        workflowState.stage = WorkflowStage.COMPLETED;
        workflowState.completedAt = new Date();

        await sessionManager.updateSession(sessionId, userId, {
          workflowStage: WorkflowStage.COMPLETED,
          workflowState: workflowState as any,
        });

        return {
          success: true,
          data: {
            isComplete: true,
            message: "All slides completed! Ready to export.",
          },
          message: "Presentation completed",
        };
      } else {
        // 继续下一张幻灯片
        workflowState.stage = WorkflowStage.SLIDE_GENERATION;
        workflowState.currentSlideIndex = nextIndex;

        await sessionManager.updateSession(sessionId, userId, {
          workflowStage: WorkflowStage.SLIDE_GENERATION,
          workflowState: workflowState as any,
          currentSlideIndex: nextIndex,
        });

        return {
          success: true,
          data: {
            nextSlideIndex: nextIndex,
            isComplete: false,
            message: `Slide ${slideIndex + 1} confirmed. Ready for slide ${nextIndex + 1}.`,
          },
          message: `Moving to slide ${nextIndex + 1}`,
        };
      }
    }

    // 如果需要修改
    if (modifications) {
      workflowState.stage = WorkflowStage.SLIDE_MODIFICATION;

      // 更新幻灯片状态
      currentSlide.modificationCount += 1;
      currentSlide.conversationHistory.push({
        role: "user",
        content: modifications,
        timestamp: new Date(),
      });

      // 记录修改历史
      const modificationHistory =
        (session.modificationHistory as unknown as ModificationHistoryItem[]) || [];
      modificationHistory.push({
        timestamp: new Date(),
        stage: WorkflowStage.SLIDE_CONFIRMATION,
        itemIndex: slideIndex,
        oldValue: currentSlide.html || "",
        newValue: "Pending regeneration",
        userFeedback: modifications,
      });

      await sessionManager.updateSession(sessionId, userId, {
        workflowStage: WorkflowStage.SLIDE_MODIFICATION,
        workflowState: workflowState as any,
        slides: workflowState.slides as any,
        modificationHistory: modificationHistory as any,
      });

      return {
        success: true,
        data: {
          nextSlideIndex: slideIndex,
          isComplete: false,
          message: "Please regenerate this slide with modifications.",
        },
        message: "Slide needs modifications",
      };
    }

    return {
      success: false,
      error: "No action specified",
    };
  } catch (error) {
    console.error("Error confirming slide:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to confirm slide",
    };
  }
}
