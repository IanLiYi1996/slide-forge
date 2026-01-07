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
  const { quality = 'medium', orientation = 'portrait', onProgress } = options;

  // Create PDF document
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: quality === 'low',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Process each image
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const dataUrl = processedImages.get(image.pageNumber) || image.dataUrl;

    // Add new page for subsequent images
    if (i > 0) {
      pdf.addPage();
    }

    try {
      // Get image properties
      const imgProps = pdf.getImageProperties(dataUrl);

      // Calculate dimensions to fit page while maintaining aspect ratio
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);

      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      // Center the image on the page
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      // Add image to PDF
      pdf.addImage(dataUrl, 'PNG', x, y, scaledWidth, scaledHeight, undefined, quality === 'high' ? 'FAST' : 'SLOW');

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
  return pdf.output('blob');
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
