"use client";

/**
 * 完成阶段组件
 * 显示所有完成的幻灯片，提供导出选项
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SlideData } from "@/lib/agent/types/workflow";
import { Download, CheckCircle2, LayoutGrid } from "lucide-react";
import { SlideHTMLRenderer } from "../slides/SlideHTMLRenderer";
import { ExportDialog } from "../export/ExportDialog";
import { SlidesPreviewDialog } from "../SlidesPreviewDialog";
import { useState } from "react";

interface CompletedStageProps {
  slides: SlideData[];
  sessionId: string;
}

export function CompletedStage({ slides, sessionId }: CompletedStageProps) {
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No slides available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 成功消息 */}
      <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <h3 className="font-semibold text-lg">
                Presentation Complete!
              </h3>
              <p className="text-sm text-muted-foreground">
                All {slides.length} slides have been generated successfully.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 导出和预览选项 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <SlidesPreviewDialog
            slides={slides}
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Preview All Slides
              </Button>
            }
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Presentation
          </Button>
          <p className="text-xs text-muted-foreground w-full mt-2">
            Preview all slides or export to PNG, PPTX, or PDF formats
          </p>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        slides={slides}
        title={`Presentation-${sessionId.slice(0, 8)}`}
      />

      {/* 幻灯片预览 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Preview Slides</span>
            <span className="text-muted-foreground font-normal">
              {selectedSlide + 1} / {slides.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前幻灯片 */}
          <SlideHTMLRenderer
            html={slides[selectedSlide]?.html || ""}
            slideId={slides[selectedSlide]?.id || ""}
          />

          {/* 缩略图导航 */}
          <div className="grid grid-cols-5 gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => setSelectedSlide(index)}
                className={`relative aspect-video rounded border-2 transition-all hover:border-primary ${
                  index === selectedSlide
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-muted"
                }`}
              >
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">{index + 1}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
