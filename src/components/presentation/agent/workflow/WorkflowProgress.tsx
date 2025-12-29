"use client";

/**
 * 工作流进度指示器
 * 显示当前所处的工作流阶段
 */

import type { WorkflowStage } from "@/lib/agent/types/workflow";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface WorkflowProgressProps {
  stage: WorkflowStage;
}

const STAGE_LABELS: Record<WorkflowStage, string> = {
  IDLE: "待开始",
  OUTLINE_GENERATION: "生成大纲",
  OUTLINE_CONFIRMATION: "确认大纲",
  OUTLINE_MODIFICATION: "修改大纲",
  SLIDE_GENERATION: "生成幻灯片",
  SLIDE_CONFIRMATION: "确认幻灯片",
  SLIDE_MODIFICATION: "修改幻灯片",
  COMPLETED: "已完成",
  ERROR: "错误",
};

const STAGE_ORDER = [
  "IDLE",
  "OUTLINE_GENERATION",
  "OUTLINE_CONFIRMATION",
  "SLIDE_GENERATION",
  "SLIDE_CONFIRMATION",
  "COMPLETED",
];

export function WorkflowProgress({ stage }: WorkflowProgressProps) {
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="bg-card border-b px-6 py-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          {STAGE_ORDER.map((stageKey, index) => {
            const stageValue = stageKey as WorkflowStage;
            const label = STAGE_LABELS[stageValue];
            const isActive = stageValue === stage;
            const isCompleted = index < currentIndex;
            const isUpcoming = index > currentIndex;

            return (
              <div key={stageKey} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-2 font-medium ${
                      isActive
                        ? "text-primary"
                        : isCompleted
                          ? "text-green-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </p>
                </div>

                {index < STAGE_ORDER.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      isCompleted ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
