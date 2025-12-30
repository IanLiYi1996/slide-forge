/**
 * PDF 导出工具
 * 将幻灯片 HTML 转换为 PDF 文件
 */

import { jsPDF } from "jspdf";
import { exportSlideToPNG } from "./export-to-png";

/**
 * 导出为 PDF 文件
 */
export async function exportToPDF(
  slides: Array<{ html: string; index: number }>,
  title: string = "Presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  // 创建 PDF 文档（横向，16:9 比例）
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [1280, 720],
    compress: true,
  });

  // 添加元数据
  pdf.setProperties({
    title: title,
    author: "Slide Forge AI",
    subject: "AI Generated Presentation",
    creator: "Slide Forge",
  });

  // 逐页处理
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!slide) continue;

    // 报告进度
    if (onProgress) {
      onProgress(i + 1, slides.length);
    }

    // 第一页不需要添加新页
    if (i > 0) {
      pdf.addPage([1280, 720], "landscape");
    }

    try {
      // 将 HTML 转为 PNG
      const pngBlob = await exportSlideToPNG(slide.html, "");
      const dataUrl = await blobToDataURL(pngBlob);

      // 添加到 PDF
      pdf.addImage(dataUrl, "PNG", 0, 0, 1280, 720, undefined, "FAST");
    } catch (error) {
      console.error(`Failed to add slide ${i + 1} to PDF:`, error);
      // 添加错误页面
      pdf.setFontSize(24);
      pdf.setTextColor(255, 0, 0);
      pdf.text(`Slide ${i + 1}: Export Error`, 640, 360, { align: "center" });
    }
  }

  return pdf.output("blob");
}

/**
 * 导出并下载 PDF
 */
export async function downloadPDF(
  slides: Array<{ html: string; index: number }>,
  title: string = "presentation",
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const blob = await exportToPDF(slides, title, onProgress);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title}.pdf`;
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
