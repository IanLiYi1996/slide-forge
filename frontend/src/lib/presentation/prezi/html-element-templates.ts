/**
 * HTML Element Templates for Prezi
 *
 * Pre-built HTML templates that can be used by AI Agent or manually
 * to create rich, interactive content elements in Prezi presentations.
 */

export interface HTMLTemplate {
  id: string;
  name: string;
  description: string;
  category: "card" | "chart" | "list" | "callout" | "button" | "form" | "media" | "layout";
  htmlContent: string;
  css?: string;
  defaultSize: { width: number; height: number };
  variables?: string[]; // Placeholders that can be replaced
}

/**
 * HTML Element Templates Library
 */
export const HTML_TEMPLATES: Record<string, HTMLTemplate> = {
  // ==================== Cards ====================

  "feature-card": {
    id: "feature-card",
    name: "Feature Card",
    description: "Card with icon, title, and description",
    category: "card",
    defaultSize: { width: 400, height: 300 },
    variables: ["{{ICON}}", "{{TITLE}}", "{{DESCRIPTION}}"],
    htmlContent: `
      <div class="feature-card">
        <div class="icon">{{ICON}}</div>
        <h3>{{TITLE}}</h3>
        <p>{{DESCRIPTION}}</p>
      </div>
    `,
    css: `
      .feature-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        padding: 32px;
        color: white;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .feature-card .icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .feature-card h3 {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 12px;
      }
      .feature-card p {
        font-size: 16px;
        opacity: 0.9;
        line-height: 1.6;
      }
    `,
  },

  "stat-card": {
    id: "stat-card",
    name: "Statistic Card",
    description: "Large number with label",
    category: "card",
    defaultSize: { width: 300, height: 200 },
    variables: ["{{NUMBER}}", "{{LABEL}}", "{{TREND}}"],
    htmlContent: `
      <div class="stat-card">
        <div class="number">{{NUMBER}}</div>
        <div class="label">{{LABEL}}</div>
        <div class="trend">{{TREND}}</div>
      </div>
    `,
    css: `
      .stat-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      }
      .stat-card .number {
        font-size: 48px;
        font-weight: bold;
        color: #3b82f6;
        margin-bottom: 8px;
      }
      .stat-card .label {
        font-size: 16px;
        color: #6b7280;
        margin-bottom: 12px;
      }
      .stat-card .trend {
        font-size: 14px;
        color: #10b981;
        font-weight: 600;
      }
    `,
  },

  // ==================== Lists ====================

  "bullet-list": {
    id: "bullet-list",
    name: "Bullet List",
    description: "Styled bullet point list",
    category: "list",
    defaultSize: { width: 500, height: 300 },
    variables: ["{{ITEM1}}", "{{ITEM2}}", "{{ITEM3}}", "{{ITEM4}}"],
    htmlContent: `
      <div class="bullet-list">
        <div class="list-item">✓ {{ITEM1}}</div>
        <div class="list-item">✓ {{ITEM2}}</div>
        <div class="list-item">✓ {{ITEM3}}</div>
        <div class="list-item">✓ {{ITEM4}}</div>
      </div>
    `,
    css: `
      .bullet-list {
        background: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        height: 100%;
      }
      .list-item {
        font-size: 18px;
        padding: 12px 0;
        border-bottom: 1px solid #e5e7eb;
        color: #1f2937;
      }
      .list-item:last-child {
        border-bottom: none;
      }
    `,
  },

  // ==================== Callouts ====================

  "highlight-box": {
    id: "highlight-box",
    name: "Highlight Box",
    description: "Attention-grabbing callout box",
    category: "callout",
    defaultSize: { width: 600, height: 200 },
    variables: ["{{TITLE}}", "{{MESSAGE}}"],
    htmlContent: `
      <div class="highlight-box">
        <div class="title">💡 {{TITLE}}</div>
        <div class="message">{{MESSAGE}}</div>
      </div>
    `,
    css: `
      .highlight-box {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        border-radius: 16px;
        padding: 24px 32px;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 8px 24px rgba(251, 191, 36, 0.3);
      }
      .highlight-box .title {
        font-size: 24px;
        font-weight: bold;
        color: #78350f;
        margin-bottom: 12px;
      }
      .highlight-box .message {
        font-size: 18px;
        color: #78350f;
        line-height: 1.6;
      }
    `,
  },

  "quote-box": {
    id: "quote-box",
    name: "Quote Box",
    description: "Styled quotation display",
    category: "callout",
    defaultSize: { width: 600, height: 250 },
    variables: ["{{QUOTE}}", "{{AUTHOR}}"],
    htmlContent: `
      <div class="quote-box">
        <div class="quote-mark">"</div>
        <div class="quote-text">{{QUOTE}}</div>
        <div class="quote-author">— {{AUTHOR}}</div>
      </div>
    `,
    css: `
      .quote-box {
        background: #1f2937;
        border-left: 4px solid #3b82f6;
        border-radius: 8px;
        padding: 32px;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
      }
      .quote-mark {
        position: absolute;
        top: 16px;
        left: 16px;
        font-size: 64px;
        color: #3b82f6;
        opacity: 0.3;
        font-family: serif;
      }
      .quote-text {
        font-size: 20px;
        color: #e5e7eb;
        font-style: italic;
        line-height: 1.6;
        margin-bottom: 16px;
        position: relative;
        z-index: 1;
      }
      .quote-author {
        font-size: 16px;
        color: #9ca3af;
        text-align: right;
      }
    `,
  },

  // ==================== Charts (Simple HTML/CSS) ====================

  "progress-bar": {
    id: "progress-bar",
    name: "Progress Bar",
    description: "Animated progress indicator",
    category: "chart",
    defaultSize: { width: 500, height: 150 },
    variables: ["{{LABEL}}", "{{PERCENTAGE}}"],
    htmlContent: `
      <div class="progress-container">
        <div class="progress-label">{{LABEL}}</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {{PERCENTAGE}}%"></div>
        </div>
        <div class="progress-percentage">{{PERCENTAGE}}%</div>
      </div>
    `,
    css: `
      .progress-container {
        padding: 24px;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .progress-label {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 12px;
      }
      .progress-bar-bg {
        background: #e5e7eb;
        border-radius: 8px;
        height: 24px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      .progress-bar-fill {
        background: linear-gradient(90deg, #3b82f6, #60a5fa);
        height: 100%;
        transition: width 1s ease-in-out;
      }
      .progress-percentage {
        font-size: 20px;
        font-weight: bold;
        color: #3b82f6;
        text-align: right;
      }
    `,
  },

  // ==================== Buttons ====================

  "cta-button": {
    id: "cta-button",
    name: "Call-to-Action Button",
    description: "Large interactive button",
    category: "button",
    defaultSize: { width: 300, height: 100 },
    variables: ["{{BUTTON_TEXT}}"],
    htmlContent: `
      <div class="cta-container">
        <button class="cta-button">{{BUTTON_TEXT}}</button>
      </div>
    `,
    css: `
      .cta-container {
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cta-button {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 20px 48px;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 32px rgba(59, 130, 246, 0.4);
      }
      .cta-button:active {
        transform: translateY(0);
      }
    `,
  },

  // ==================== Layouts ====================

  "two-column": {
    id: "two-column",
    name: "Two Column Layout",
    description: "Side-by-side content layout",
    category: "layout",
    defaultSize: { width: 800, height: 400 },
    variables: ["{{LEFT_TITLE}}", "{{LEFT_CONTENT}}", "{{RIGHT_TITLE}}", "{{RIGHT_CONTENT}}"],
    htmlContent: `
      <div class="two-column">
        <div class="column">
          <h3>{{LEFT_TITLE}}</h3>
          <p>{{LEFT_CONTENT}}</p>
        </div>
        <div class="column">
          <h3>{{RIGHT_TITLE}}</h3>
          <p>{{RIGHT_CONTENT}}</p>
        </div>
      </div>
    `,
    css: `
      .two-column {
        display: flex;
        gap: 32px;
        height: 100%;
        padding: 24px;
        background: white;
        border-radius: 12px;
      }
      .column {
        flex: 1;
        padding: 16px;
        border-radius: 8px;
        background: #f8fafc;
      }
      .column h3 {
        font-size: 20px;
        font-weight: bold;
        color: #1f2937;
        margin-bottom: 12px;
      }
      .column p {
        font-size: 16px;
        color: #4b5563;
        line-height: 1.6;
      }
    `,
  },
};

/**
 * Get template by ID
 */
export const getHTMLTemplate = (templateId: string): HTMLTemplate | null => {
  return HTML_TEMPLATES[templateId] || null;
};

/**
 * Get all templates by category
 */
export const getTemplatesByCategory = (category: string): HTMLTemplate[] => {
  return Object.values(HTML_TEMPLATES).filter((t) => t.category === category);
};

/**
 * Get all template categories
 */
export const getTemplateCategories = (): string[] => {
  const categories = new Set(Object.values(HTML_TEMPLATES).map((t) => t.category));
  return Array.from(categories);
};

/**
 * Replace variables in HTML template
 */
export const fillTemplate = (
  template: HTMLTemplate,
  variables: Record<string, string>
): { htmlContent: string; css: string } => {
  let htmlContent = template.htmlContent;
  let css = template.css || "";

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    htmlContent = htmlContent.replace(new RegExp(placeholder, "g"), value);
    css = css.replace(new RegExp(placeholder, "g"), value);
  });

  return { htmlContent, css };
};

/**
 * Generate HTML element from template
 */
export const generateHTMLElementFromTemplate = (
  templateId: string,
  variables: Record<string, string>,
  position?: { x: number; y: number; z: number }
) => {
  const template = getHTMLTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  const { htmlContent, css } = fillTemplate(template, variables);

  return {
    type: "html" as const,
    htmlContent,
    css,
    position: position || { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    size: template.defaultSize,
    zIndex: 0,
    opacity: 1,
    locked: false,
    backgroundColor: "transparent",
  };
};

/**
 * Quick template generators for common use cases
 */
export const QuickTemplates = {
  /**
   * Generate a feature highlight card
   */
  featureCard: (icon: string, title: string, description: string) => {
    return generateHTMLElementFromTemplate("feature-card", {
      ICON: icon,
      TITLE: title,
      DESCRIPTION: description,
    });
  },

  /**
   * Generate a statistic display
   */
  statCard: (number: string, label: string, trend: string) => {
    return generateHTMLElementFromTemplate("stat-card", {
      NUMBER: number,
      LABEL: label,
      TREND: trend,
    });
  },

  /**
   * Generate a bullet list
   */
  bulletList: (items: string[]) => {
    const variables: Record<string, string> = {};
    items.forEach((item, index) => {
      variables[`ITEM${index + 1}`] = item;
    });
    return generateHTMLElementFromTemplate("bullet-list", variables);
  },

  /**
   * Generate a highlight/callout box
   */
  highlightBox: (title: string, message: string) => {
    return generateHTMLElementFromTemplate("highlight-box", {
      TITLE: title,
      MESSAGE: message,
    });
  },

  /**
   * Generate a quote box
   */
  quoteBox: (quote: string, author: string) => {
    return generateHTMLElementFromTemplate("quote-box", {
      QUOTE: quote,
      AUTHOR: author,
    });
  },

  /**
   * Generate a CTA button
   */
  ctaButton: (buttonText: string) => {
    return generateHTMLElementFromTemplate("cta-button", {
      BUTTON_TEXT: buttonText,
    });
  },

  /**
   * Generate a two-column layout
   */
  twoColumn: (leftTitle: string, leftContent: string, rightTitle: string, rightContent: string) => {
    return generateHTMLElementFromTemplate("two-column", {
      LEFT_TITLE: leftTitle,
      LEFT_CONTENT: leftContent,
      RIGHT_TITLE: rightTitle,
      RIGHT_CONTENT: rightContent,
    });
  },
};
