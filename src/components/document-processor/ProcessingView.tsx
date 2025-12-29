"use client";

import { useState, useEffect } from "react";
import { PageImage } from "@/lib/document-processor/pdf-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  Home,
} from "lucide-react";
import { processImageWithYunwu } from "@/lib/document-processor/yunwu-api";
import { useToast } from "@/components/ui/use-toast";
import { ExportDialog } from "./ExportDialog";

interface ProcessingViewProps {
  images: PageImage[];
  processedImages: Map<number, string>;
  onImageProcessed: (pageNumber: number, processedImageUrl: string) => void;
  onReset: () => void;
}

export function ProcessingView({
  images,
  processedImages,
  onImageProcessed,
  onReset,
}: ProcessingViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { toast } = useToast();

  const currentPage = images[currentPageIndex];
  const totalPages = images.length;
  const processedCount = processedImages.size;
  const progress = (processedCount / totalPages) * 100;

  if (!currentPage) {
    return null;
  }

  const currentProcessedImage = processedImages.get(currentPage.pageNumber);

  const handleProcess = async () => {
    if (!instruction.trim()) {
      toast({
        title: "Instruction required",
        description: "Please enter processing instruction",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processImageWithYunwu({
        imageDataUrl: currentPage.dataUrl,
        instruction: instruction.trim(),
        apiKey: "", // API key is handled server-side
      });

      if (result.success && result.processedImageUrl) {
        onImageProcessed(currentPage.pageNumber, result.processedImageUrl);
        toast({
          title: "Image processed",
          description: `Page ${currentPage.pageNumber} has been processed successfully`,
        });
      } else {
        toast({
          title: "Processing failed",
          description: result.error || "Failed to process image",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setInstruction("");
    } else {
      // All pages processed
      toast({
        title: "All pages processed",
        description: "You can now export the processed images",
      });
    }
  };

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const allProcessed = processedCount === totalPages;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Processing Documents</h1>
            <p className="text-sm text-muted-foreground">
              Page {currentPage.pageNumber} of {totalPages}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">
                {processedCount} / {totalPages} processed
              </p>
              <Progress value={progress} className="w-32 h-2 mt-1" />
            </div>
            <Button variant="outline" onClick={onReset}>
              <Home className="mr-2 h-4 w-4" />
              New Upload
            </Button>
            {allProcessed && (
              <Button onClick={() => setShowExportDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                Export All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original Image */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Original Image</CardTitle>
                <CardDescription>Page {currentPage.pageNumber}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative bg-muted rounded-lg overflow-hidden">
                  <img
                    src={currentPage.dataUrl}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Processed Image or Processing Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {currentProcessedImage ? (
                    <>
                      <Check className="h-5 w-5 text-green-500" />
                      Processed Image
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-primary" />
                      Process with AI
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {currentProcessedImage
                    ? "Processing complete"
                    : "Enter instructions to process this page"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentProcessedImage ? (
                  <div className="relative bg-muted rounded-lg overflow-hidden">
                    <img
                      src={currentProcessedImage}
                      alt={`Processed page ${currentPage.pageNumber}`}
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="instruction">Processing Instruction</Label>
                      <Input
                        id="instruction"
                        placeholder="e.g., Enhance colors, add borders, extract text..."
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isProcessing) {
                            handleProcess();
                          }
                        }}
                        disabled={isProcessing}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleProcess}
                      disabled={isProcessing || !instruction.trim()}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Process Image
                        </>
                      )}
                    </Button>
                  </>
                )}

                {currentProcessedImage && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        onImageProcessed(currentPage.pageNumber, "");
                        const newMap = new Map(processedImages);
                        newMap.delete(currentPage.pageNumber);
                        setInstruction("");
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reprocess
                    </Button>
                    {currentPageIndex < totalPages - 1 && (
                      <Button className="flex-1" onClick={handleConfirm}>
                        Confirm & Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentPageIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentPageIndex(index)}
                className={`
                  w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all
                  ${
                    index === currentPageIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : processedImages.has(image.pageNumber)
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-muted-foreground/25 hover:border-primary"
                  }
                `}
              >
                {processedImages.has(image.pageNumber) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentPageIndex === totalPages - 1}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        images={images}
        processedImages={processedImages}
      />
    </div>
  );
}
