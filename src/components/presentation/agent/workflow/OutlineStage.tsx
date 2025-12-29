"use client";

/**
 * 大纲阶段组件
 * 显示生成的大纲，等待用户确认
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ListOrdered } from "lucide-react";

interface OutlineStageProps {
  outline: string[];
  title?: string | null;
}

export function OutlineStage({ outline, title }: OutlineStageProps) {
  if (outline.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Waiting for outline...</p>
          <p className="text-sm mt-2">
            The Agent is generating the presentation outline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            {title || "Presentation Outline"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Review the outline below. You can ask the Agent to make changes or
            confirm to proceed with slide generation.
          </p>

          <div className="space-y-4">
            {outline.map((item, index) => {
              // 解析标题和内容
              const lines = item.split("\n");
              const titleLine = lines[0]?.replace(/^#\s*/, "") || `Slide ${index + 1}`;
              const bulletPoints = lines.slice(1).filter((line) => line.trim().startsWith("-"));

              return (
                <Card key={index} className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      {titleLine}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {bulletPoints.length > 0 ? (
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {bulletPoints.map((point, pointIndex) => (
                          <li key={pointIndex} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{point.replace(/^-\s*/, "")}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No details yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Next step:</strong> Tell the Agent if this outline looks good, or ask for specific changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
