/**
 * PDF Generation Utilities
 *
 * Provides functions to generate PDFs from images and slides using jsPDF.
 */

import jsPDF from 'jspdf';

export interface PageImage {
  pageNumber: number;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface SlideImage {
  id: string;
  imageUrl: string;
  title?: string;
}

export interface PDFGenerationOptions {
  quality?: 'low' | 'medium' | 'high';
  orientation?: 'portrait' | 'landscape';
  includePageNumbers?: boolean;
  onProgress?: (percent: number) => void;
  preserveOriginalSize?: boolean; // Keep original image dimensions
}

/**
 * Generate PDF from images (Document Processor)
 *
 * @param images - Array of page images
 * @param processedImages - Map of processed images by page number
 * @param options - PDF generation options
 * @returns PDF blob
 */
export async function generatePDFFromImages(
  images: PageImage[],
  processedImages: Map<number, string>,
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const { quality = 'medium', preserveOriginalSize = true, onProgress } = options;

  // Initialize PDF (will be reconfigured for each page if preserveOriginalSize is true)
  let pdf: jsPDF | null = null;

  // Process each image
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (!image) continue;
    const dataUrl = processedImages.get(image.pageNumber) || image.dataUrl;

    try {
      // Get image properties
      const imgProps = pdf?.getImageProperties(dataUrl) || await getImageProperties(dataUrl);
      const imgWidthPx = imgProps.width;
      const imgHeightPx = imgProps.height;

      if (preserveOriginalSize) {
        // Convert pixels to mm (96 DPI standard: 1 inch = 25.4mm, 96px = 1 inch)
        const pxToMm = 25.4 / 96;
        const pageWidthMm = imgWidthPx * pxToMm;
        const pageHeightMm = imgHeightPx * pxToMm;

        if (i === 0) {
          // Create PDF with first image size
          pdf = new jsPDF({
            orientation: imgWidthPx > imgHeightPx ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pageWidthMm, pageHeightMm],
            compress: quality === 'low',
          });
        } else {
          // Add page with this image's size
          pdf!.addPage([pageWidthMm, pageHeightMm]);
        }

        // Add image at full size (0, 0, full width, full height)
        pdf!.addImage(
          dataUrl,
          'PNG',
          0,
          0,
          pageWidthMm,
          pageHeightMm,
          undefined,
          quality === 'high' ? 'FAST' : 'SLOW'
        );
      } else {
        // Legacy mode: fit to A4 page
        if (i === 0) {
          pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: quality === 'low',
          });
        } else {
          pdf!.addPage();
        }

        const pageWidth = pdf!.internal.pageSize.getWidth();
        const pageHeight = pdf!.internal.pageSize.getHeight();

        // Calculate dimensions to fit page while maintaining aspect ratio
        const ratio = Math.min(pageWidth / imgWidthPx, pageHeight / imgHeightPx);
        const scaledWidth = imgWidthPx * ratio;
        const scaledHeight = imgHeightPx * ratio;

        // Center the image on the page
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        // Add image to PDF
        pdf!.addImage(
          dataUrl,
          'PNG',
          x,
          y,
          scaledWidth,
          scaledHeight,
          undefined,
          quality === 'high' ? 'FAST' : 'SLOW'
        );
      }

      // Report progress
      if (onProgress) {
        onProgress(((i + 1) / images.length) * 100);
      }

      // Release event loop every 10 pages
      if (i % 10 === 0 && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error(`Failed to add image ${image.pageNumber} to PDF:`, error);
      // Continue with other images
    }
  }

  // Generate and return blob
  if (!pdf) {
    throw new Error('Failed to generate PDF: no pages created');
  }
  return pdf.output('blob');
}

/**
 * Helper function to get image properties
 */
async function getImageProperties(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = dataUrl;
  });
}

/**
 * Generate PDF from slides (Presentation)
 *
 * @param slides - Array of slide images
 * @param options - PDF generation options
 * @returns PDF blob
 */
export async function generatePDFFromSlides(
  slides: SlideImage[],
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const {
    quality = 'medium',
    orientation = 'landscape',
    includePageNumbers = false,
    onProgress,
  } = options;

  // Create PDF document in landscape mode for slides
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: quality === 'low',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Filter out slides without images
  const validSlides = slides.filter((slide) => slide.imageUrl);

  if (validSlides.length === 0) {
    throw new Error('No valid slides with images found');
  }

  // Process each slide
  for (let i = 0; i < validSlides.length; i++) {
    const slide = validSlides[i];
    if (!slide) continue;

    // Add new page for subsequent slides
    if (i > 0) {
      pdf.addPage();
    }

    try {
      // Add slide image - fill entire page
      pdf.addImage(
        slide.imageUrl,
        'PNG',
        0,
        0,
        pageWidth,
        pageHeight,
        undefined,
        quality === 'high' ? 'FAST' : 'SLOW'
      );

      // Add page numbers if requested
      if (includePageNumbers) {
        pdf.setFontSize(10);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `${i + 1} / ${validSlides.length}`,
          pageWidth - 20,
          pageHeight - 10,
          { align: 'right' }
        );
      }

      // Report progress
      if (onProgress) {
        onProgress(((i + 1) / validSlides.length) * 100);
      }

      // Release event loop every 5 slides
      if (i % 5 === 0 && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error(`Failed to add slide ${slide.id} to PDF:`, error);
      // Continue with other slides
    }
  }

  // Generate and return blob
  return pdf.output('blob');
}

/**
 * Estimate PDF file size (rough approximation)
 *
 * @param imageCount - Number of images
 * @param quality - PDF quality
 * @returns Estimated size in bytes
 */
export function estimatePDFSize(
  imageCount: number,
  quality: 'low' | 'medium' | 'high' = 'medium'
): number {
  // Rough estimates based on typical image sizes
  const sizePerPage = {
    low: 100 * 1024, // ~100KB per page
    medium: 300 * 1024, // ~300KB per page
    high: 800 * 1024, // ~800KB per page
  };

  return imageCount * sizePerPage[quality];
}

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Convert data URL to blob
 *
 * @param dataUrl - Data URL string
 * @returns Blob
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
