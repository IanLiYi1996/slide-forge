"use client";

import { useState } from "react";
import { PageImage } from "@/lib/document-processor/pdf-utils";
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
import { Download, FileArchive, Image as ImageIcon, Loader2, FileText } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/components/ui/use-toast";
import { generatePDFFromImages } from "@/lib/pdf-generator";
import { useUsageTracker } from "@/hooks/useUsageTracker";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: PageImage[];
  processedImages: Map<number, string>;
}

export function ExportDialog({
  open,
  onOpenChange,
  images,
  processedImages,
}: ExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<"zip" | "pdf" | "individual">("zip");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { toast } = useToast();
  const { trackUsage } = useUsageTracker();

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      if (exportFormat === "pdf") {
        // Export as PDF (preserves original image dimensions)
        const pdfBlob = await generatePDFFromImages(
          images,
          processedImages,
          {
            quality: 'medium',
            preserveOriginalSize: true, // Keep original image dimensions
            onProgress: (percent) => setExportProgress(percent),
          }
        );

        saveAs(pdfBlob, `document_${Date.now()}.pdf`);

        // Track PDF export usage
        await trackUsage('EXPORT_PDF', 1, {
          pageCount: images.length,
          processedCount: processedImages.size,
        });

        toast({
          title: "PDF export successful",
          description: `${images.length} pages exported to PDF`,
        });
      } else if (exportFormat === "zip") {
        // Export as ZIP - mixed mode (processed + original)
        const zip = new JSZip();

        for (const image of images) {
          const processedUrl = processedImages.get(image.pageNumber);
          const exportUrl = processedUrl || image.dataUrl; // Fallback to original

          const blob = await dataUrlToBlob(exportUrl);
          const suffix = processedUrl ? 'processed' : 'original';
          zip.file(`page_${image.pageNumber}_${suffix}.png`, blob);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `images_${Date.now()}.zip`);

        const originalCount = images.length - processedImages.size;
        toast({
          title: "Export successful",
          description: `${images.length} images exported (${processedImages.size} processed, ${originalCount} original)`,
        });
      } else {
        // Export individually - mixed mode (processed + original)
        for (const image of images) {
          const processedUrl = processedImages.get(image.pageNumber);
          const exportUrl = processedUrl || image.dataUrl; // Fallback to original

          const blob = await dataUrlToBlob(exportUrl);
          const suffix = processedUrl ? 'processed' : 'original';
          saveAs(blob, `page_${image.pageNumber}_${suffix}.png`);
        }

        const originalCount = images.length - processedImages.size;
        toast({
          title: "Export successful",
          description: `${images.length} images downloaded (${processedImages.size} processed, ${originalCount} original)`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export images",
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
          <DialogTitle>Export Processed Images</DialogTitle>
          <DialogDescription>
            Choose how you want to export your {processedImages.size} processed images
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as "zip" | "pdf" | "individual")}>
            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="pdf" id="pdf" />
              <Label htmlFor="pdf" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">PDF Document</p>
                    <p className="text-sm text-muted-foreground">
                      Export all images as a single PDF file
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="zip" id="zip" />
              <Label htmlFor="zip" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileArchive className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">ZIP Archive</p>
                    <p className="text-sm text-muted-foreground">
                      Download all images in a single ZIP file
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="individual" id="individual" />
              <Label htmlFor="individual" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Individual Images</p>
                    <p className="text-sm text-muted-foreground">
                      Download each image separately
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {isExporting && exportProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Generating PDF...</span>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
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
