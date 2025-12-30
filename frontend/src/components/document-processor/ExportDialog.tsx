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
import { Download, FileArchive, Image as ImageIcon, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { useToast } from "@/components/ui/use-toast";

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
  const [exportFormat, setExportFormat] = useState<"zip" | "individual">("zip");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return await response.blob();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === "zip") {
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
          <RadioGroup value={exportFormat} onValueChange={(value) => setExportFormat(value as "zip" | "individual")}>
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
