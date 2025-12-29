"use client";

/**
 * 幻灯片 HTML 渲染器
 * 使用 iframe 沙箱安全地渲染用户生成的 HTML
 */

import { useRef, useEffect } from "react";

interface SlideHTMLRendererProps {
  html: string;
  slideId: string;
  className?: string;
}

export function SlideHTMLRenderer({
  html,
  slideId,
  className = "",
}: SlideHTMLRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  if (!html) {
    return (
      <div
        className={`flex items-center justify-center bg-muted border-2 border-dashed rounded-lg ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg">Slide not generated yet</p>
          <p className="text-sm mt-2">Waiting for Agent to create this slide...</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      className={`w-full border-2 border-gray-200 rounded-lg shadow-lg ${className}`}
      title={`Slide ${slideId}`}
      style={{
        aspectRatio: "16/9",
        background: "white",
      }}
    />
  );
}
