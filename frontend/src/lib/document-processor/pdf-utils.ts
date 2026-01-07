"use client";

import * as pdfjsLib from "pdfjs-dist";

// Set worker path - using local file for best reliability
if (typeof window !== "undefined") {
  // Use local worker file from public directory (most reliable)
  // This file is copied during build from node_modules/pdfjs-dist/build/
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  console.log("PDF.js worker initialized:", pdfjsLib.GlobalWorkerOptions.workerSrc);
  console.log("PDF.js version:", pdfjsLib.version);
}

export interface PageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Convert a PDF file to an array of image data URLs
 */
export async function convertPdfToImages(file: File): Promise<PageImage[]> {
  try {
    console.log("Starting PDF conversion for:", file.name, "size:", file.size);

    const arrayBuffer = await file.arrayBuffer();
    console.log("ArrayBuffer created, loading PDF document...");

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);

    const images: PageImage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to get canvas context");
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise;

      const dataUrl = canvas.toDataURL("image/png");
      images.push({
        pageNumber: pageNum,
        dataUrl,
        width: viewport.width,
        height: viewport.height,
      });

      console.log(`Page ${pageNum} converted successfully`);
    }

    console.log(`All ${images.length} pages converted successfully`);
    return images;
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw error;
  }
}

/**
 * Convert an image file to a data URL
 */
export async function convertImageToDataUrl(file: File): Promise<PageImage> {
  console.log("Converting image to data URL:", file.name, "type:", file.type);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        console.log("Image loaded successfully:", img.width, "x", img.height);
        resolve({
          pageNumber: 1,
          dataUrl: e.target?.result as string,
          width: img.width,
          height: img.height,
        });
      };
      img.onerror = (error) => {
        console.error("Error loading image:", error);
        reject(error);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Process uploaded file (PDF or image) and return array of page images
 */
export async function processUploadedFile(file: File): Promise<PageImage[]> {
  console.log("Processing uploaded file:", file.name, "type:", file.type, "size:", file.size);

  if (file.type === "application/pdf") {
    console.log("File identified as PDF, converting to images...");
    return await convertPdfToImages(file);
  } else if (file.type.startsWith("image/")) {
    console.log("File identified as image, converting to data URL...");
    const image = await convertImageToDataUrl(file);
    return [image];
  } else {
    const errorMsg = `Unsupported file type: ${file.type}. Please upload a PDF or image file.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}
