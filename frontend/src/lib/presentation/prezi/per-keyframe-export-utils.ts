/**
 * Per-Keyframe Export Utilities
 *
 * Provides utilities for exporting individual keyframes as:
 * - PNG images (high quality snapshots)
 * - HTML files (interactive single-page)
 * - GIF animations (transition animations)
 * - ZIP packages (batch downloads)
 */

import html2canvas from "html2canvas-pro";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { type PreziCanvasData, type PathKeyframe, type PreziElement } from "@/types/prezi-types";
import { waitForRenderComplete } from "./export-utils";
import { generateStandaloneHTML } from "./html-player-template";

/**
 * Filter elements by keyframe visibility
 */
export const filterElementsByKeyframe = (
  elements: Record<string, PreziElement>,
  keyframe: PathKeyframe
): Record<string, PreziElement> => {
  const visibleIds = keyframe.visibleElements || [];

  return Object.fromEntries(
    Object.entries(elements).filter(([id, _]) => visibleIds.includes(id))
  );
};

/**
 * Export keyframes as PNG images
 */
export const exportKeyframesAsPNG = async (
  keyframes: PathKeyframe[],
  canvasData: PreziCanvasData,
  updateCamera: (camera: any) => void,
  updateElement: (id: string, updates: any) => void,
  options: {
    resolution: { width: number; height: number };
    scale?: number;
    packageAsZIP: boolean;
  },
  onProgress?: (progress: number, current: number, total: number) => void
): Promise<void> => {
  const files: Array<{ name: string; blob: Blob }> = [];
  const scale = options.scale || 2;

  for (let i = 0; i < keyframes.length; i++) {
    const keyframe = keyframes[i];
    if (!keyframe) continue;

    // Update progress
    if (onProgress) {
      onProgress((i / keyframes.length) * 100, i + 1, keyframes.length);
    }

    // 1. Update camera to keyframe position
    updateCamera(keyframe.camera);

    // 2. Update element visibility (only show elements in this keyframe)
    Object.keys(canvasData.elements).forEach((elementId) => {
      const shouldBeVisible = keyframe.visibleElements?.includes(elementId) || false;
      updateElement(elementId, { visible: shouldBeVisible });
    });

    // 3. Wait for render to stabilize
    await waitForRenderComplete(2000);

    // 4. Capture canvas as image
    const canvasElement = document.querySelector("canvas");
    if (!canvasElement) {
      throw new Error("Canvas element not found");
    }

    const canvas = await html2canvas(canvasElement, {
      scale,
      width: options.resolution.width,
      height: options.resolution.height,
      backgroundColor: null,
    });

    // 5. Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to create blob"));
      }, "image/png");
    });

    // 6. Generate filename
    const sanitizedTitle = (keyframe.title || "untitled")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const fileName = `frame-${keyframe.order + 1}-${sanitizedTitle}.png`;

    files.push({ name: fileName, blob });
  }

  // Update progress to 100%
  if (onProgress) {
    onProgress(100, keyframes.length, keyframes.length);
  }

  // 7. Package and download
  if (options.packageAsZIP && files.length > 1) {
    await createZipAndDownload(files, `keyframes_${Date.now()}.zip`);
  } else {
    // Download individually
    files.forEach((file) => {
      saveAs(file.blob, file.name);
    });
  }
};

/**
 * Export keyframes as HTML files
 */
export const exportKeyframesAsHTML = async (
  keyframes: PathKeyframe[],
  canvasData: PreziCanvasData,
  presentationTitle: string,
  options: {
    theme: "light" | "dark";
    packageAsZIP: boolean;
  },
  onProgress?: (progress: number, current: number, total: number) => void
): Promise<void> => {
  const files: Array<{ name: string; blob: Blob }> = [];

  for (let i = 0; i < keyframes.length; i++) {
    const keyframe = keyframes[i];
    if (!keyframe) continue;

    // Update progress
    if (onProgress) {
      onProgress((i / keyframes.length) * 100, i + 1, keyframes.length);
    }

    // Create single-keyframe canvas data
    const singleKeyframeData: PreziCanvasData = {
      ...canvasData,
      elements: filterElementsByKeyframe(canvasData.elements, keyframe),
      paths: [
        {
          id: "single-frame-path",
          name: keyframe.title || `Frame ${keyframe.order + 1}`,
          keyframes: [keyframe],
          loop: false,
        },
      ],
      activePath: "single-frame-path",
    };

    // Generate HTML template (using existing generateStandaloneHTML function)
    const html = generateStandaloneHTML(
      singleKeyframeData,
      keyframe.title || `Frame ${keyframe.order + 1}`
    );

    // Convert to blob
    const blob = new Blob([html], { type: "text/html" });

    // Generate filename
    const sanitizedTitle = (keyframe.title || "untitled")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const fileName = `frame-${keyframe.order + 1}-${sanitizedTitle}.html`;

    files.push({ name: fileName, blob });
  }

  // Update progress to 100%
  if (onProgress) {
    onProgress(100, keyframes.length, keyframes.length);
  }

  // Package and download
  if (options.packageAsZIP && files.length > 1) {
    await createZipAndDownload(files, `${presentationTitle}_keyframes_html_${Date.now()}.zip`);
  } else {
    // Download individually
    files.forEach((file) => {
      saveAs(file.blob, file.name);
    });
  }
};

/**
 * Create ZIP file and trigger download
 */
export const createZipAndDownload = async (
  files: Array<{ name: string; blob: Blob }>,
  zipName: string
): Promise<void> => {
  const zip = new JSZip();

  // Add all files
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });

  // Add README
  const readme = `
Prezi Keyframe Export
=====================

This ZIP contains ${files.length} exported keyframes.

Files included:
${files.map((f) => `- ${f.name}`).join("\n")}

Generated: ${new Date().toISOString()}

---
Created with Prezi Presentation Editor
`;

  zip.file("README.txt", readme.trim());

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Trigger download
  saveAs(zipBlob, zipName);
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  saveAs(blob, filename);
};
