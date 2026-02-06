"use client";

/**
 * 导出工具栏组件
 * 在聊天界面中显示导出按钮（当检测到完成的幻灯片时）
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileImage, FileText, Presentation, CheckCircle2, LayoutGrid } from "lucide-react";
import { useState, useMemo } from "react";
import { ExportDialog } from "./export/ExportDialog";
import { SlidesPreviewDialog } from "./SlidesPreviewDialog";
import type { SlideData } from "@/lib/agent/types/workflow";
import { useAgentState } from "@/states/agent-state";

interface ExportToolbarProps {
  slides: SlideData[];
  sessionId: string;
}

export function ExportToolbar({ slides, sessionId }: ExportToolbarProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { currentSessionTitle } = useAgentState();

  if (slides.length === 0) {
    return null;
  }

  const readySlides = slides.filter((s) => (s.html || s.imageUrl) && s.status === "ready");

  // 生成文件名：优先使用会话标题，否则使用第一张幻灯片标题或默认名
  const presentationTitle = useMemo(() => {
    // 1. 优先使用会话标题
    if (currentSessionTitle && currentSessionTitle !== "New Agent Session") {
      return currentSessionTitle;
    }

    // 2. 尝试从第一张幻灯片的outline提取标题
    const firstSlide = slides[0];
    if (firstSlide?.outlineContent) {
      // 提取第一行或前30个字符作为标题
      const firstLine = firstSlide.outlineContent.split("\n")[0]?.trim();
      if (firstLine) {
        const cleanTitle = firstLine.replace(/^[#\-*\s]+/, "").trim();
        if (cleanTitle.length > 0) {
          return cleanTitle.substring(0, 50); // 限制长度
        }
      }
    }

    // 3. 默认使用sessionId
    return `Presentation-${sessionId.slice(0, 8)}`;
  }, [currentSessionTitle, slides, sessionId]);

  return (
    <>
      <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-semibold text-sm">
                  Presentation Ready!
                </h3>
                <p className="text-xs text-muted-foreground">
                  {readySlides.length} of {slides.length} slides completed
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <SlidesPreviewDialog
                slides={slides}
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Preview
                  </Button>
                }
              />
              <Button
                onClick={() => setExportDialogOpen(true)}
                className="gap-2"
                size="sm"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Quick Export Options */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <FileImage className="h-3 w-3" />
              PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Presentation className="h-3 w-3" />
              PPTX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <FileText className="h-3 w-3" />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        slides={slides}
        title={presentationTitle}
      />
    </>
  );
}
