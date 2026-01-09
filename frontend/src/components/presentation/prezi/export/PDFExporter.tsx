/**
 * PDFExporter Component
 *
 * Exports Prezi presentation as PDF with snapshots of each keyframe.
 * Captures the canvas at each keyframe position and generates a multi-page PDF.
 */

"use client";

import React, { useState } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileDown, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { type PreziPDFExportOptions } from "@/types/prezi-types";

interface PDFExporterProps {
  presentationTitle?: string;
}

/**
 * PDFExporter component
 */
const PDFExporter: React.FC<PDFExporterProps> = ({
  presentationTitle = "Prezi Presentation",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [paperSize, setPaperSize] = useState<"A4" | "16:9" | "4:3">("16:9");

  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const activePath = useActivePath();
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);

  // Handle PDF export
  const handleExport = async () => {
    if (!canvasData || !activePath || activePath.keyframes.length === 0) {
      alert("No keyframes to export");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      // Determine PDF dimensions based on paper size
      const dimensions = getPDFDimensions(paperSize);
      const pdf = new jsPDF({
        orientation: dimensions.orientation,
        unit: "px",
        format: [dimensions.width, dimensions.height],
      });

      const keyframes = activePath.keyframes;
      const totalKeyframes = keyframes.length;

      // Capture each keyframe
      for (let i = 0; i < totalKeyframes; i++) {
        const keyframe = keyframes[i]!;

        // Update progress
        setProgress(Math.round(((i + 1) / totalKeyframes) * 100));

        // Move camera to keyframe position
        updateCamera(keyframe.camera);

        // Wait for camera to update and render
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capture canvas
        const canvasElement = document.querySelector("canvas");
        if (canvasElement) {
          const canvas = await html2canvas(canvasElement, {
            backgroundColor: canvasData.canvas.backgroundColor,
            scale: 2, // Higher quality
          });

          const imgData = canvas.toDataURL("image/png");

          // Add page (except for first page)
          if (i > 0) {
            pdf.addPage([dimensions.width, dimensions.height]);
          }

          // Add image to PDF
          pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            dimensions.width,
            dimensions.height
          );

          // Add keyframe title as text overlay (optional)
          if (keyframe.title) {
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text(
              keyframe.title,
              dimensions.width - 10,
              dimensions.height - 10,
              { align: "right" }
            );
          }
        }
      }

      // Save PDF
      const fileName = `${presentationTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
      pdf.save(fileName);

      setProgress(100);
      alert(`PDF exported successfully: ${fileName}`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  // Get PDF dimensions based on paper size
  const getPDFDimensions = (size: "A4" | "16:9" | "4:3") => {
    switch (size) {
      case "A4":
        return { width: 595, height: 842, orientation: "portrait" as const };
      case "16:9":
        return { width: 1920, height: 1080, orientation: "landscape" as const };
      case "4:3":
        return { width: 1024, height: 768, orientation: "landscape" as const };
      default:
        return { width: 1920, height: 1080, orientation: "landscape" as const };
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Export as PDF</h3>
        <p className="mb-4 text-xs text-gray-600">
          Capture each keyframe as a page in the PDF
        </p>
      </div>

      {/* Paper size selection */}
      <div className="space-y-2">
        <Label className="text-xs">Paper Size</Label>
        <RadioGroup value={paperSize} onValueChange={(v) => setPaperSize(v as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="16:9" id="16:9" />
            <Label htmlFor="16:9" className="text-sm font-normal">
              16:9 (Widescreen)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="4:3" id="4:3" />
            <Label htmlFor="4:3" className="text-sm font-normal">
              4:3 (Standard)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="A4" id="A4" />
            <Label htmlFor="A4" className="text-sm font-normal">
              A4 (Portrait)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || !activePath || activePath.keyframes.length === 0}
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting... {progress}%
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </>
        )}
      </Button>

      {!activePath || activePath.keyframes.length === 0 ? (
        <p className="text-xs text-gray-500">
          Create keyframes in Path mode to export
        </p>
      ) : (
        <p className="text-xs text-gray-600">
          Will export {activePath.keyframes.length} page
          {activePath.keyframes.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

export default PDFExporter;
