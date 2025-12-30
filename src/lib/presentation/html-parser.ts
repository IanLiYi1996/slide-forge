/**
 * HTML Slide Parser
 * 将幻灯片 HTML 解析为结构化数据,用于生成可编辑的 PPTX
 */

/**
 * 文本样式
 */
export interface TextStyles {
  fontSize: number; // px单位
  fontWeight: string; // 'bold' | 'normal' | '700' 等
  color: string; // hex格式,如 "#1a202c"
  fontFamily?: string;
}

/**
 * 内容块
 */
export interface ContentBlock {
  type: "paragraph" | "list";
  text?: string; // 段落文本
  items?: string[]; // 列表项
  styles: TextStyles;
}

/**
 * 图片块
 */
export interface ImageBlock {
  url: string;
  alt: string;
  credit?: {
    author: string;
    authorUrl: string;
  };
}

/**
 * 信息图块
 */
export interface InfographicBlock {
  containerHTML: string; // 包含完整的 infographic-container HTML
  dsl?: string; // Infographic DSL字符串
}

/**
 * 主题颜色
 */
export interface ThemeColors {
  primary: string; // 主色
  secondary: string; // 副色
  bg: string; // 背景色
  textColor: string; // 文本颜色
  titleColor: string; // 标题颜色
}

/**
 * 内容区域图片块（用于复杂布局）
 */
export interface ContentAreaImageBlock {
  html: string; // 完整的HTML，用于渲染为图片
}

/**
 * 解析后的幻灯片数据
 */
export interface ParsedSlide {
  title: string;
  titleStyles: TextStyles;
  subtitle?: string;
  subtitleStyles?: TextStyles;
  content: ContentBlock[];
  images: ImageBlock[];
  infographic?: InfographicBlock;
  footer?: string;
  theme: ThemeColors;
  isComplexLayout: boolean; // 是否为复杂布局
  contentAreaImage?: ContentAreaImageBlock; // 复杂布局时，内容区域的图片
}

/**
 * HTML 幻灯片解析器
 */
export class HTMLSlideParser {
  /**
   * 解析 HTML 字符串为结构化数据
   */
  parse(htmlString: string): ParsedSlide {
    // 使用 DOMParser 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");

    // 提取主题颜色
    const theme = this.extractThemeColors(doc);

    // 查找幻灯片容器
    const container = doc.querySelector(".slide-container");
    if (!container) {
      throw new Error("Slide container not found in HTML");
    }

    // 检测是否为复杂布局
    const isComplexLayout = this.detectComplexLayout(container);

    // 提取各个部分
    const title = this.extractTitle(container);
    const titleStyles = this.extractTitleStyles(container, theme);
    const subtitle = this.extractSubtitle(container);
    const subtitleStyles = subtitle
      ? this.extractSubtitleStyles(container, theme)
      : undefined;
    const footer = this.extractFooter(container);

    // 根据布局复杂度决定如何处理内容
    let content: ContentBlock[] = [];
    let images: ImageBlock[] = [];
    let infographic: InfographicBlock | undefined;
    let contentAreaImage: ContentAreaImageBlock | undefined;

    if (isComplexLayout) {
      // 复杂布局：将整个幻灯片HTML保存，用于渲染为图片
      console.log("[HTML Parser] Complex layout detected, will render content area as image");
      contentAreaImage = {
        html: htmlString, // 保存完整HTML
      };
    } else {
      // 简单布局：正常解析各个元素
      content = this.extractContentBlocks(container, theme);
      images = this.extractImages(container);
      infographic = this.extractInfographic(container);
    }

    return {
      title,
      titleStyles,
      subtitle,
      subtitleStyles,
      content,
      images,
      infographic,
      footer,
      theme,
      isComplexLayout,
      contentAreaImage,
    };
  }

  /**
   * 检测是否为复杂布局
   * 复杂布局特征：自定义卡片、横幅、网格、特殊样式类等
   */
  private detectComplexLayout(container: Element): boolean {
    // 检测自定义类名（复杂布局的标志）
    const complexClassNames = [
      ".point-card",
      ".key-points",
      ".impact-banner",
      ".card-grid",
      ".feature-card",
      ".slide-header", // 带有特殊样式的header
    ];

    for (const className of complexClassNames) {
      if (container.querySelector(className)) {
        return true;
      }
    }

    // 检测渐变文字（background-clip: text）
    const doc = container.ownerDocument;
    if (doc) {
      const styleTag = doc.querySelector("style");
      const styleContent = styleTag?.textContent || "";

      // 检测 -webkit-background-clip: text 或 background-clip: text
      if (
        styleContent.includes("background-clip: text") ||
        styleContent.includes("-webkit-background-clip: text")
      ) {
        return true;
      }

      // 检测复杂的CSS布局（grid, flex with complex children）
      if (styleContent.includes("display: grid") && styleContent.includes(".point")) {
        return true;
      }
    }

    // 检测infographic（信息图也算复杂布局）
    if (container.querySelector("#infographic-container")) {
      return true;
    }

    // 默认：简单布局
    return false;
  }

  /**
   * 从 style 标签提取主题颜色
   */
  private extractThemeColors(doc: Document): ThemeColors {
    const styleTag = doc.querySelector("style");
    const styleContent = styleTag?.textContent || "";

    // 默认主题
    const defaultTheme: ThemeColors = {
      primary: "#667eea",
      secondary: "#764ba2",
      bg: "#ffffff",
      textColor: "#2d3748",
      titleColor: "#1a202c",
    };

    try {
      // 提取 primary 和 secondary (从 linear-gradient)
      const gradientMatch = styleContent.match(
        /linear-gradient\([^)]*?([#\w]+)\s+\d+%[^)]*?([#\w]+)\s+\d+%/,
      );
      if (gradientMatch) {
        defaultTheme.primary = this.normalizeColor(gradientMatch[1]) || defaultTheme.primary;
        defaultTheme.secondary = this.normalizeColor(gradientMatch[2]) || defaultTheme.secondary;
      }

      // 提取背景色
      const bgMatch = styleContent.match(/\.slide-container[^{]*{[^}]*background:\s*([#\w]+)/);
      if (bgMatch) {
        defaultTheme.bg = this.normalizeColor(bgMatch[1]) || defaultTheme.bg;
      }

      // 提取标题颜色
      const titleColorMatch = styleContent.match(/\.slide-title[^{]*{[^}]*color:\s*([#\w]+)/);
      if (titleColorMatch) {
        const color = titleColorMatch[1];
        // transparent时使用默认深色，其他颜色正常转换
        if (color.toLowerCase() === 'transparent') {
          defaultTheme.titleColor = "#1a202c"; // 使用默认深色
        } else {
          defaultTheme.titleColor = this.normalizeColor(color) || defaultTheme.titleColor;
        }
      }

      // 提取内容文本颜色
      const textColorMatch = styleContent.match(/\.slide-content[^{]*{[^}]*color:\s*([#\w]+)/);
      if (textColorMatch) {
        defaultTheme.textColor = this.normalizeColor(textColorMatch[1]) || defaultTheme.textColor;
      }

      // 调试日志
      console.log("[HTML Parser] Extracted theme colors:", defaultTheme);
    } catch (error) {
      console.warn("Failed to extract theme colors, using defaults:", error);
    }

    return defaultTheme;
  }

  /**
   * 标准化颜色值：将CSS颜色名称转换为hex格式
   */
  private normalizeColor(color: string): string {
    // 如果已经是hex格式，直接返回
    if (color.startsWith("#")) {
      return color;
    }

    // CSS颜色名称到hex的映射
    const colorMap: Record<string, string> = {
      white: "#ffffff",
      black: "#000000",
      transparent: "#ffffff", // transparent当作白色处理
      red: "#ff0000",
      green: "#008000",
      blue: "#0000ff",
      yellow: "#ffff00",
      cyan: "#00ffff",
      magenta: "#ff00ff",
      gray: "#808080",
      grey: "#808080",
    };

    const lowerColor = color.toLowerCase();
    if (lowerColor in colorMap) {
      return colorMap[lowerColor];
    }

    // 如果无法识别，返回原值
    return color.startsWith("#") ? color : `#${color}`;
  }

  /**
   * 提取标题
   */
  private extractTitle(container: Element): string {
    const titleEl = container.querySelector(".slide-title");
    return titleEl?.textContent?.trim() || "Untitled";
  }

  /**
   * 提取标题样式
   */
  private extractTitleStyles(
    container: Element,
    theme: ThemeColors,
  ): TextStyles {
    return {
      fontSize: 48, // 从 CSS 已知
      fontWeight: "bold",
      color: theme.titleColor, // 直接使用HTML中的颜色
      fontFamily: "Arial",
    };
  }

  /**
   * 提取副标题
   */
  private extractSubtitle(container: Element): string | undefined {
    const subtitleEl = container.querySelector(".slide-subtitle");
    const text = subtitleEl?.textContent?.trim();
    return text && text.length > 0 ? text : undefined;
  }

  /**
   * 提取副标题样式
   */
  private extractSubtitleStyles(
    container: Element,
    theme: ThemeColors,
  ): TextStyles {
    return {
      fontSize: 24, // 从 CSS 已知
      fontWeight: "normal",
      color: "#4a5568", // 直接使用HTML中的固定颜色
      fontFamily: "Arial",
    };
  }

  /**
   * 提取内容块(段落和列表)
   */
  private extractContentBlocks(
    container: Element,
    theme: ThemeColors,
  ): ContentBlock[] {
    const contentEl = container.querySelector(".slide-content");
    if (!contentEl) {
      return [];
    }

    const blocks: ContentBlock[] = [];
    const children = Array.from(contentEl.children);

    for (const child of children) {
      if (child.tagName === "UL") {
        // 列表
        const items = Array.from(child.querySelectorAll("li"))
          .map((li) => li.textContent?.trim())
          .filter((text): text is string => !!text && text.length > 0);

        if (items.length > 0) {
          blocks.push({
            type: "list",
            items,
            styles: {
              fontSize: 24, // 从 CSS 已知
              fontWeight: "normal",
              color: theme.textColor, // 直接使用HTML中的颜色
              fontFamily: "Arial",
            },
          });
        }
      } else if (child.tagName === "P") {
        // 段落
        const text = child.textContent?.trim();
        if (text && text.length > 0) {
          blocks.push({
            type: "paragraph",
            text,
            styles: {
              fontSize: 24, // 从 CSS 已知
              fontWeight: "normal",
              color: theme.textColor, // 直接使用HTML中的颜色
              fontFamily: "Arial",
            },
          });
        }
      }
    }

    return blocks;
  }

  /**
   * 提取图片
   */
  private extractImages(container: Element): ImageBlock[] {
    const images: ImageBlock[] = [];
    const imageContainers = Array.from(container.querySelectorAll(".slide-image"));

    for (const imgContainer of imageContainers) {
      const img = imgContainer.querySelector("img");
      if (!img) continue;

      const url = img.getAttribute("src");
      const alt = img.getAttribute("alt") || "";

      if (!url) continue;

      // 提取作者信息
      const creditEl = imgContainer.querySelector(".slide-image-credit a");
      let credit: ImageBlock["credit"];

      if (creditEl) {
        const author = creditEl.textContent?.trim() || "";
        const authorUrl = creditEl.getAttribute("href") || "";
        if (author && authorUrl) {
          credit = { author, authorUrl };
        }
      }

      images.push({ url, alt, credit });
    }

    return images;
  }

  /**
   * 提取信息图
   */
  private extractInfographic(container: Element): InfographicBlock | undefined {
    const infographicEl = container.querySelector("#infographic-container");
    if (!infographicEl) {
      return undefined;
    }

    // 获取整个 infographic-container 的 HTML
    const containerHTML = infographicEl.outerHTML;

    // 尝试提取 DSL 字符串（从初始化脚本中）
    let dsl: string | undefined;
    const doc = container.ownerDocument;
    if (doc) {
      const scripts = Array.from(doc.querySelectorAll("script"));
      for (const script of scripts) {
        const scriptContent = script.textContent || "";
        // 查找 infographic.render(`...`)
        const dslMatch = scriptContent.match(/infographic\.render\(`([^`]+)`\)/);
        if (dslMatch && dslMatch[1]) {
          dsl = dslMatch[1];
          break;
        }
      }
    }

    return {
      containerHTML,
      dsl,
    };
  }

  /**
   * 提取页脚
   */
  private extractFooter(container: Element): string | undefined {
    const footerEl = container.querySelector(".slide-footer");
    const text = footerEl?.textContent?.trim();
    return text && text.length > 0 ? text : undefined;
  }
}
