/**
 * PNG 导出工具
 * 将幻灯片 HTML 转换为 PNG 图片
 */

import html2canvas from "html2canvas-pro";
import JSZip from "jszip";

/**
 * 导出单个幻灯片为 PNG
 * 使用 iframe 确保脚本正确执行（Infographic 需要）
 */
export async function exportSlideToPNG(
  slideHTML: string,
  filename: string,
): Promise<Blob> {
  // 创建隐藏的 iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "1280px";
  iframe.style.height = "720px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  try {
    // 写入 HTML 到 iframe
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error("Cannot access iframe document");
    }

    doc.open();
    doc.write(slideHTML);
    doc.close();

    // 等待 iframe 内容完全加载和渲染
    await new Promise((resolve) => {
      if (doc.readyState === "complete") {
        resolve(null);
      } else {
        iframe.onload = () => resolve(null);
      }
    });

    // 额外等待 Infographic 渲染（脚本执行需要时间）
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // 查找 slide-container 元素
    const slideContainer = doc.querySelector(".slide-container");
    if (!slideContainer) {
      console.error("Slide container not found, falling back to body");
      throw new Error("Slide container not found in HTML");
    }

    // 检查容器尺寸
    console.log(
      "Capturing slide container:",
      slideContainer.clientWidth,
      "x",
      slideContainer.clientHeight,
    );

    // 使用 html2canvas 捕获幻灯片容器
    const canvas = await html2canvas(slideContainer as HTMLElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: true, // 启用日志便于调试
      useCORS: true,
      allowTaint: true,
      width: 1280,
      height: 720,
      windowWidth: 1280,
      windowHeight: 720,
    });

    console.log("Canvas generated:", canvas.width, "x", canvas.height);

    // 检查 canvas 是否为空
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Canvas has zero dimensions");
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("Blob created, size:", blob.size);
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        "image/png",
        0.95,
      );
    });
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * 等待容器中的内容加载完成
 */
async function waitForContentLoaded(container: HTMLElement): Promise<void> {
  // 等待所有图片加载
  const images = container.querySelectorAll("img");
  const imagePromises = Array.from(images).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = () => resolve(null);
      img.onerror = () => resolve(null); // 即使失败也继续
    });
  });

  await Promise.all(imagePromises);

  // 等待脚本执行（Infographic 初始化）
  const scripts = container.querySelectorAll("script");
  if (scripts.length > 0) {
    // 给脚本足够时间执行
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

/**
 * 导出所有幻灯片为 PNG ZIP 文件
 */
export async function exportAllSlidesToPNGZip(
  slides: Array<{ html: string; index: number }>,
  presentationTitle: string = "presentation",
): Promise<Blob> {
  const zip = new JSZip();

  // 创建进度回调（可选）
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!slide) continue;

    try {
      const blob = await exportSlideToPNG(
        slide.html,
        `slide-${slide.index + 1}.png`,
      );
      zip.file(`slide-${String(slide.index + 1).padStart(2, "0")}.png`, blob);
    } catch (error) {
      console.error(`Failed to export slide ${slide.index + 1}:`, error);
      // 继续导出其他幻灯片
    }
  }

  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * 导出单个幻灯片并下载
 */
export async function downloadSlidePNG(
  slideHTML: string,
  filename: string,
): Promise<void> {
  const blob = await exportSlideToPNG(slideHTML, filename);

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载所有幻灯片的 ZIP
 */
export async function downloadAllSlidesPNGZip(
  slides: Array<{ html: string; index: number }>,
  presentationTitle: string = "presentation",
): Promise<void> {
  const blob = await exportAllSlidesToPNGZip(slides, presentationTitle);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${presentationTitle}-slides.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
