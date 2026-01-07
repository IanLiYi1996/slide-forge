/**
 * Infographic 模板选择和 DSL 生成工具
 * 基于内容分析自动选择合适的模板
 */

/**
 * 模板分类
 */
export const TEMPLATE_CATEGORIES = {
  SEQUENCE: "sequence",
  LIST: "list",
  COMPARE: "compare",
  CHART: "chart",
  HIERARCHY: "hierarchy",
  RELATION: "relation",
  QUADRANT: "quadrant",
} as const;

/**
 * 常用图标映射
 */
const ICON_MAP: Record<string, string> = {
  // 科技类
  ai: "mdi/brain",
  code: "mdi/code-tags",
  database: "mdi/database",
  api: "mdi/api",
  cloud: "mdi/cloud",
  server: "mdi/server",
  mobile: "mdi/cellphone",
  web: "mdi/web",

  // 商业类
  growth: "mdi/trending-up",
  chart: "mdi/chart-line",
  money: "mdi/currency-usd",
  business: "mdi/briefcase",
  team: "mdi/account-group",
  success: "mdi/trophy",

  // 流程类
  start: "mdi/play-circle",
  process: "mdi/cog",
  check: "mdi/check-circle",
  next: "mdi/arrow-right",
  launch: "mdi/rocket-launch",
  finish: "mdi/flag-checkered",

  // 人员类
  user: "mdi/account",
  users: "mdi/account-group",
  admin: "mdi/shield-account",

  // 通用
  info: "mdi/information",
  warning: "mdi/alert",
  error: "mdi/close-circle",
  help: "mdi/help-circle",
};

/**
 * 检测内容中的关键词类别
 */
export function detectContentType(content: string): {
  category: string;
  keywords: string[];
  itemCount: number;
} {
  const lowerContent = content.toLowerCase();

  // 提取列表项数量
  const items = content.split("\n").filter((line) => line.trim().startsWith("-"));
  const itemCount = items.length;

  // 检测序列关键词
  if (
    /step|phase|stage|process|workflow|timeline|roadmap|步骤|阶段|流程|时间线/.test(
      lowerContent,
    )
  ) {
    return {
      category: TEMPLATE_CATEGORIES.SEQUENCE,
      keywords: ["sequence", "process", "steps"],
      itemCount,
    };
  }

  // 检测对比关键词
  if (/vs|versus|compare|contrast|对比|比较/.test(lowerContent)) {
    return {
      category: TEMPLATE_CATEGORIES.COMPARE,
      keywords: ["compare", "versus"],
      itemCount,
    };
  }

  // 检测数据关键词（有数值或百分比）
  if (
    /\d+%|\d+\s*(percent|份额|占比)|percentage|share|data|statistics/.test(
      lowerContent,
    )
  ) {
    return {
      category: TEMPLATE_CATEGORIES.CHART,
      keywords: ["data", "chart", "statistics"],
      itemCount,
    };
  }

  // 检测层级关键词
  if (/hierarchy|structure|organization|tree|层级|组织|架构/.test(lowerContent)) {
    return {
      category: TEMPLATE_CATEGORIES.HIERARCHY,
      keywords: ["hierarchy", "tree"],
      itemCount,
    };
  }

  // 检测关系关键词
  if (/relation|connection|network|cycle|关系|连接|网络/.test(lowerContent)) {
    return {
      category: TEMPLATE_CATEGORIES.RELATION,
      keywords: ["relation", "network"],
      itemCount,
    };
  }

  // 检测象限关键词
  if (/quadrant|matrix|象限|矩阵/.test(lowerContent)) {
    return {
      category: TEMPLATE_CATEGORIES.QUADRANT,
      keywords: ["quadrant", "matrix"],
      itemCount,
    };
  }

  // 默认为列表
  return {
    category: TEMPLATE_CATEGORIES.LIST,
    keywords: ["list", "features"],
    itemCount,
  };
}

/**
 * 根据类别和项数选择合适的模板
 */
export function selectTemplate(
  category: string,
  itemCount: number,
): string {
  switch (category) {
    case TEMPLATE_CATEGORIES.SEQUENCE:
      if (itemCount <= 4) return "sequence-horizontal-zigzag-underline-text";
      if (itemCount <= 6) return "sequence-timeline-simple";
      return "sequence-roadmap-vertical-simple";

    case TEMPLATE_CATEGORIES.COMPARE:
      return "compare-binary-horizontal-simple-fold";

    case TEMPLATE_CATEGORIES.CHART:
      return "chart-pie-plain-text";

    case TEMPLATE_CATEGORIES.HIERARCHY:
      return "hierarchy-tree-curved-line-rounded-rect-node";

    case TEMPLATE_CATEGORIES.RELATION:
      return "relation-circle-icon-badge";

    case TEMPLATE_CATEGORIES.QUADRANT:
      return "quadrant-quarter-simple-card";

    case TEMPLATE_CATEGORIES.LIST:
    default:
      if (itemCount <= 4) return "list-row-horizontal-icon-arrow";
      if (itemCount <= 6) return "list-grid-badge-card";
      return "list-grid-ribbon-card";
  }
}

/**
 * 从内容中提取数据项
 */
export function extractItems(content: string): Array<{
  label: string;
  desc: string;
  value?: number;
}> {
  const lines = content.split("\n");
  const items: Array<{ label: string; desc: string; value?: number }> = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 匹配列表项
    if (trimmed.startsWith("-")) {
      const text = trimmed.replace(/^-\s*/, "");

      // 尝试提取数值
      const valueMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
      const value = valueMatch?.[1] ? parseFloat(valueMatch[1]) : undefined;

      // 提取标签和描述
      const parts = text.split(":");
      const label = (parts[0]?.trim() || text) as string;
      const desc = (parts[1]?.trim() || "") as string;

      items.push({ label, desc, value });
    }
  }

  return items;
}

/**
 * 为数据项选择合适的图标
 */
export function selectIcon(label: string, keywords: string[]): string {
  const lowerLabel = label.toLowerCase();

  // 基于标签内容匹配图标
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lowerLabel.includes(key)) {
      return icon;
    }
  }

  // 基于类别返回默认图标
  if (keywords.includes("sequence")) return "mdi/arrow-right";
  if (keywords.includes("data")) return "mdi/chart-bar";
  if (keywords.includes("list")) return "mdi/check";

  return "mdi/circle"; // 默认图标
}

/**
 * 生成 Infographic DSL
 */
export function generateInfographicDSL(
  template: string,
  data: {
    title?: string;
    desc?: string;
    items: Array<{
      label: string;
      desc: string;
      value?: number;
      icon?: string;
    }>;
  },
  theme?: {
    palette?: string[];
    stylize?: string;
  },
): string {
  const { title, desc, items } = data;

  // 构建 items 部分
  const itemsText = items
    .map((item) => {
      let itemStr = `    - label ${item.label}`;
      if (item.desc) itemStr += `\n      desc ${item.desc}`;
      if (item.value !== undefined) itemStr += `\n      value ${item.value}`;
      if (item.icon) itemStr += `\n      icon ${item.icon}`;
      return itemStr;
    })
    .join("\n");

  // 构建主题部分
  let themeText = "";
  if (theme) {
    themeText = "\ntheme";
    if (theme.palette && theme.palette.length > 0) {
      themeText += `\n  palette ${theme.palette.join(" ")}`;
    }
    if (theme.stylize) {
      themeText += `\n  stylize ${theme.stylize}`;
    }
  } else {
    // 默认调色板
    themeText = "\ntheme\n  palette #3b82f6 #8b5cf6 #f97316 #10b981";
  }

  // 组装 DSL
  let dsl = `infographic ${template}\ndata`;
  if (title) dsl += `\n  title ${title}`;
  if (desc) dsl += `\n  desc ${desc}`;
  dsl += `\n  items\n${itemsText}`;
  dsl += themeText;

  return dsl;
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
