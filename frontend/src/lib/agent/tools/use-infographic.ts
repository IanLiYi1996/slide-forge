/**
 * Infographic DSL 生成工具
 * 分析内容并生成对应的 AntV Infographic DSL
 */

import type {
  GenerateInfographicDSLParams,
  ToolResult,
  InfographicDSLResult,
} from "../types/workflow";
import {
  detectContentType,
  selectTemplate,
  extractItems,
  selectIcon,
  generateInfographicDSL as generateDSL,
  extractTitle,
  extractDesc,
} from "./utils/infographic-templates";

export async function generateInfographicDSL(
  params: GenerateInfographicDSLParams,
): Promise<ToolResult<InfographicDSLResult>> {
  try {
    const { content, chartType } = params;

    // 1. 分析内容类型
    const contentType = detectContentType(content);

    // 2. 选择模板
    const template =
      chartType && chartType !== "auto"
        ? chartType
        : selectTemplate(contentType.category, contentType.itemCount);

    // 3. 提取数据项
    const rawItems = extractItems(content);

    // 4. 为每个项添加图标
    const items = rawItems.map((item) => ({
      ...item,
      icon: selectIcon(item.label, contentType.keywords),
    }));

    // 5. 提取标题和描述
    const title = extractTitle(content);
    const desc = extractDesc(content);

    // 6. 生成 DSL
    const dsl = generateDSL(
      template,
      {
        title,
        desc,
        items,
      },
      {
        palette: ["#3b82f6", "#8b5cf6", "#f97316", "#10b981"],
      },
    );

    return {
      success: true,
      data: {
        dsl,
        template,
      },
      message: `Generated ${template} infographic with ${items.length} items`,
    };
  } catch (error) {
    console.error("Error generating infographic DSL:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate infographic DSL",
    };
  }
}
