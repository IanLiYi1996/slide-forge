"use client";

import { Button } from "@/components/ui/button";
import { parseFile } from "@/lib/file-parsers";
import { usePresentationState } from "@/states/presentation-state";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageConfigDialog } from "./ImageConfigDialog";
import { WebSearchToggle } from "./WebSearchToggle";

export function PresentationInput({
  handleGenerate,
}: {
  handleGenerate: () => void;
}) {
  const { presentationInput, setPresentationInput, setShowTemplates } =
    usePresentationState();

  // File upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const text = await parseFile(file);
      setPresentationInput(text);
      setUploadedFile(file);
      toast.success(`File uploaded: ${file.name}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to process file",
      );
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      void handleFileUpload(files[0]);
    }
    // Reset input value to allow same file upload
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      await handleFileUpload(files[0]);
    }
  };

  // Handle clear file
  const handleClearFile = () => {
    setUploadedFile(null);
    setPresentationInput("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Create Presentation</h1>
          <p className="text-sm text-muted-foreground">
            Describe your topic and let AI generate stunning slides
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ImageConfigDialog />
          <Button
            variant="outline"
            onClick={() => setShowTemplates(true)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            主题风格
          </Button>
        </div>
      </div>

      {/* File upload section */}
      <div className="space-y-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          accept=".txt,.md,.docx,.pdf"
          className="hidden"
        />

        {/* File info badge (if file uploaded) */}
        {uploadedFile && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm bg-muted rounded-md">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{uploadedFile.name}</span>
            <span className="text-muted-foreground">
              ({formatFileSize(uploadedFile.size)})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFile}
              className="ml-auto h-6 w-6 p-0"
              disabled={isProcessingFile}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Textarea with drag and drop */}
        <div
          className="relative group"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <textarea
            value={presentationInput}
            onChange={(e) => setPresentationInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Describe your topic or paste your content here. Our AI will structure it into a compelling presentation."
            className="h-40 w-full resize-none rounded-lg border border-border bg-card px-4 py-3.5 pb-14 text-base text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessingFile}
          />

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-20 pointer-events-none">
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium text-primary">
                  Drop your file here
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported: .txt, .md, .docx, .pdf
                </p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessingFile && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                <p className="text-sm font-medium">Processing file...</p>
              </div>
            </div>
          )}

          <div className="absolute flex justify-between items-center bottom-3 inset-x-3 z-10">
            <p className="text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px] border border-border">
                Ctrl
              </kbd>{" "}
              +{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px] border border-border">
                Enter
              </kbd>{" "}
              to generate
            </p>
            <WebSearchToggle />
          </div>
        </div>

        {/* Upload button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload File
          </Button>
          <span className="text-xs text-muted-foreground">
            .txt, .md, .docx, .pdf (max 16MB)
          </span>
        </div>
      </div>
    </div>
  );
}
