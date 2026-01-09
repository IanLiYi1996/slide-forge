/**
 * 可编辑 PPTX 导出主函数
 * 协调 HTML 解析和 PPTX 生成流程,包含错误处理和回退机制
 */

import { HTMLSlideParser } from "./html-parser";
import { EditablePPTXGenerator } from "./editable-pptx-generator";
import { toast } from "sonner";

/**
 * 导出为可编辑的 PPTX 文件（增强版：返回失败信息）
 */
export async function exportEditablePPTX(
  slides: Array<{ html: string; index: number }>,
  title: string = "Presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<{ blob: Blob; failedImages: string[] }> {
  const parser = new HTMLSlideParser();
  const generator = new EditablePPTXGenerator();

  // 设置演示文稿标题
  generator.setTitle(title);

  // 逐页处理
  for (let i = 0; i < slides.length; i++) {
    const slideData = slides[i];
    if (!slideData) continue;

    // 报告进度
    if (onProgress) {
      onProgress(i + 1, slides.length);
    }

    try {
      // 解析 HTML
      const parsed = parser.parse(slideData.html);

      // 判断是否为首页（index 0 或 1）
      const isFirstSlide = slideData.index === 0 || slideData.index === 1;

      // 生成幻灯片
      await generator.generateSlide(parsed, isFirstSlide);
    } catch (error) {
      console.error(`Failed to export slide ${i + 1}:`, error);

      // 添加错误占位幻灯片
      // 这里可以添加一个简单的错误提示幻灯片
      // 暂时跳过失败的幻灯片,继续处理下一张
    }
  }

  // 生成并返回 Blob
  const pptxBlob = await generator.export();

  // 获取失败的图片列表
  const failedImages = generator.getFailedImages?.() || [];

  return { blob: pptxBlob, failedImages };
}

/**
 * 导出并下载可编辑的 PPTX（增强版：显示图片错误提示）
 * 包含错误处理和自动回退到图片 PPTX
 */
export async function downloadEditablePPTX(
  slides: Array<{ html: string; index: number }>,
  title: string = "presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  try {
    // 尝试导出可编辑 PPTX
    const { blob, failedImages } = await exportEditablePPTX(slides, title, onProgress);

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}-editable.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // ⚠️ 检查是否有图片下载失败
    if (failedImages && failedImages.length > 0) {
      console.warn(
        `[PPTX Export] ${failedImages.length} image(s) failed to download:`,
        failedImages
      );

      // 显示警告提示（多条失败则汇总）
      if (failedImages.length === 1) {
        toast.warning("1 image failed to download", {
          description: "A placeholder image was used instead. Check your exported file.",
          duration: 5000,
        });
      } else {
        toast.warning(`${failedImages.length} images failed to download`, {
          description: `Placeholder images were used instead. Check your exported file.`,
          duration: 5000,
          action: {
            label: "View URLs",
            onClick: () => {
              console.log("Failed image URLs:", failedImages);
              toast.info("Failed URLs logged to console", {
                description: "Open DevTools (F12) to view the list",
              });
            },
          },
        });
      }
    } else {
      // 全部成功
      toast.success("PPTX exported successfully!", {
        description: "All images downloaded correctly",
      });
    }
  } catch (error) {
    console.error("Editable PPTX export failed, falling back to image PPTX:", error);

    // 显示警告
    toast.warning("可编辑导出失败,自动切换到图片模式导出");

    // 回退到图片 PPTX
    const { downloadImagePPTX } = await import("./export-to-pptx");
    await downloadImagePPTX(slides, title, onProgress);
  }
}
