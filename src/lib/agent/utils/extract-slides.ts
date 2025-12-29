/**
 * 从 Agent 消息中提取幻灯片 HTML
 */

import type { Message } from "../types";
import type { SlideData } from "../types/workflow";

/**
 * 从单条消息中提取 HTML slide
 */
export function extractHTMLFromMessage(content: string): string | null {
  // 匹配 ```html-slide ... ```
  const match = content.match(/```html-slide\s*\n([\s\S]*?)\n```/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 兼容 ```html ... ``` (完整 HTML)
  const htmlMatch = content.match(/```html\s*\n([\s\S]*?)\n```/);
  if (htmlMatch && htmlMatch[1]) {
    const html = htmlMatch[1].trim();
    if (html.includes("<!DOCTYPE") || html.includes("<html")) {
      return html;
    }
  }

  return null;
}

/**
 * 从消息中提取幻灯片编号
 */
export function extractSlideNumber(content: string): number | null {
  // 匹配 "Slide 1", "第1张", "slide 2" 等
  const patterns = [
    /[Ss]lide\s+(\d+)/,
    /第\s*(\d+)\s*[张页]/,
    /幻灯片\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1]);
    }
  }

  return null;
}

/**
 * 从所有消息中提取幻灯片数据
 */
export function extractSlidesFromMessages(messages: Message[]): SlideData[] {
  const slides: SlideData[] = [];
  const processedSlideNumbers = new Set<number>();

  // 只处理 assistant 消息
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  for (const message of assistantMessages) {
    const html = extractHTMLFromMessage(message.content);
    if (!html) continue;

    const slideNumber = extractSlideNumber(message.content);
    const slideIndex = slideNumber ? slideNumber - 1 : slides.length;

    // 避免重复
    if (processedSlideNumbers.has(slideIndex)) {
      continue;
    }

    // 提取大纲内容（如果有）
    const outlineMatch = message.content.match(/(?:Slide \d+:?\s*)(.+?)(?:\n|$)/);
    const outlineTitle = outlineMatch?.[1] || `Slide ${slideIndex + 1}`;

    slides.push({
      id: `slide-${slideIndex}`,
      index: slideIndex,
      outlineContent: outlineTitle,
      html,
      status: "ready",
      modificationCount: 0,
      conversationHistory: [
        {
          role: "assistant",
          content: message.content,
          timestamp: message.timestamp || new Date(),
        },
      ],
    });

    processedSlideNumbers.add(slideIndex);
  }

  // 按 index 排序
  slides.sort((a, b) => a.index - b.index);

  return slides;
}

/**
 * 检查消息中是否包含完成标志
 */
export function isPresentationComplete(messages: Message[]): boolean {
  const lastFewMessages = messages.slice(-5); // 检查最后5条消息

  for (const message of lastFewMessages) {
    if (message.role === "assistant") {
      const content = message.content.toLowerCase();
      // 检测完成关键词
      if (
        content.includes("all") &&
        (content.includes("complete") ||
          content.includes("finished") ||
          content.includes("done"))
      ) {
        return true;
      }

      // 中文完成标志
      if (
        content.includes("完成") ||
        content.includes("全部") ||
        content.includes("所有幻灯片")
      ) {
        return true;
      }
    }
  }

  return false;
}
