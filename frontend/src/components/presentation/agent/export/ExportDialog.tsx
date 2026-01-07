"use client";

/**
 * 导出对话框组件
 * 提供 PNG、PPTX、PDF 三种导出选项
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SlideData } from "@/lib/agent/types/workflow";
import { Download, FileImage, FileText, Presentation, Loader2, LayoutGrid, Code } from "lucide-react";
import { downloadAllSlidesPNGZip } from "@/lib/presentation/export-to-png";
import { downloadEditablePPTX } from "@/lib/presentation/export-editable-pptx";
import { downloadImagePPTX } from "@/lib/presentation/export-to-pptx";
import { downloadPDF } from "@/lib/presentation/export-to-pdf";
import { downloadAllSlidesAsHTML } from "@/lib/presentation/export-simple";
import { SlidesPreviewDialog } from "../SlidesPreviewDialog";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: SlideData[];
  title: string;
}

export function ExportDialog({
  open,
  onOpenChange,
  slides,
  title,
}: ExportDialogProps) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const [exportType, setExportType] = useState<string>("");

  const handleExport = async (type: "png" | "pptx-editable" | "pptx-image" | "pdf" | "html") => {
    setExporting(true);
    setExportType(type.toUpperCase());
    setExportProgress(0);
    setExportTotal(slides.length);

    try {
      const slidesData = slides
        .filter((s) => s.html)
        .map((s) => ({
          html: s.html!,
          index: s.index,
        }));

      if (slidesData.length === 0) {
        toast.error("No slides available to export");
        return;
      }

      const onProgress = (current: number, total: number) => {
        setExportProgress(current);
        setExportTotal(total);
      };

      switch (type) {
        case "png":
          await downloadAllSlidesPNGZip(slidesData, title);
          toast.success("PNG files exported successfully!");
          break;

        case "pptx-editable":
          await downloadEditablePPTX(slidesData, title, onProgress);
          toast.success("Editable PPTX file exported successfully!");
          break;

        case "pptx-image":
          await downloadImagePPTX(slidesData, title, onProgress);
          toast.success("Image PPTX file exported successfully!");
          break;

        case "pdf":
          await downloadPDF(slidesData, title, onProgress);
          toast.success("PDF file exported successfully!");
          break;

        case "html":
          await downloadAllSlidesAsHTML(slidesData, title);
          toast.success(
            "HTML files downloaded! Open in browser and use Ctrl+P to print as PDF.",
          );
          break;
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(
        `Failed to export as ${type.toUpperCase()}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportTotal(0);
      setExportType("");
    }
  };

  const validSlidesCount = slides.filter((s) => s.html).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle>Export Presentation</DialogTitle>
              <DialogDescription>
                Choose your export format. {validSlidesCount} of {slides.length} slides are ready.
              </DialogDescription>
            </div>
            {validSlidesCount > 0 && (
              <SlidesPreviewDialog
                slides={slides}
                trigger={
                  <Button variant="ghost" size="sm" className="gap-2 -mt-1">
                    <LayoutGrid className="h-4 w-4" />
                    Preview
                  </Button>
                }
              />
            )}
          </div>
        </DialogHeader>

        {exporting ? (
          <div className="py-8">
            <div className="flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Exporting as {exportType}...
            </p>
            <Progress
              value={(exportProgress / exportTotal) * 100}
              className="w-full"
            />
            <p className="text-center text-xs text-muted-foreground mt-2">
              Processing slide {exportProgress} of {exportTotal}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 py-4">
            {/* PNG Export */}
            <Button
              variant="outline"
              className="justify-start h-auto py-3 w-full"
              onClick={() => handleExport("png")}
              disabled={validSlidesCount === 0}
            >
              <div className="flex items-start gap-3 text-left w-full min-w-0">
                <FileImage className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">PNG Images (ZIP)</div>
                  <div className="text-xs text-muted-foreground break-words">
                    High-quality PNG images in a ZIP file
                  </div>
                </div>
              </div>
            </Button>

            {/* Editable PPTX Export (NEW) */}
            <Button
              variant="outline"
              className="justify-start h-auto py-3 w-full border-green-200 bg-green-50/50 dark:bg-green-950/20"
              onClick={() => handleExport("pptx-editable")}
              disabled={validSlidesCount === 0}
            >
              <div className="flex items-start gap-3 text-left w-full min-w-0">
                <Presentation className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    PowerPoint (Editable Text)
                    <span className="ml-2 text-[10px] bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded font-medium">
                      NEW
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground break-words">
                    Editable text with HTML styling preserved
                  </div>
                </div>
              </div>
            </Button>

            {/* Image PPTX Export (Backup) */}
            <Button
              variant="outline"
              className="justify-start h-auto py-3 w-full"
              onClick={() => handleExport("pptx-image")}
              disabled={validSlidesCount === 0}
            >
              <div className="flex items-start gap-3 text-left w-full min-w-0">
                <Presentation className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">PowerPoint (Image)</div>
                  <div className="text-xs text-muted-foreground break-words">
                    Image-based PPTX (fallback option)
                  </div>
                </div>
              </div>
            </Button>

            {/* PDF Export */}
            <Button
              variant="outline"
              className="justify-start h-auto py-3 w-full"
              onClick={() => handleExport("pdf")}
              disabled={validSlidesCount === 0}
            >
              <div className="flex items-start gap-3 text-left w-full min-w-0">
                <FileText className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">PDF Document</div>
                  <div className="text-xs text-muted-foreground break-words">
                    PDF with preserved styling
                  </div>
                </div>
              </div>
            </Button>

            {/* HTML Export (Backup) */}
            <Button
              variant="outline"
              className="justify-start h-auto py-3 w-full border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"
              onClick={() => handleExport("html")}
              disabled={validSlidesCount === 0}
            >
              <div className="flex items-start gap-3 text-left w-full min-w-0">
                <Code className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">HTML Files (Manual Print)</div>
                  <div className="text-xs text-muted-foreground break-words">
                    Download HTML, open in browser, press Ctrl+P for PDF
                  </div>
                </div>
              </div>
            </Button>
          </div>
        )}

        {validSlidesCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No slides available to export. Please generate slides first.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
