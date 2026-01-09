"use client";

/**
 * 幻灯片 HTML 渲染器
 * 使用 iframe 沙箱安全地渲染用户生成的 HTML
 * 使用 CSS zoom 自动缩放以适配容器，同时保持完整的 1280x720 内容显示
 */

import { useRef, useEffect, useState } from "react";

interface SlideHTMLRendererProps {
  html: string;
  slideId: string;
  className?: string;
  fixedSize?: boolean; // 是否使用固定尺寸（全屏模式）
}

export function SlideHTMLRenderer({
  html,
  slideId,
  className = "",
  fixedSize = false,
}: SlideHTMLRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    const iframe = iframeRef.current;

    // 使用 srcdoc 而不是 document.write，这样每次都会完全重新加载 iframe
    // 避免在同一个文档上下文中重复声明变量的问题
    iframe.srcdoc = html;
  }, [html]);

  // 计算zoom比例（仅在非固定尺寸模式）
  useEffect(() => {
    if (fixedSize) {
      setZoom(1);
      return;
    }

    const updateZoom = () => {
      if (!wrapperRef.current) return;

      const wrapperWidth = wrapperRef.current.clientWidth;
      const slideWidth = 1280;

      // 如果容器宽度小于1280，缩放iframe
      if (wrapperWidth < slideWidth) {
        setZoom(wrapperWidth / slideWidth);
      } else {
        setZoom(1);
      }
    };

    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [fixedSize]);

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

  if (fixedSize) {
    // 全屏模式：固定1280x720，无缩放
    return (
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        className={`border-2 border-gray-200 rounded-lg shadow-lg ${className}`}
        title={`Slide ${slideId}`}
        style={{
          width: "1280px",
          height: "720px",
          background: "white",
        }}
      />
    );
  }

  // 默认模式：使用zoom缩放
  return (
    <div
      ref={wrapperRef}
      className={`border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden ${className}`}
      style={{
        width: "100%",
        height: `${720 * zoom}px`,
        background: "white",
      }}
    >
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        title={`Slide ${slideId}`}
        style={{
          width: "1280px",
          height: "720px",
          zoom: zoom,
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
