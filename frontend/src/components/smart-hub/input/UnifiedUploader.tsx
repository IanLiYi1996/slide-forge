"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileType,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { processUploadedFile, type PageImage } from "@/lib/document-processor/pdf-utils";
import {
  detectInputType,
  isFileTypeSupported,
  getAcceptedFileTypes,
  getSupportedFileTypesDescription,
} from "@/lib/smart-hub/mode-detector";
import { type InputMetadata } from "@/types/smart-hub";

interface UnifiedUploaderProps {
  onInputChange: (
    input: File | string | null,
    metadata: InputMetadata | null,
    images?: PageImage[]
  ) => void;
  disabled?: boolean;
  initialTab?: "text" | "file";
  placeholder?: string;
}

export function UnifiedUploader({
  onInputChange,
  disabled = false,
  initialTab = "text",
  placeholder = "Enter your content here...",
}: UnifiedUploaderProps) {
  const [activeTab, setActiveTab] = useState<"text" | "file">(initialTab);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleTextChange = useCallback(
    async (text: string) => {
      setTextContent(text);

      if (text.trim().length > 0) {
        const metadata = await detectInputType(text);
        onInputChange(text, metadata);
      } else {
        onInputChange(null, null);
      }
    },
    [onInputChange]
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!isFileTypeSupported(file)) {
        toast({
          title: "Unsupported file type",
          description: `Please upload one of the following: ${getSupportedFileTypesDescription()}`,
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      setSelectedFile(file);

      try {
        // Detect input type
        const metadata = await detectInputType(file);

        // If it's a PDF or image, also process to get page images
        let images: PageImage[] | undefined;
        if (metadata.type === "pdf" || metadata.type === "image") {
          images = await processUploadedFile(file);
          metadata.pageCount = images.length;
        }

        onInputChange(file, metadata, images);

        toast({
          title: "File loaded successfully",
          description: metadata.pageCount
            ? `${metadata.pageCount} page${metadata.pageCount > 1 ? "s" : ""} detected`
            : `Ready to process ${file.name}`,
        });
      } catch (error) {
        console.error("Error processing file:", error);
        toast({
          title: "Error loading file",
          description:
            error instanceof Error ? error.message : "Failed to process file",
          variant: "destructive",
        });
        setSelectedFile(null);
        onInputChange(null, null);
      } finally {
        setIsLoading(false);
      }
    },
    [onInputChange, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    onInputChange(null, null);
  }, [onInputChange]);

  const clearText = useCallback(() => {
    setTextContent("");
    onInputChange(null, null);
  }, [onInputChange]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "text" | "file")}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="text" disabled={disabled || isLoading}>
          <FileType className="w-4 h-4 mr-2" />
          Text Input
        </TabsTrigger>
        <TabsTrigger value="file" disabled={disabled || isLoading}>
          <Upload className="w-4 h-4 mr-2" />
          File Upload
        </TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="mt-0">
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Textarea
                placeholder={placeholder}
                value={textContent}
                onChange={(e) => handleTextChange(e.target.value)}
                disabled={disabled}
                className="min-h-[200px] resize-none"
              />
              {textContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={clearText}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Paste your content or type directly. Markdown formatting is supported.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="file" className="mt-0">
        <Card>
          <CardContent className="pt-6">
            {selectedFile ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {selectedFile.type.startsWith("image/") ? (
                    <ImageIcon className="h-8 w-8 text-primary" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center transition-all
                  ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                  ${isLoading || disabled ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-primary hover:bg-primary/5"}
                `}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() =>
                  !isLoading &&
                  !disabled &&
                  document.getElementById("hub-file-input")?.click()
                }
              >
                <input
                  id="hub-file-input"
                  type="file"
                  accept={getAcceptedFileTypes()}
                  className="hidden"
                  onChange={handleFileInput}
                  disabled={isLoading || disabled}
                />

                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="font-medium">Processing file...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center gap-3 mb-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <FileText className="h-8 w-8 text-primary" />
                      </div>
                      <div className="p-3 rounded-full bg-primary/10">
                        <ImageIcon className="h-8 w-8 text-primary" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="font-medium">Drag and drop your file here</p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                    </div>

                    <Button size="sm" variant="outline" className="mt-4">
                      <Upload className="mr-2 h-4 w-4" />
                      Choose File
                    </Button>

                    <p className="text-xs text-muted-foreground mt-4">
                      {getSupportedFileTypesDescription()}
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
