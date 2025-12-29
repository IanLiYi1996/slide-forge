/**
 * 大纲确认工具
 * 处理用户对大纲的确认或修改请求
 */

import { sessionManager } from "../session-manager";
import type {
  ConfirmOutlineParams,
  ToolResult,
  WorkflowState,
  ModificationHistoryItem,
} from "../types/workflow";
import { WorkflowStage } from "../types/workflow";

export async function confirmOutline(
  params: ConfirmOutlineParams,
): Promise<ToolResult<{ nextStage: string; message: string }>> {
  try {
    const { sessionId, userId, confirmed, modifications } = params;

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

    // 如果确认，进入幻灯片生成阶段
    if (confirmed) {
      workflowState.stage = WorkflowStage.SLIDE_GENERATION;

      // 初始化幻灯片数组
      workflowState.slides = workflowState.outline.map((content, index) => ({
        id: `slide-${index}`,
        index,
        outlineContent: content,
        status: "pending" as const,
        modificationCount: 0,
        conversationHistory: [],
      }));

      await sessionManager.updateSession(sessionId, userId, {
        workflowStage: WorkflowStage.SLIDE_GENERATION,
        workflowState: workflowState as any,
        slides: workflowState.slides as any,
      });

      return {
        success: true,
        data: {
          nextStage: WorkflowStage.SLIDE_GENERATION,
          message: "Outline confirmed. Ready to generate slides.",
        },
        message: "Moving to slide generation stage",
      };
    }

    // 如果需要修改，进入修改阶段
    if (modifications) {
      workflowState.stage = WorkflowStage.OUTLINE_MODIFICATION;

      // 记录修改历史
      const modificationHistory =
        (session.modificationHistory as unknown as ModificationHistoryItem[]) || [];
      modificationHistory.push({
        timestamp: new Date(),
        stage: WorkflowStage.OUTLINE_CONFIRMATION,
        oldValue: JSON.stringify(workflowState.outline),
        newValue: "Pending user modifications",
        userFeedback: modifications,
      });

      await sessionManager.updateSession(sessionId, userId, {
        workflowStage: WorkflowStage.OUTLINE_MODIFICATION,
        workflowState: workflowState as any,
        modificationHistory: modificationHistory as any,
      });

      return {
        success: true,
        data: {
          nextStage: WorkflowStage.OUTLINE_MODIFICATION,
          message: "Please regenerate outline based on feedback.",
        },
        message: "Outline needs modifications",
      };
    }

    return {
      success: false,
      error: "No action specified (neither confirmed nor modifications provided)",
    };
  } catch (error) {
    console.error("Error confirming outline:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to confirm outline",
    };
  }
}
