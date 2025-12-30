/**
 * Agent 工具导出文件
 * 统一导出所有可用的 Agent 工具
 */

export { generateOutline } from "./generate-outline";
export { confirmOutline } from "./confirm-outline";
export { generateSlideHTML } from "./generate-slide-html";
export { confirmSlide } from "./confirm-slide";
export { generateInfographicDSL } from "./use-infographic";
export { searchUnsplashImage } from "./search-unsplash-image";
export { getWorkflowState } from "./get-workflow-state";

// 导出类型
export type {
  GenerateOutlineParams,
  ConfirmOutlineParams,
  GenerateSlideHTMLParams,
  ConfirmSlideParams,
  GenerateInfographicDSLParams,
  SearchUnsplashImageParams,
  GetWorkflowStateParams,
} from "../types/workflow";
