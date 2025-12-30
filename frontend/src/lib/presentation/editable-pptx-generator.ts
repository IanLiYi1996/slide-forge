/**
 * Editable PPTX Generator
 * 使用 pptxgenjs 生成包含可编辑文本的 PowerPoint 文件
 */

import PptxGenJS from "pptxgenjs";
import html2canvas from "html2canvas-pro";
import type { ParsedSlide, ContentBlock, ImageBlock, InfographicBlock, ThemeColors, ContentAreaImageBlock } from "./html-parser";

/**
 * 可编辑 PPTX 生成器
 */
export class EditablePPTXGenerator {
  private pptx: PptxGenJS;
  private imageCache: Map<string, string> = new Map(); // URL -> dataURL cache

  constructor() {
    this.pptx = new PptxGenJS();

    // 设置演示文稿属性
    this.pptx.layout = "LAYOUT_16x9";
    this.pptx.author = "Slide Forge AI";
    this.pptx.subject = "AI Generated Presentation";
  }

  /**
   * 设置演示文稿标题
   */
  setTitle(title: string) {
    this.pptx.title = title;
  }

  /**
   * 生成单页幻灯片
   * @param isFirstSlide - 是否为首页（首页完全用图片，保持所有视觉效果）
   */
  async generateSlide(parsed: ParsedSlide, isFirstSlide: boolean = false): Promise<void> {
    const slide = this.pptx.addSlide();

    // 设置背景色
    const bgColor = this.hexToRGB(parsed.theme.bg);
    slide.background = { fill: bgColor } as any;
    console.log("[PPTX Generator] Setting background:", parsed.theme.bg, "->", bgColor);

    // 计算布局位置
    const MARGIN = 0.47;
    const SLIDE_WIDTH = 10;
    const CONTENT_WIDTH = SLIDE_WIDTH - 2 * MARGIN;

    // 首页：完全用图片（保持渐变艺术字、卡片等所有视觉效果）
    if (isFirstSlide && parsed.contentAreaImage) {
      console.log("[PPTX Generator] First slide - rendering complete slide as image");
      await this.addContentAreaImage(
        slide,
        parsed.contentAreaImage,
        MARGIN,
        MARGIN,
        CONTENT_WIDTH,
      );
      return; // 首页完成，直接返回
    }

    // 非首页的复杂布局：图片底层 + 可编辑文字顶层
    if (parsed.isComplexLayout && parsed.contentAreaImage) {
      console.log("[PPTX Generator] Non-first complex slide - hybrid mode");

      // === 重要：先添加图片作为底层，再添加文字作为顶层 ===

      // 步骤1: 先添加完整幻灯片图片作为底层
      await this.addComplexContentAreaOnly(
        slide,
        parsed.contentAreaImage,
        MARGIN,
        MARGIN,
        CONTENT_WIDTH,
      );

      // 步骤2: 再添加可编辑文字（会覆盖在图片上）
      let currentY = MARGIN;

      // 添加可编辑标题（带白色背景，覆盖图片中的标题）
      currentY = this.addTitleWithBackground(slide, parsed.title, parsed.titleStyles, parsed.theme, currentY, MARGIN, CONTENT_WIDTH);

      // 添加可编辑副标题（带白色背景）
      if (parsed.subtitle) {
        currentY = this.addSubtitleWithBackground(
          slide,
          parsed.subtitle,
          parsed.subtitleStyles!,
          parsed.theme,
          currentY,
          MARGIN,
          CONTENT_WIDTH,
        );
      }

      // 添加可编辑页脚（带白色背景）
      if (parsed.footer) {
        this.addFooterWithBackground(slide, parsed.footer, MARGIN, parsed.theme);
      }
    } else {
      // === 简单布局：纯可编辑元素 ===
      let currentY = MARGIN;

      // 添加标题
      currentY = this.addTitle(slide, parsed.title, parsed.titleStyles, parsed.theme, currentY, MARGIN, CONTENT_WIDTH);

      // 添加副标题
      if (parsed.subtitle) {
        currentY = this.addSubtitle(
          slide,
          parsed.subtitle,
          parsed.subtitleStyles!,
          parsed.theme,
          currentY,
          MARGIN,
          CONTENT_WIDTH,
        );
      }

      // 添加内容块
      for (const block of parsed.content) {
        currentY = await this.addContentBlock(
          slide,
          block,
          parsed.theme,
          currentY,
          MARGIN,
          CONTENT_WIDTH,
        );
      }

      // 添加图片
      if (parsed.images.length > 0) {
        currentY = await this.addImages(
          slide,
          parsed.images,
          currentY,
          MARGIN,
          CONTENT_WIDTH,
        );
      }

      // 添加信息图
      if (parsed.infographic) {
        await this.addInfographic(
          slide,
          parsed.infographic,
          currentY,
          MARGIN,
          CONTENT_WIDTH,
        );
      }

      // 添加页脚
      if (parsed.footer) {
        this.addFooter(slide, parsed.footer, MARGIN);
      }
    }
  }

  /**
   * 添加标题
   */
  private addTitle(
    slide: any,
    title: string,
    styles: any,
    theme: ThemeColors,
    y: number,
    x: number,
    width: number,
  ): number {
    const fontSize = this.pxToPt(styles.fontSize);
    const color = this.hexToRGB(styles.color);

    slide.addText(title, {
      x,
      y,
      w: width,
      h: 0.8, // 高度
      fontSize,
      bold: this.isBold(styles.fontWeight),
      color,
      fontFace: styles.fontFamily || "Arial",
      align: "left",
      valign: "top",
    });

    return y + 1.0; // 标题后留白
  }

  /**
   * 添加副标题
   */
  private addSubtitle(
    slide: any,
    subtitle: string,
    styles: any,
    theme: ThemeColors,
    y: number,
    x: number,
    width: number,
  ): number {
    const fontSize = this.pxToPt(styles.fontSize);
    const color = this.hexToRGB(styles.color);

    slide.addText(subtitle, {
      x,
      y,
      w: width,
      h: 0.5,
      fontSize,
      bold: this.isBold(styles.fontWeight),
      color,
      fontFace: styles.fontFamily || "Arial",
      align: "left",
      valign: "top",
    });

    return y + 0.7; // 副标题后留白
  }

  /**
   * 添加内容块
   */
  private async addContentBlock(
    slide: any,
    block: ContentBlock,
    theme: ThemeColors,
    y: number,
    x: number,
    width: number,
  ): Promise<number> {
    const fontSize = this.pxToPt(block.styles.fontSize);
    const color = this.hexToRGB(block.styles.color);

    if (block.type === "paragraph" && block.text) {
      // 段落
      const lineHeight = 0.35; // 单行高度估计
      const lines = Math.ceil(block.text.length / 80); // 估算行数
      const height = lineHeight * lines;

      slide.addText(block.text, {
        x,
        y,
        w: width,
        h: height,
        fontSize,
        color,
        fontFace: block.styles.fontFamily || "Arial",
        align: "left",
        valign: "top",
      });

      return y + height + 0.2; // 段落后留白
    } else if (block.type === "list" && block.items) {
      // 项目符号列表
      // 直接使用HTML中的主题色
      const bulletColor = this.hexToRGB(theme.primary);

      // 计算列表高度
      const itemHeight = 0.35; // 每项高度
      const totalHeight = block.items.length * itemHeight;

      // 使用 pptxgenjs 的 bullet 功能
      const textItems = block.items.map((item) => ({
        text: item,
        options: {
          bullet: { code: "2022" }, // Unicode bullet point
          color,
        },
      }));

      slide.addText(textItems, {
        x,
        y,
        w: width,
        h: totalHeight,
        fontSize,
        fontFace: block.styles.fontFamily || "Arial",
        align: "left",
        valign: "top",
        bullet: {
          code: "2022",
          style: "number",
          color: bulletColor,
        },
      });

      return y + totalHeight + 0.3; // 列表后留白
    }

    return y;
  }

  /**
   * 添加图片
   */
  private async addImages(
    slide: any,
    images: ImageBlock[],
    y: number,
    x: number,
    width: number,
  ): Promise<number> {
    const MAX_IMAGE_HEIGHT = 3.13; // 400px ≈ 3.13英寸
    const CREDIT_HEIGHT = 0.2;

    for (const image of images) {
      try {
        // 下载并缓存图片
        const dataURL = await this.downloadImageAsDataURL(image.url);

        // 添加图片(居中)
        slide.addImage({
          data: dataURL,
          x: x + width / 2 - 4.5, // 居中,图片宽度约9英寸
          y,
          w: 9,
          h: MAX_IMAGE_HEIGHT,
          sizing: {
            type: "contain",
            w: 9,
            h: MAX_IMAGE_HEIGHT,
          },
        });

        let imageY = y + MAX_IMAGE_HEIGHT;

        // 添加作者信息(如果有)
        if (image.credit) {
          const creditText = `Photo by ${image.credit.author} on Unsplash`;
          slide.addText(creditText, {
            x,
            y: imageY,
            w: width,
            h: CREDIT_HEIGHT,
            fontSize: 9, // 12px ≈ 9pt
            color: "A0AEC0",
            fontFace: "Arial",
            align: "center",
            valign: "middle",
          });

          imageY += CREDIT_HEIGHT;
        }

        y = imageY + 0.2; // 图片后留白
      } catch (error) {
        console.error("Failed to add image:", error);

        // 显示占位符文本
        slide.addText("Image could not be loaded", {
          x,
          y,
          w: width,
          h: 0.5,
          fontSize: 14,
          color: "FF0000",
          fontFace: "Arial",
          align: "center",
          valign: "middle",
          italic: true,
        });

        y += 0.7;
      }
    }

    return y;
  }

  /**
   * 添加复杂内容区域图片（用于首页，渲染完整幻灯片）
   */
  private async addContentAreaImage(
    slide: any,
    contentAreaImage: ContentAreaImageBlock,
    startY: number,
    x: number,
    width: number,
  ): Promise<void> {
    try {
      console.log("[PPTX Generator] Rendering complete slide to image...");

      // 渲染整个幻灯片为图片
      const dataURL = await this.renderCompleteSlideToImage(contentAreaImage.html);

      // 添加完整幻灯片图片（覆盖整个幻灯片）
      slide.addImage({
        data: dataURL,
        x: 0,
        y: 0,
        w: 10,
        h: 5.625,
      });

      console.log("[PPTX Generator] Complete slide rendered as image");
    } catch (error) {
      console.error("Failed to render slide as image:", error);
      this.addErrorPlaceholder(slide, "Slide could not be rendered", x, startY, width);
    }
  }

  /**
   * 添加只包含内容区域的图片（用于非首页复杂布局）
   * 渲染除标题/副标题/页脚外的内容区域
   */
  private async addComplexContentAreaOnly(
    slide: any,
    contentAreaImage: ContentAreaImageBlock,
    startY: number,
    x: number,
    width: number,
  ): Promise<void> {
    try {
      console.log("[PPTX Generator] Rendering content area only (without title/footer)...");

      // 渲染内容区域（移除标题、副标题、页脚后）
      const dataURL = await this.renderContentAreaOnly(contentAreaImage.html);

      // 计算内容区域高度
      const SLIDE_HEIGHT = 5.625;
      const FOOTER_HEIGHT = 0.5;
      const contentHeight = SLIDE_HEIGHT - startY - FOOTER_HEIGHT - 0.2;

      // 添加图片（只包含内容区域）
      slide.addImage({
        data: dataURL,
        x,
        y: startY,
        w: width,
        h: contentHeight,
        sizing: {
          type: "contain",
          w: width,
          h: contentHeight,
        },
      });

      console.log("[PPTX Generator] Content area rendered successfully");
    } catch (error) {
      console.error("Failed to render content area:", error);
      this.addErrorPlaceholder(slide, "Content could not be rendered", x, startY, width);
    }
  }

  /**
   * 添加错误占位符
   */
  private addErrorPlaceholder(slide: any, message: string, x: number, y: number, width: number): void {
    slide.addText(message, {
      x,
      y,
      w: width,
      h: 1,
      fontSize: 18,
      color: "FF0000",
      fontFace: "Arial",
      align: "center",
      valign: "middle",
      italic: true,
    });
  }

  /**
   * 添加信息图(转为图片)
   */
  private async addInfographic(
    slide: any,
    infographic: InfographicBlock,
    y: number,
    x: number,
    width: number,
  ): Promise<void> {
    try {
      // 将 infographic HTML 渲染为图片，传递DSL
      const dataURL = await this.renderHTMLToImage(infographic.containerHTML, infographic.dsl);

      // 添加图片
      slide.addImage({
        data: dataURL,
        x,
        y,
        w: width,
        h: 3.13, // 400px ≈ 3.13英寸
        sizing: {
          type: "contain",
          w: width,
          h: 3.13,
        },
      });
    } catch (error) {
      console.error("Failed to render infographic:", error);

      // 显示占位符
      slide.addText("Infographic could not be rendered", {
        x,
        y,
        w: width,
        h: 0.5,
        fontSize: 14,
        color: "FF0000",
        fontFace: "Arial",
        align: "center",
        valign: "middle",
        italic: true,
      });
    }
  }

  /**
   * 添加页脚
   */
  private addFooter(slide: any, footer: string, margin: number): void {
    const SLIDE_HEIGHT = 5.625; // 16:9 幻灯片高度(英寸)

    slide.addText(footer, {
      x: 8.5, // 右下角
      y: SLIDE_HEIGHT - 0.5,
      w: 1.5,
      h: 0.3,
      fontSize: 10, // 14px ≈ 10pt
      color: "A0AEC0",
      fontFace: "Arial",
      align: "right",
      valign: "bottom",
    });
  }

  /**
   * 添加带白色背景的标题（用于混合模式，覆盖底层图片）
   */
  private addTitleWithBackground(
    slide: any,
    title: string,
    styles: any,
    theme: ThemeColors,
    y: number,
    x: number,
    width: number,
  ): number {
    const fontSize = this.pxToPt(styles.fontSize);
    const height = 0.8;

    // 先添加白色矩形背景
    slide.addShape(this.pptx.ShapeType.rect, {
      x,
      y,
      w: width,
      h: height,
      fill: { color: this.hexToRGB(theme.bg) }, // 使用幻灯片背景色
      line: { type: "none" }, // 无边框
    });

    // 再添加文字（覆盖在白色背景上）
    slide.addText(title, {
      x,
      y,
      w: width,
      h: height,
      fontSize,
      bold: this.isBold(styles.fontWeight),
      color: this.hexToRGB(theme.primary), // 使用主题色作为纯色文字
      fontFace: styles.fontFamily || "Arial",
      align: "center", // 居中对齐
      valign: "middle",
    });

    return y + 1.0;
  }

  /**
   * 添加带白色背景的副标题（用于混合模式）
   */
  private addSubtitleWithBackground(
    slide: any,
    subtitle: string,
    styles: any,
    theme: ThemeColors,
    y: number,
    x: number,
    width: number,
  ): number {
    const fontSize = this.pxToPt(styles.fontSize);
    const height = 0.5;

    // 先添加白色矩形背景
    slide.addShape(this.pptx.ShapeType.rect, {
      x,
      y,
      w: width,
      h: height,
      fill: { color: this.hexToRGB(theme.bg) },
      line: { type: "none" },
    });

    // 再添加文字
    slide.addText(subtitle, {
      x,
      y,
      w: width,
      h: height,
      fontSize,
      bold: this.isBold(styles.fontWeight),
      color: this.hexToRGB(styles.color),
      fontFace: styles.fontFamily || "Arial",
      align: "center",
      valign: "middle",
    });

    return y + 0.7;
  }

  /**
   * 添加带白色背景的页脚（用于混合模式）
   */
  private addFooterWithBackground(slide: any, footer: string, margin: number, theme: ThemeColors): void {
    const SLIDE_HEIGHT = 5.625;
    const footerY = SLIDE_HEIGHT - 0.5;
    const footerX = 8.5;
    const footerW = 1.5;
    const footerH = 0.3;

    // 先添加白色矩形背景
    slide.addShape(this.pptx.ShapeType.rect, {
      x: footerX,
      y: footerY,
      w: footerW,
      h: footerH,
      fill: { color: this.hexToRGB(theme.bg) },
      line: { type: "none" },
    });

    // 再添加文字
    slide.addText(footer, {
      x: footerX,
      y: footerY,
      w: footerW,
      h: footerH,
      fontSize: 10,
      color: "A0AEC0",
      fontFace: "Arial",
      align: "right",
      valign: "bottom",
    });
  }

  /**
   * 导出 PPTX
   */
  async export(): Promise<Blob> {
    const blob = await this.pptx.write({ outputType: "blob" });
    return blob as Blob;
  }

  // ========== 辅助函数 ==========

  /**
   * 像素转磅 (1px ≈ 0.75pt)
   */
  private pxToPt(px: number): number {
    return Math.round(px * 0.75);
  }

  /**
   * 像素转英寸 (96 DPI)
   */
  private pxToInch(px: number): number {
    return px / 96;
  }

  /**
   * Hex 颜色转 RGB 格式 (pptxgenjs 需要)
   */
  private hexToRGB(hex: string): string {
    // 移除 # 号
    return hex.replace("#", "");
  }

  /**
   * 判断是否为粗体
   */
  private isBold(fontWeight: string): boolean {
    return fontWeight === "bold" || fontWeight === "700" || parseInt(fontWeight) >= 700;
  }

  /**
   * 下载图片并转为 dataURL
   */
  private async downloadImageAsDataURL(url: string): Promise<string> {
    // 检查缓存
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    try {
      const response = await fetch(url, {
        mode: "cors",
        referrerPolicy: "no-referrer",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load ${url}`);
      }

      const blob = await response.blob();
      const dataURL = await this.blobToDataURL(blob);

      // 缓存
      this.imageCache.set(url, dataURL);

      return dataURL;
    } catch (error) {
      console.error(`Failed to download image from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Blob 转 dataURL
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 将 Infographic HTML 渲染为图片
   * 需要构建完整的HTML页面，包含AntV库和脚本
   */
  private async renderHTMLToImage(containerHTML: string, dsl?: string): Promise<string> {
    // 如果没有DSL，直接渲染HTML（可能不会显示内容）
    if (!dsl) {
      console.warn("No DSL provided for infographic, rendering may be empty");
    }

    // 构建完整的HTML页面
    const fullHTML = this.buildInfographicHTML(containerHTML, dsl);

    // 创建临时 iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    try {
      // 写入完整的HTML
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error("Cannot access iframe document");
      }

      doc.open();
      doc.write(fullHTML);
      doc.close();

      // 等待加载
      await new Promise((resolve) => {
        if (doc.readyState === "complete") {
          resolve(null);
        } else {
          iframe.onload = () => resolve(null);
        }
      });

      // 额外等待脚本执行和infographic渲染
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 查找容器
      const container = doc.querySelector("#infographic-container");
      if (!container) {
        throw new Error("Infographic container not found");
      }

      // 使用 html2canvas 捕获
      const canvas = await html2canvas(container as HTMLElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        width: 1160,
        height: 400,
      });

      // 转为 dataURL
      return canvas.toDataURL("image/png", 0.95);
    } finally {
      // 清理
      document.body.removeChild(iframe);
    }
  }

  /**
   * 渲染内容区域为图片（移除标题、副标题、页脚）
   * 用于非首页的混合模式
   */
  private async renderContentAreaOnly(fullHTML: string): Promise<string> {
    // 创建临时 iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    try {
      // 写入完整HTML
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error("Cannot access iframe document");
      }

      doc.open();
      doc.write(fullHTML);
      doc.close();

      // 等待加载
      await new Promise((resolve) => {
        if (doc.readyState === "complete") {
          resolve(null);
        } else {
          iframe.onload = () => resolve(null);
        }
      });

      // 额外等待脚本执行
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 隐藏标题、副标题、页脚（不影响布局，只是不可见）
      const elementsToHide = [
        ".slide-title",
        ".slide-subtitle",
        ".slide-footer",
        ".slide-header", // 某些布局有header容器
      ];

      for (const selector of elementsToHide) {
        const element = doc.querySelector(selector) as HTMLElement;
        if (element) {
          element.style.visibility = "hidden"; // 保持布局，但不可见
        }
      }

      // 查找幻灯片容器
      const slideContainer = doc.querySelector(".slide-container");
      if (!slideContainer) {
        throw new Error("Slide container not found");
      }

      console.log("[PPTX Generator] Capturing content area (title/footer hidden)...");

      // 使用 html2canvas 捕获
      const canvas = await html2canvas(slideContainer as HTMLElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        width: 1280,
        height: 720,
      });

      // 转为 dataURL
      return canvas.toDataURL("image/png", 0.95);
    } finally {
      // 清理
      document.body.removeChild(iframe);
    }
  }

  /**
   * 渲染完整幻灯片为图片（用于首页）
   * 捕获整个 slide-container 的视觉效果
   */
  private async renderCompleteSlideToImage(fullHTML: string): Promise<string> {
    // 创建临时 iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    try {
      // 写入完整HTML
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        throw new Error("Cannot access iframe document");
      }

      doc.open();
      doc.write(fullHTML);
      doc.close();

      // 等待加载
      await new Promise((resolve) => {
        if (doc.readyState === "complete") {
          resolve(null);
        } else {
          iframe.onload = () => resolve(null);
        }
      });

      // 额外等待脚本执行和渲染（特别是infographic）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 查找幻灯片容器
      const slideContainer = doc.querySelector(".slide-container");
      if (!slideContainer) {
        throw new Error("Slide container not found");
      }

      console.log("[PPTX Generator] Capturing slide container...");

      // 使用 html2canvas 捕获整个容器
      const canvas = await html2canvas(slideContainer as HTMLElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        width: 1280,
        height: 720,
      });

      // 转为 dataURL
      return canvas.toDataURL("image/png", 0.95);
    } finally {
      // 清理
      document.body.removeChild(iframe);
    }
  }

  /**
   * 构建Infographic的完整HTML页面
   */
  private buildInfographicHTML(containerHTML: string, dsl?: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Infographic</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    #infographic-container {
      width: 1160px;
      height: 400px;
    }
  </style>
</head>
<body>
  <div id="infographic-container"></div>

  <!-- AntV Infographic Library -->
  <script src="https://unpkg.com/@antv/infographic@latest/dist/infographic.min.js"></script>

  <!-- Resource Loader -->
  <script>
    const svgTextCache = new Map();
    const pendingRequests = new Map();

    AntVInfographic.registerResourceLoader(async (config) => {
      const { data, scene } = config;

      try {
        const key = \`\${scene}::\${data}\`;
        let svgText;

        if (svgTextCache.has(key)) {
          svgText = svgTextCache.get(key);
        } else if (pendingRequests.has(key)) {
          svgText = await pendingRequests.get(key);
        } else {
          const fetchPromise = (async () => {
            try {
              let url;

              if (scene === 'icon') {
                url = \`https://api.iconify.design/\${data}.svg\`;
              } else if (scene === 'illus') {
                url = \`https://raw.githubusercontent.com/balazser/undraw-svg-collection/refs/heads/main/svgs/\${data}.svg\`;
              } else return null;

              const response = await fetch(url, { referrerPolicy: 'no-referrer' });

              if (!response.ok) {
                console.error(\`HTTP \${response.status}: Failed to load \${url}\`);
                return null;
              }

              const text = await response.text();

              if (!text || !text.trim().startsWith('<svg')) {
                console.error(\`Invalid SVG content from \${url}\`);
                return null;
              }

              svgTextCache.set(key, text);
              return text;
            } catch (fetchError) {
              console.error(\`Failed to fetch resource \${key}:\`, fetchError);
              return null;
            }
          })();

          pendingRequests.set(key, fetchPromise);

          try {
            svgText = await fetchPromise;
          } finally {
            pendingRequests.delete(key);
          }
        }

        if (!svgText) return null;

        const resource = AntVInfographic.loadSVGResource(svgText);

        if (!resource) {
          console.error(\`loadSVGResource returned null for \${key}\`);
          svgTextCache.delete(key);
          return null;
        }

        return resource;
      } catch (error) {
        console.error('Unexpected error in resource loader:', error);
        return null;
      }
    });
  </script>

  <!-- Initialize Infographic -->
  ${dsl ? `<script>
    try {
      const infographic = new AntVInfographic.Infographic({
        container: '#infographic-container',
        width: '100%',
        height: '100%',
      });

      infographic.render(\`${dsl.replace(/`/g, '\\`')}\`);
    } catch (error) {
      console.error('Failed to render infographic:', error);
    }
  </script>` : '<!-- No DSL provided -->'}
</body>
</html>`;
  }
}
