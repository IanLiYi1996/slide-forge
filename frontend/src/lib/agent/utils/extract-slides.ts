/**
 * 从 Agent 消息中提取幻灯片 HTML
 */

import type { Message } from "../types";
import type { SlideData } from "../types/workflow";

/**
 * 从单条消息中提取 HTML slide
 */
export function extractHTMLFromMessage(content: string): string | null {
  // ✅ 匹配 ```html-slide ... ``` （宽松正则，与后端一致）
  const match = content.match(/```html-slide\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // ✅ 兼容 ```html ... ``` (完整 HTML，同样使用宽松正则)
  const htmlMatch = content.match(/```html\s*([\s\S]*?)\s*```/);
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
 * 从所有消息中提取幻灯片数据（增强版：支持幻灯片更新）
 * 使用 Map 存储，最后一次出现的幻灯片优先（覆盖旧版本）
 */
export function extractSlidesFromMessages(messages: Message[]): SlideData[] {
  // ✅ 使用 Map 代替 Set，支持覆盖更新
  const slidesMap = new Map<number, SlideData>();

  // 只处理 assistant 消息
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  for (const message of assistantMessages) {
    const html = extractHTMLFromMessage(message.content);
    if (!html) continue;

    const slideNumber = extractSlideNumber(message.content);
    const slideIndex = slideNumber ? slideNumber - 1 : slidesMap.size;

    // 提取大纲内容（如果有）
    const outlineMatch = message.content.match(/(?:Slide \d+:?\s*)(.+?)(?:\n|$)/);
    const outlineTitle = outlineMatch?.[1] || `Slide ${slideIndex + 1}`;

    // 创建消息记录
    const messageRecord = {
      role: "assistant" as const,
      content: message.content,
      timestamp: message.timestamp || new Date(),
    };

    // ✅ 检查是否已存在该幻灯片
    if (slidesMap.has(slideIndex)) {
      // 更新现有幻灯片（保留最新版本）
      const existingSlide = slidesMap.get(slideIndex)!;
      existingSlide.html = html;
      existingSlide.outlineContent = outlineTitle;
      existingSlide.modificationCount = (existingSlide.modificationCount || 0) + 1;
      existingSlide.conversationHistory.push(messageRecord);

      console.log(
        `[Extract Slides] Updated slide ${slideIndex} (modification #${existingSlide.modificationCount})`
      );
    } else {
      // 新增幻灯片
      slidesMap.set(slideIndex, {
        id: `slide-${slideIndex}`,
        index: slideIndex,
        outlineContent: outlineTitle,
        html,
        status: "ready",
        modificationCount: 0,
        conversationHistory: [messageRecord],
      });

      console.log(`[Extract Slides] Added new slide ${slideIndex}`);
    }
  }

  // 转换为数组并按 index 排序
  const slides = Array.from(slidesMap.values()).sort(
    (a, b) => a.index - b.index
  );

  console.log(
    `[Extract Slides] Extracted ${slides.length} slides from ${messages.length} messages`
  );

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
