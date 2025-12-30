/**
 * PPTX 导出工具
 * 将幻灯片 HTML 转换为 PowerPoint 文件
 */

import PptxGenJS from "pptxgenjs";
import { exportSlideToPNG } from "./export-to-png";

/**
 * 导出为图片 PPTX 文件 (图片模式,保留作为备选)
 */
export async function exportImagePPTX(
  slides: Array<{ html: string; index: number }>,
  title: string = "Presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  const pptx = new PptxGenJS();

  // 设置演示文稿属性
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Slide Forge AI";
  pptx.title = title;
  pptx.subject = "AI Generated Presentation";

  // 逐页处理
  for (let i = 0; i < slides.length; i++) {
    const slideData = slides[i];
    if (!slideData) continue;

    // 报告进度
    if (onProgress) {
      onProgress(i + 1, slides.length);
    }

    try {
      // 创建新幻灯片
      const slide = pptx.addSlide();

      // 将 HTML 转为 PNG 图片
      const pngBlob = await exportSlideToPNG(slideData.html, "");
      const dataUrl = await blobToDataURL(pngBlob);

      // 将图片添加到幻灯片
      slide.addImage({
        data: dataUrl,
        x: 0,
        y: 0,
        w: "100%",
        h: "100%",
      });
    } catch (error) {
      console.error(`Failed to export slide ${i + 1} to PPTX:`, error);
      // 添加错误占位幻灯片
      const errorSlide = pptx.addSlide();
      errorSlide.addText(`Slide ${i + 1}: Export Error`, {
        x: 1,
        y: 2.5,
        w: 8,
        h: 1,
        fontSize: 24,
        color: "FF0000",
        align: "center",
      });
    }
  }

  // 生成并返回 Blob
  const pptxBlob = await pptx.write({ outputType: "blob" });
  return pptxBlob as Blob;
}

/**
 * 导出并下载图片 PPTX (图片模式,保留作为备选)
 */
export async function downloadImagePPTX(
  slides: Array<{ html: string; index: number }>,
  title: string = "presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const blob = await exportImagePPTX(slides, title, onProgress);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 辅助函数：Blob 转 Data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
