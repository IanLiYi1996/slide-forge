/**
 * HTML 模板生成工具
 * 为幻灯片生成完整的 HTML 页面
 */

/**
 * 生成包含 Infographic 的 Resource Loader 脚本
 */
export function getResourceLoaderScript(): string {
  return `
<script src="https://unpkg.com/@antv/infographic@latest/dist/infographic.min.js"></script>
<script>
// Resource Loader - 处理图标和插图加载
(function() {
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
})();
</script>`;
}

/**
 * 生成基础样式
 */
export function getBaseStyles(theme: string = "default"): string {
  const themes = {
    default: { primary: "#667eea", secondary: "#764ba2", bg: "#ffffff" },
    blue: { primary: "#3b82f6", secondary: "#1d4ed8", bg: "#ffffff" },
    green: { primary: "#10b981", secondary: "#059669", bg: "#ffffff" },
    purple: { primary: "#8b5cf6", secondary: "#6d28d9", bg: "#ffffff" },
    dark: { primary: "#6366f1", secondary: "#4f46e5", bg: "#1f2937" },
  } as const;

  type ThemeKey = keyof typeof themes;
  const themeKey = (theme in themes ? theme : "default") as ThemeKey;
  const selectedTheme = themes[themeKey];

  return `
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background: linear-gradient(135deg, ${selectedTheme.primary} 0%, ${selectedTheme.secondary} 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide-container {
      width: 1280px;
      height: 720px;
      min-height: 720px;
      max-height: 720px;
      background: ${selectedTheme.bg};
      border-radius: 16px;
      padding: 60px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    .slide-title {
      font-size: 48px;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 20px;
      line-height: 1.2;
    }

    .slide-subtitle {
      font-size: 24px;
      font-weight: 400;
      color: #4a5568;
      margin-bottom: 30px;
    }

    .slide-content {
      font-size: 24px;
      line-height: 1.6;
      color: #2d3748;
      flex: 1;
      overflow-y: auto;
      max-height: 500px;
    }

    .slide-content ul {
      list-style: none;
      padding: 0;
      margin: 20px 0;
    }

    .slide-content li {
      margin: 12px 0;
      padding-left: 30px;
      position: relative;
    }

    .slide-content li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: ${selectedTheme.primary};
      font-size: 28px;
      line-height: 1;
    }

    .slide-image {
      margin: 20px 0;
      text-align: center;
    }

    .slide-image img {
      max-width: 100%;
      max-height: 400px;
      border-radius: 12px;
      object-fit: cover;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .slide-image-credit {
      font-size: 12px;
      color: #a0aec0;
      margin-top: 8px;
    }

    #infographic-container {
      margin: 20px 0;
      width: 100%;
      height: 400px;
      max-height: 400px;
    }

    .slide-footer {
      position: absolute;
      bottom: 30px;
      right: 60px;
      font-size: 14px;
      color: #a0aec0;
    }
  `;
}

/**
 * 生成完整的 HTML 页面
 */
export function generateCompleteHTML(params: {
  title: string;
  subtitle?: string;
  content: string;
  infographicDSL?: string;
  imageUrl?: string;
  imageAuthor?: string;
  imageAuthorUrl?: string;
  theme?: string;
  slideNumber?: number;
  totalSlides?: number;
}): string {
  const {
    title,
    subtitle,
    content,
    infographicDSL,
    imageUrl,
    imageAuthor,
    imageAuthorUrl,
    theme = "default",
    slideNumber,
    totalSlides,
  } = params;

  // 处理内容（转换 markdown 列表为 HTML）
  const processedContent = convertMarkdownToHTML(content);

  // 构建 HTML
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${getBaseStyles(theme)}</style>
</head>
<body>
  <div class="slide-container">
    <h1 class="slide-title">${escapeHTML(title)}</h1>`;

  if (subtitle) {
    html += `\n    <p class="slide-subtitle">${escapeHTML(subtitle)}</p>`;
  }

  html += `\n    <div class="slide-content">\n      ${processedContent}\n    </div>`;

  // 添加图片
  if (imageUrl) {
    html += `\n    <div class="slide-image">`;
    html += `\n      <img src="${imageUrl}" alt="${escapeHTML(title)}" />`;
    if (imageAuthor && imageAuthorUrl) {
      html += `\n      <div class="slide-image-credit">Photo by <a href="${imageAuthorUrl}" target="_blank">${escapeHTML(imageAuthor)}</a> on Unsplash</div>`;
    }
    html += `\n    </div>`;
  }

  // 添加 Infographic
  if (infographicDSL) {
    html += `\n    <div id="infographic-container"></div>`;
  }

  // 添加页脚
  if (slideNumber !== undefined && totalSlides !== undefined) {
    html += `\n    <div class="slide-footer">${slideNumber} / ${totalSlides}</div>`;
  }

  html += `\n  </div>`;

  // 添加 Infographic 相关脚本
  if (infographicDSL) {
    html += getResourceLoaderScript();
    html += `\n<script>
  (function() {
    const infographic = new AntVInfographic.Infographic({
      container: '#infographic-container',
      width: '100%',
      height: '100%',
    });

    infographic.render(\`${infographicDSL}\`);
  })();
</script>`;
  }

  html += "\n</body>\n</html>";

  return html;
}

/**
 * 从内容中提取标题
 */
export function extractTitle(content: string): string {
  // 匹配 markdown 标题
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) return match[1];

  // 匹配第一行
  const firstLine = content.split("\n")[0];
  if (firstLine && firstLine.trim()) return firstLine.trim();

  return "Untitled";
}

/**
 * 从内容中提取描述
 */
export function extractDesc(content: string): string {
  // 移除标题后的第一段
  const withoutTitle = content.replace(/^#\s+.+$/m, "").trim();
  const firstParagraph = withoutTitle.split("\n\n")[0];

  return firstParagraph?.trim() || "";
}

/**
 * 转换 Markdown 列表为 HTML
 */
function convertMarkdownToHTML(markdown: string): string {
  let html = "";
  const lines = markdown.split("\n");
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("-")) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
      }
      const text = trimmed.replace(/^-\s*/, "");
      html += `  <li>${escapeHTML(text)}</li>\n`;
    } else if (trimmed) {
      if (inList) {
        html += "</ul>\n";
        inList = false;
      }
      html += `<p>${escapeHTML(trimmed)}</p>\n`;
    }
  }

  if (inList) {
    html += "</ul>\n";
  }

  return html;
}

/**
 * HTML 转义
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
