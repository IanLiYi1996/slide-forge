/**
 * 获取工作流状态工具
 * 返回当前会话的工作流状态信息
 */

import { sessionManager } from "../session-manager";
import type {
  GetWorkflowStateParams,
  ToolResult,
  WorkflowState,
} from "../types/workflow";

export async function getWorkflowState(
  params: GetWorkflowStateParams,
): Promise<ToolResult<WorkflowState>> {
  try {
    const { sessionId, userId } = params;

    // 从数据库获取会话
    const session = await sessionManager.getSession(sessionId, userId);

    if (!session) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    // 返回工作流状态
    const workflowState = session.workflowState as WorkflowState | null;

    if (!workflowState) {
      // 如果没有工作流状态，返回初始状态
      return {
        success: true,
        data: {
          stage: "IDLE",
          outline: [],
          outlineTitle: null,
          slides: [],
          currentSlideIndex: 0,
          totalSlides: 0,
          config: {
            enableInfographic: true,
            enableUnsplash: true,
            theme: "default",
            language: "en-US",
          },
        } as WorkflowState,
      };
    }

    return {
      success: true,
      data: workflowState,
      message: `Current stage: ${workflowState.stage}`,
    };
  } catch (error) {
    console.error("Error getting workflow state:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get workflow state",
    };
  }
}
