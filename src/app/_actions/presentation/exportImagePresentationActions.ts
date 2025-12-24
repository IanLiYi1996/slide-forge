"use server";

import { getPresentation } from "./presentationActions";
import { getTemplate } from "@/lib/presentation/templates";
import PptxGenJS from "pptxgenjs";
import { PDFDocument } from "pdf-lib";

/**
 * Export pure-image presentation as PowerPoint
 */
export async function exportAsPPTX(presentationId: string, fileName: string = "presentation") {
  try {
    // Get presentation data
    const result = await getPresentation(presentationId);

    if (!result.success || !result.presentation) {
      return {
        success: false,
        message: "Presentation not found",
      };
    }

    const presentationContent = result.presentation.presentation?.content as { slides?: string[] } | null;
    const slideUrls = presentationContent?.slides || [];

    if (slideUrls.length === 0) {
      return {
        success: false,
        message: "No slides to export",
      };
    }

    // Get template for placeholder styling
    const templateId = result.presentation.presentation?.theme || "corporate";
    const template = getTemplate(templateId);

    // Create PowerPoint
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = "SlideForge";
    pptx.company = "SlideForge";
    pptx.subject = result.presentation.title || "Presentation";
    pptx.title = result.presentation.title || "Presentation";

    // Add each slide image
    for (let i = 0; i < slideUrls.length; i++) {
      const imageUrl = slideUrls[i];
      if (!imageUrl) continue;

      const slide = pptx.addSlide();

      try {
        // Handle SVG placeholders specially (not supported by pptxgenjs)
        if (imageUrl.includes("svg")) {
          console.log(`[PLACEHOLDER] Converting SVG slide ${i + 1} to text-based PPT slide`);

          // Extract slide number from URL
          const slideMatch = imageUrl.match(/Slide (\d+)/);
          const slideNum = slideMatch ? slideMatch[1] : String(i + 1);

          // Add text content instead of image
          slide.background = { color: template.colors.background.replace("#", "") };

          slide.addText(template.name, {
            x: 1,
            y: 2,
            w: 8,
            h: 1,
            fontSize: 48,
            bold: true,
            color: template.colors.primary.replace("#", ""),
            align: "center",
          });

          slide.addText(`Slide ${slideNum}`, {
            x: 1,
            y: 3,
            w: 8,
            h: 0.8,
            fontSize: 32,
            color: template.colors.secondary.replace("#", ""),
            align: "center",
          });

          slide.addText("🚧 Placeholder Image", {
            x: 1,
            y: 4.5,
            w: 8,
            h: 0.6,
            fontSize: 20,
            color: "999999",
            align: "center",
          });

          continue;
        }

        // If it's a data URL (non-SVG), we can use it directly
        if (imageUrl.startsWith("data:")) {
          slide.addImage({
            data: imageUrl,
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
            sizing: { type: "contain", w: "100%", h: "100%" },
          });
        } else {
          // If it's a regular URL, fetch the image
          const imageResponse = await fetch(imageUrl);
          const imageBlob = await imageResponse.blob();
          const imageBuffer = await imageBlob.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const mimeType = imageBlob.type || "image/png";
          const dataUrl = `data:${mimeType};base64,${base64}`;

          slide.addImage({
            data: dataUrl,
            x: 0,
            y: 0,
            w: "100%",
            h: "100%",
            sizing: { type: "contain", w: "100%", h: "100%" },
          });
        }
      } catch (error) {
        console.error(`Failed to add slide ${i + 1}:`, error);
        // Add error placeholder
        slide.addText(`Failed to load slide ${i + 1}`, {
          x: 1,
          y: 2,
          w: 8,
          h: 1,
          fontSize: 24,
          color: "FF0000",
        });
      }
    }

    // Generate PPTX file
    const pptxData = await pptx.write({ outputType: "base64" });

    return {
      success: true,
      data: pptxData,
      fileName: `${fileName}.pptx`,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  } catch (error) {
    console.error("Export PPTX error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Export failed",
    };
  }
}

/**
 * Export pure-image presentation as PDF
 */
export async function exportAsPDF(presentationId: string, fileName: string = "presentation") {
  try {
    // Get presentation data
    const result = await getPresentation(presentationId);

    if (!result.success || !result.presentation) {
      return {
        success: false,
        message: "Presentation not found",
      };
    }

    const presentationContent = result.presentation.presentation?.content as { slides?: string[] } | null;
    const slideUrls = presentationContent?.slides || [];

    if (slideUrls.length === 0) {
      return {
        success: false,
        message: "No slides to export",
      };
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Standard presentation size (16:9 ratio)
    const pageWidth = 1920;
    const pageHeight = 1080;

    // Add each slide image
    for (let i = 0; i < slideUrls.length; i++) {
      const imageUrl = slideUrls[i];
      if (!imageUrl) continue;

      try {
        let imageBytes: ArrayBuffer;

        // Handle data URLs
        if (imageUrl.startsWith("data:")) {
          const base64Data = imageUrl.split(",")[1];
          if (!base64Data) {
            throw new Error("Invalid data URL");
          }
          imageBytes = Buffer.from(base64Data, "base64");
        } else {
          // Fetch regular URLs
          const imageResponse = await fetch(imageUrl);
          imageBytes = await imageResponse.arrayBuffer();
        }

        // Embed image in PDF
        // For SVG data URLs (placeholder mode), convert to raster for PDF
        if (imageUrl.includes("svg")) {
          console.log(`[PLACEHOLDER] Converting SVG slide ${i + 1} to text-based PDF page`);

          // Create a page with text content instead of trying to embed SVG
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // Extract slide number from SVG content if possible
          const slideMatch = imageUrl.match(/Slide (\d+)/);
          const slideNum = slideMatch ? slideMatch[1] : String(i + 1);

          // Draw placeholder content
          page.drawText(`Slide ${slideNum}`, {
            x: pageWidth / 2 - 100,
            y: pageHeight / 2 + 100,
            size: 48,
          });

          page.drawText("🚧 Placeholder Image", {
            x: pageWidth / 2 - 150,
            y: pageHeight / 2,
            size: 32,
          });

          page.drawText("(yunwu API will generate real images)", {
            x: pageWidth / 2 - 200,
            y: pageHeight / 2 - 50,
            size: 20,
          });

          continue;
        }

        // Handle PNG/JPG images
        let image;
        const mimeType = imageUrl.includes("png") ? "png" : "jpg";

        if (mimeType === "png") {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        // Add page and image
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const imageDims = image.scale(1);
        const scale = Math.min(
          pageWidth / imageDims.width,
          pageHeight / imageDims.height,
        );

        const scaledWidth = imageDims.width * scale;
        const scaledHeight = imageDims.height * scale;

        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;

        page.drawImage(image, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      } catch (error) {
        console.error(`Failed to add slide ${i + 1} to PDF:`, error);
        // Add error page
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawText(`Failed to load slide ${i + 1}`, {
          x: pageWidth / 2 - 100,
          y: pageHeight / 2,
          size: 24,
        });
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return {
      success: true,
      data: pdfBase64,
      fileName: `${fileName}.pdf`,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("Export PDF error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Export failed",
    };
  }
}
