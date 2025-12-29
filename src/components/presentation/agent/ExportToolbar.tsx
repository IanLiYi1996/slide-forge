"use client";

/**
 * 导出工具栏组件
 * 在聊天界面中显示导出按钮（当检测到完成的幻灯片时）
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileImage, FileText, Presentation, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { ExportDialog } from "./export/ExportDialog";
import type { SlideData } from "@/lib/agent/types/workflow";

interface ExportToolbarProps {
  slides: SlideData[];
  sessionId: string;
}

export function ExportToolbar({ slides, sessionId }: ExportToolbarProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  if (slides.length === 0) {
    return null;
  }

  const readySlides = slides.filter((s) => s.html && s.status === "ready");

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

            <Button
              onClick={() => setExportDialogOpen(true)}
              className="gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Export Presentation
            </Button>
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
        title={`Transformer-Presentation-${sessionId.slice(0, 8)}`}
      />
    </>
  );
}
