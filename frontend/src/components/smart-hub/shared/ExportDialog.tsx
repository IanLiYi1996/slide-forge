"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  FileArchive,
  Image as ImageIcon,
  Loader2,
  FileText,
  Presentation,
  FileCode,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/components/ui/use-toast";
import { generatePDFFromImages } from "@/lib/pdf-generator";
import { useUsageTracker } from "@/hooks/useUsageTracker";
import { type HubSession, type HubPage, type ExportFormat, type ProcessingMode } from "@/types/smart-hub";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: HubSession;
  onExportComplete?: (format: ExportFormat) => void;
}

// Define available formats per mode
const MODE_FORMATS: Record<ProcessingMode, ExportFormat[]> = {
  generate: ["pptx", "pdf", "png", "zip"],
  process: ["pdf", "zip", "png"],
  extract: ["markdown", "pdf", "pptx"],
};

const FORMAT_INFO: Record<
  ExportFormat,
  { label: string; description: string; icon: React.ReactNode }
> = {
  pdf: {
    label: "PDF Document",
    description: "Export as a single PDF file",
    icon: <FileText className="h-5 w-5 text-primary" />,
  },
  pptx: {
    label: "PowerPoint",
    description: "Export as editable PPTX presentation",
    icon: <Presentation className="h-5 w-5 text-primary" />,
  },
  png: {
    label: "Individual Images",
    description: "Download each page as a PNG image",
    icon: <ImageIcon className="h-5 w-5 text-primary" />,
  },
  zip: {
    label: "ZIP Archive",
    description: "Download all images in a single ZIP file",
    icon: <FileArchive className="h-5 w-5 text-primary" />,
  },
  markdown: {
    label: "Markdown",
    description: "Export extracted content as Markdown",
    icon: <FileCode className="h-5 w-5 text-primary" />,
  },
};

export function ExportDialog({
  open,
  onOpenChange,
  session,
  onExportComplete,
}: ExportDialogProps) {
  const availableFormats = MODE_FORMATS[session.mode];
  const [exportFormat, setExportFormat] = useState<ExportFormat>(availableFormats[0] ?? 'pdf');
  const [includeOriginals, setIncludeOriginals] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { toast } = useToast();
  const { trackUsage } = useUsageTracker();

  const readyPages = session.pages.filter((p) => p.status === "ready");
  // For process mode, we can export original images even if not processed
  const exportablePages = session.mode === "process"
    ? session.pages.filter((p) => p.imageDataUrl || p.outputImageUrl)
    : readyPages;

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const timestamp = Date.now();
      const baseFileName = session.title.replace(/[^a-zA-Z0-9]/g, "_");

      switch (exportFormat) {
        case "pdf": {
          // Convert pages to the format expected by PDF generator
          const images = session.pages.map((page, index) => ({
            pageNumber: index + 1,
            dataUrl: page.outputImageUrl || page.imageDataUrl || "",
            width: 1920, // Default width
            height: 1080, // Default height
          }));

          const processedImages = new Map<number, string>();
          session.pages.forEach((page, index) => {
            if (page.outputImageUrl) {
              processedImages.set(index + 1, page.outputImageUrl);
            }
          });

          const pdfBlob = await generatePDFFromImages(images, processedImages, {
            quality: "medium",
            preserveOriginalSize: true,
            onProgress: (percent) => setExportProgress(percent),
          });

          saveAs(pdfBlob, `${baseFileName}_${timestamp}.pdf`);

          await trackUsage("EXPORT_PDF", 1, {
            pageCount: session.pages.length,
            mode: session.mode,
          });

          toast({
            title: "PDF export successful",
            description: `${session.pages.length} pages exported to PDF`,
          });
          break;
        }

        case "pptx": {
          // Call API to generate PPTX
          const response = await fetch("/api/smart-hub/export/pptx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: session.sessionId }),
          });

          if (!response.ok) {
            throw new Error("Failed to generate PPTX");
          }

          const blob = await response.blob();
          saveAs(blob, `${baseFileName}_${timestamp}.pptx`);

          await trackUsage("EXPORT_PPTX", 1, {
            pageCount: session.pages.length,
            mode: session.mode,
          });

          toast({
            title: "PowerPoint export successful",
            description: `${session.pages.length} slides exported`,
          });
          break;
        }

        case "zip": {
          const zip = new JSZip();
          let exportedCount = 0;

          for (let i = 0; i < session.pages.length; i++) {
            const page = session.pages[i];
            if (!page) continue;
            setExportProgress(((i + 1) / session.pages.length) * 100);

            // Add processed image if available, otherwise use original
            const primaryImage = page.outputImageUrl || page.imageDataUrl;
            if (primaryImage) {
              const blob = await dataUrlToBlob(primaryImage);
              zip.file(`page_${i + 1}.png`, blob);
              exportedCount++;
            }

            // Optionally add original (only if we exported processed image)
            if (includeOriginals && page.outputImageUrl && page.imageDataUrl && page.imageDataUrl !== page.outputImageUrl) {
              const originalBlob = await dataUrlToBlob(page.imageDataUrl);
              zip.file(`page_${i + 1}_original.png`, originalBlob);
            }
          }

          const zipBlob = await zip.generateAsync({ type: "blob" });
          saveAs(zipBlob, `${baseFileName}_${timestamp}.zip`);

          toast({
            title: "ZIP export successful",
            description: `${exportedCount} images exported`,
          });
          break;
        }

        case "png": {
          for (let i = 0; i < session.pages.length; i++) {
            const page = session.pages[i];
            if (!page) continue;
            const imageUrl = page.outputImageUrl || page.imageDataUrl;

            if (imageUrl) {
              const blob = await dataUrlToBlob(imageUrl);
              saveAs(blob, `${baseFileName}_page_${i + 1}.png`);
            }

            setExportProgress(((i + 1) / session.pages.length) * 100);
          }

          toast({
            title: "Images downloaded",
            description: `${session.pages.length} images saved`,
          });
          break;
        }

        case "markdown": {
          let markdownContent = `# ${session.title}\n\n`;

          session.pages.forEach((page, index) => {
            markdownContent += `## Page ${index + 1}\n\n`;
            if (page.extractedContent) {
              markdownContent += page.extractedContent + "\n\n";
            } else if (page.textContent) {
              markdownContent += page.textContent + "\n\n";
            }
          });

          const blob = new Blob([markdownContent], { type: "text/markdown" });
          saveAs(blob, `${baseFileName}_${timestamp}.md`);

          toast({
            title: "Markdown export successful",
            description: "Content exported as Markdown file",
          });
          break;
        }
      }

      onExportComplete?.(exportFormat);
      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export {session.title}</DialogTitle>
          <DialogDescription>
            {session.mode === "process" ? (
              <>
                {exportablePages.length} pages available
                {readyPages.length > 0 && ` (${readyPages.length} processed)`}
              </>
            ) : (
              <>{readyPages.length} of {session.pages.length} pages ready for export</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={exportFormat}
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
          >
            {availableFormats.map((format) => {
              const info = FORMAT_INFO[format];
              return (
                <div
                  key={format}
                  className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value={format} id={format} />
                  <Label htmlFor={format} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      {info.icon}
                      <div>
                        <p className="font-medium">{info.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {/* Option to include originals (for process mode) */}
          {session.mode === "process" && exportFormat === "zip" && (
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="include-originals"
                checked={includeOriginals}
                onCheckedChange={(checked) =>
                  setIncludeOriginals(checked === true)
                }
              />
              <Label htmlFor="include-originals" className="text-sm">
                Include original images
              </Label>
            </div>
          )}

          {/* Progress bar */}
          {isExporting && exportProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Exporting...</span>
                <span className="font-medium">{Math.round(exportProgress)}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || exportablePages.length === 0}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
