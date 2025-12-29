"use client";

/**
 * 幻灯片生成阶段组件
 * 显示当前正在生成/确认的幻灯片
 */

import type { SlideData } from "@/lib/agent/types/workflow";
import { SlideHTMLRenderer } from "../slides/SlideHTMLRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock } from "lucide-react";

interface SlideGenerationStageProps {
  slides: SlideData[];
  currentIndex?: number;
}

export function SlideGenerationStage({
  slides,
  currentIndex = 0,
}: SlideGenerationStageProps) {
  const currentSlide = slides[currentIndex];
  const totalSlides = slides.length;

  if (!currentSlide) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin" />
          <p className="text-lg">Preparing slides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 进度信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Current Progress</span>
            <Badge variant="outline">
              Slide {currentIndex + 1} of {totalSlides}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  slide.status === "ready"
                    ? "bg-green-500"
                    : slide.status === "generating"
                      ? "bg-blue-500 animate-pulse"
                      : slide.status === "error"
                        ? "bg-red-500"
                        : "bg-muted"
                }`}
                title={`Slide ${index + 1}: ${slide.status}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 当前幻灯片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentSlide.status === "generating" && (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            )}
            {currentSlide.status === "ready" && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            {currentSlide.status === "pending" && (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            Slide {currentIndex + 1}: {extractTitle(currentSlide.outlineContent || "")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 大纲内容 */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Outline Content:</h4>
            <div className="text-sm whitespace-pre-wrap text-muted-foreground">
              {currentSlide.outlineContent}
            </div>
          </div>

          {/* 幻灯片预览 */}
          {currentSlide.html && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Preview:</h4>
              <SlideHTMLRenderer
                html={currentSlide.html}
                slideId={currentSlide.id}
              />
            </div>
          )}

          {/* 状态信息 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {currentSlide.generatedAt && (
              <span>
                Generated: {new Date(currentSlide.generatedAt).toLocaleTimeString()}
              </span>
            )}
            {currentSlide.modificationCount > 0 && (
              <span>Modifications: {currentSlide.modificationCount}</span>
            )}
            {currentSlide.infographicDSL && (
              <Badge variant="secondary">Includes Infographic</Badge>
            )}
            {currentSlide.imageUrl && (
              <Badge variant="secondary">Includes Image</Badge>
            )}
          </div>

          {/* 操作提示 */}
          {currentSlide.status === "ready" && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>Next step:</strong> Tell the Agent if this slide is
                acceptable, or ask for modifications.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 缩略图列表 */}
      {slides.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">All Slides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`relative border-2 rounded transition-colors ${
                    index === currentIndex
                      ? "border-primary"
                      : slide.status === "ready"
                        ? "border-green-500"
                        : "border-muted"
                  }`}
                >
                  <div className="aspect-video bg-muted flex items-center justify-center text-xs">
                    {slide.status === "ready" ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : slide.status === "generating" ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 text-center py-1">
                    <span className="text-xs font-medium">{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1] || "Untitled";
}
