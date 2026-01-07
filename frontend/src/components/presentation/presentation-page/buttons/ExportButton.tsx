"use client";

import { exportAsPDF, exportAsPPTX } from "@/app/_actions/presentation/exportImagePresentationActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Download, FileText, Presentation } from "lucide-react";
import { useState } from "react";

interface ExportButtonProps {
  presentationId: string;
  fileName?: string;
  variant?: "sidebar" | "toolbar"; // Control button style
}

export function ExportButton({
  presentationId,
  fileName = "presentation",
  variant = "sidebar",
}: ExportButtonProps) {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pptx" | "pdf">("pptx");
  const { toast } = useToast();

  const handleExport = async (format: "pptx" | "pdf") => {
    try {
      setIsExporting(true);
      setExportFormat(format);

      let result: Awaited<ReturnType<typeof exportAsPPTX | typeof exportAsPDF>>;

      if (format === "pptx") {
        result = await exportAsPPTX(presentationId, fileName);
      } else {
        result = await exportAsPDF(presentationId, fileName);
      }

      if (!result.success) {
        toast({
          title: "Export Failed",
          description: result.message || "Failed to export presentation",
          variant: "destructive",
        });
        return;
      }

      if (!result.data) {
        toast({
          title: "Export Failed",
          description: "No data returned from export",
          variant: "destructive",
        });
        return;
      }

      // Create blob and download
      const byteCharacters = atob(result.data as string);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName!;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Presentation exported as ${format.toUpperCase()}`,
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      console.error("Error exporting presentation:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
      <DialogTrigger asChild>
        {variant === "sidebar" ? (
          <Button variant="ghost" className="w-full justify-start gap-3">
            <Download className="h-4 w-4" />
            Export
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Presentation</DialogTitle>
          <DialogDescription>
            Choose a format to download your presentation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* PowerPoint Option */}
          <button
            onClick={() => handleExport("pptx")}
            disabled={isExporting}
            className="w-full p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-accent transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <Presentation className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-base mb-1">PowerPoint (.pptx)</h4>
                <p className="text-sm text-muted-foreground">
                  Export as Microsoft PowerPoint presentation with one image per slide
                </p>
              </div>
            </div>
          </button>

          {/* PDF Option */}
          <button
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
            className="w-full p-4 rounded-lg border-2 border-muted hover:border-primary hover:bg-accent transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-base mb-1">PDF Document (.pdf)</h4>
                <p className="text-sm text-muted-foreground">
                  Export as PDF document with one image per page
                </p>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsExportDialogOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
        </DialogFooter>

        {isExporting && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center space-y-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">
                Exporting as {exportFormat.toUpperCase()}...
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
