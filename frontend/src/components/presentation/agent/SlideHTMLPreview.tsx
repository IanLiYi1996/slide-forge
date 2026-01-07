"use client";

/**
 * 幻灯片 HTML 预览组件
 * 从 Agent 消息中提取 HTML 并渲染
 */

import { SlideHTMLRenderer } from "./slides/SlideHTMLRenderer";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Maximize2, Download, X } from "lucide-react";

interface SlideHTMLPreviewProps {
  content: string;
  slideNumber?: number;
}

/**
 * 从 markdown 内容中提取 HTML
 */
function extractHTMLFromContent(content: string): string | null {
  // 匹配 ```html-slide ... ```
  const match = content.match(/```html-slide\s*\n([\s\S]*?)\n```/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 兼容旧格式 ```html ... ```
  const htmlMatch = content.match(/```html\s*\n([\s\S]*?)\n```/);
  if (htmlMatch && htmlMatch[1]) {
    // 检查是否是完整的 HTML（包含 DOCTYPE 和 html 标签）
    const html = htmlMatch[1].trim();
    if (html.includes("<!DOCTYPE") || html.includes("<html")) {
      return html;
    }
  }

  return null;
}

export function SlideHTMLPreview({ content, slideNumber }: SlideHTMLPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const extractedHTML = extractHTMLFromContent(content);
    setHtml(extractedHTML);
  }, [content]);

  if (!html) {
    return null;
  }

  const downloadHTML = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `slide-${slideNumber || 1}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="my-4 border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs font-medium">
              Slide {slideNumber || ""} Preview
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadHTML}
              className="h-7 px-2"
              title="Download HTML"
            >
              <Download className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(true)}
              className="h-7 px-2"
              title="Fullscreen Preview"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Preview - 限制最大宽度为1280px保持16:9比例 */}
        <div className="p-4 flex justify-center">
          <div className="w-full max-w-[1280px]">
            <SlideHTMLRenderer
              html={html}
              slideId={`slide-${slideNumber || "preview"}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-muted border-t">
          <p className="text-xs text-muted-foreground">
            This slide is rendered in a secure sandbox. Click download to save the HTML file.
          </p>
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[1400px] w-[95vw] h-[95vh] p-0 gap-0">
          <DialogTitle className="sr-only">
            Slide {slideNumber || ""} - Fullscreen Preview
          </DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted border-b">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium">
                Slide {slideNumber || ""} - Fullscreen Preview (1280x720)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadHTML}
                className="h-8 px-3 gap-1.5"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                className="h-8 px-3 gap-1.5"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          {/* Fullscreen Preview - Fixed 1280px width */}
          <div className="flex-1 overflow-auto bg-muted/50 p-8 flex items-center justify-center">
            <SlideHTMLRenderer
              html={html}
              slideId={`slide-${slideNumber || "preview"}-fullscreen`}
              fixedSize={true}
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-muted border-t">
            <p className="text-xs text-muted-foreground">
              Displaying at original size (1280x720). This matches the exported PPT dimensions.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
