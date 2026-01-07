"use client";

/**
 * 工作流容器组件
 * 根据当前工作流阶段显示相应的 UI
 */

import { useAgentState } from "@/states/agent-state";
import { WorkflowProgress } from "./WorkflowProgress";
import { OutlineStage } from "./OutlineStage";
import { SlideGenerationStage } from "./SlideGenerationStage";
import { CompletedStage } from "./CompletedStage";
import { AgentChat } from "../AgentChat";
import { SlidesPreviewDialog } from "../SlidesPreviewDialog";

interface WorkflowContainerProps {
  sessionId: string;
}

export function WorkflowContainer({ sessionId }: WorkflowContainerProps) {
  const {
    workflowStage,
    outline,
    outlineTitle,
    slides,
    currentSlideIndex,
  } = useAgentState();

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* 左侧：Agent 对话区 */}
      <div className="lg:w-1/2 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r flex flex-col">
        <div className="flex-shrink-0 border-b px-4 py-3 bg-muted/50">
          <h2 className="font-semibold text-sm">Agent Chat</h2>
          <p className="text-xs text-muted-foreground">
            Interact with Claude to create your presentation
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <AgentChat sessionId={sessionId} />
        </div>
      </div>

      {/* 右侧：工作流可视化 */}
      <div className="lg:w-1/2 h-1/2 lg:h-full flex flex-col">
        <div className="flex items-center justify-between border-b">
          <div className="flex-1">
            <WorkflowProgress stage={workflowStage} />
          </div>
          {/* Preview Button - Show when slides exist */}
          {slides.length > 0 && slides.some((s) => s.html) && (
            <div className="px-4 py-2">
              <SlidesPreviewDialog slides={slides} />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* IDLE 状态 */}
          {workflowStage === "IDLE" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground max-w-md">
                <h3 className="text-lg font-semibold mb-2">
                  Ready to Create
                </h3>
                <p className="text-sm">
                  Start by telling the Agent what kind of presentation you'd
                  like to create. For example: "Create a 10-slide presentation
                  about AI trends"
                </p>
              </div>
            </div>
          )}

          {/* 大纲生成/确认/修改阶段 */}
          {(workflowStage === "OUTLINE_GENERATION" ||
            workflowStage === "OUTLINE_CONFIRMATION" ||
            workflowStage === "OUTLINE_MODIFICATION") && (
            <OutlineStage outline={outline} title={outlineTitle} />
          )}

          {/* 幻灯片生成/确认/修改阶段 */}
          {(workflowStage === "SLIDE_GENERATION" ||
            workflowStage === "SLIDE_CONFIRMATION" ||
            workflowStage === "SLIDE_MODIFICATION") && (
            <SlideGenerationStage
              slides={slides}
              currentIndex={currentSlideIndex}
            />
          )}

          {/* 完成阶段 */}
          {workflowStage === "COMPLETED" && (
            <CompletedStage slides={slides} sessionId={sessionId} />
          )}

          {/* 错误状态 */}
          {workflowStage === "ERROR" && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <h3 className="text-lg font-semibold mb-2">Error Occurred</h3>
                <p className="text-sm">
                  Something went wrong. Please try again or restart the workflow.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
