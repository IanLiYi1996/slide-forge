"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { processUploadedFile, PageImage } from "@/lib/document-processor/pdf-utils";
import { useToast } from "@/components/ui/use-toast";

interface DocumentUploaderProps {
  onImagesLoaded: (images: PageImage[]) => void;
}

export function DocumentUploader({ onImagesLoaded }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      console.log("=== handleFile called ===");
      console.log("File:", file.name, "Type:", file.type, "Size:", file.size);

      setIsLoading(true);
      try {
        console.log("Calling processUploadedFile...");
        const images = await processUploadedFile(file);
        console.log("processUploadedFile completed, images:", images.length);

        console.log("Calling onImagesLoaded callback...");
        onImagesLoaded(images);

        toast({
          title: "File loaded successfully",
          description: `${images.length} page${images.length > 1 ? "s" : ""} ready for processing`,
        });
        console.log("Success toast shown");
      } catch (error) {
        console.error("Error in handleFile:", error);
        toast({
          title: "Error loading file",
          description: error instanceof Error ? error.message : "Failed to process file",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        console.log("=== handleFile completed ===");
      }
    },
    [onImagesLoaded, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      console.log("=== handleDrop called ===");
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      console.log("Dropped file:", file?.name);
      if (file) {
        handleFile(file);
      } else {
        console.log("No file in drop event");
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("=== handleFileInput called ===");
      const file = e.target.files?.[0];
      console.log("Selected file:", file?.name);
      if (file) {
        handleFile(file);
      } else {
        console.log("No file selected");
      }
    },
    [handleFile]
  );

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Document Processor</CardTitle>
          <CardDescription className="text-center text-base">
            Upload a PDF or image to process each page with AI-powered instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition-all
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
              ${isLoading ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-primary hover:bg-primary/5"}
            `}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isLoading && document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={handleFileInput}
              disabled={isLoading}
            />

            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <p className="text-lg font-medium">Processing file...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-4 mb-6">
                  <div className="p-4 rounded-full bg-primary/10">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                  <div className="p-4 rounded-full bg-primary/10">
                    <ImageIcon className="h-12 w-12 text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xl font-medium">
                    Drag and drop your file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>

                <div className="mt-6">
                  <Button size="lg" variant="outline">
                    <Upload className="mr-2 h-5 w-5" />
                    Choose File
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Supported formats: PDF, PNG, JPG, JPEG, WEBP
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
