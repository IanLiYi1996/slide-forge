"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Wand2, Upload, PenTool, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useSmartHubState } from "@/states/smart-hub-state";
import { PageNavigator, PageThumbnails } from "@/components/smart-hub/shared/PageNavigator";
import { ProgressTracker } from "@/components/smart-hub/shared/ProgressTracker";
import { ExportDialog } from "@/components/smart-hub/shared/ExportDialog";
import { ImageAnnotationCanvas } from "@/components/smart-hub/process/ImageAnnotationCanvas";
import { processUploadedFile, type PageImage } from "@/lib/document-processor/pdf-utils";
import { type HubSession } from "@/types/smart-hub";

export default function ProcessPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = params.sessionId as string;

  const {
    currentSession,
    loadSession,
    isLoading,
    error,
    isGeneratingPage,
    currentPageIndex,
    setCurrentPageIndex,
    processPage,
    updateSession,
  } = useSmartHubState();

  const [instruction, setInstruction] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [localSession, setLocalSession] = useState<HubSession | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Annotation mode state
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(null);

  // Load session on mount
  useEffect(() => {
    async function load() {
      const loaded = await loadSession(sessionId);
      if (!loaded) {
        toast({
          title: "Session not found",
          variant: "destructive",
        });
        router.push("/create");
      }
    }
    load();
  }, [sessionId, loadSession, router, toast]);

  // Sync local session state
  useEffect(() => {
    if (currentSession) {
      setLocalSession(currentSession);
    }
  }, [currentSession]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const images = await processUploadedFile(file);

      // Initialize pages from images via API
      const response = await fetch(`/api/smart-hub/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "page_processing",
          inputMetadata: {
            type: file.type.startsWith("image/") ? "image" : "pdf",
            fileName: file.name,
            fileSize: file.size,
            pageCount: images.length,
            hasText: true,
            hasImages: true,
            suggestedMode: "process",
            confidence: 1,
          },
          pages: images.map((img, index) => ({
            id: crypto.randomUUID(),
            index,
            sourceType: "image",
            imageDataUrl: img.dataUrl,
            status: "pending",
            conversationHistory: [],
            modificationCount: 0,
            createdAt: new Date().toISOString(),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save images");
      }

      const data = await response.json();
      setLocalSession(data.session);

      toast({
        title: "File uploaded",
        description: `${images.length} page(s) ready for processing`,
      });
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: "Upload failed",
        description: "Failed to process the file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, toast]);

  const handleProcess = async () => {
    if (!instruction.trim()) {
      toast({
        title: "Please enter an instruction",
        description: "Tell the AI how to modify this page",
        variant: "destructive",
      });
      return;
    }

    // If we have an annotated image, update the page with it first
    if (annotatedImageUrl && localSession) {
      try {
        await fetch(`/api/smart-hub/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: localSession.pages.map((p, i) =>
              i === currentPageIndex
                ? { ...p, imageDataUrl: annotatedImageUrl }
                : p
            ),
          }),
        });
      } catch (err) {
        console.error("Failed to save annotated image:", err);
      }
    }

    const success = await processPage(currentPageIndex, instruction);
    if (success) {
      toast({
        title: "Processing complete",
        description: "Page has been processed",
      });
      // Clear instruction and annotation
      setInstruction("");
      setAnnotatedImageUrl(null);
      setIsAnnotationMode(false);
    }
  };

  // Handle annotation completion
  const handleAnnotationComplete = (annotatedDataUrl: string) => {
    setAnnotatedImageUrl(annotatedDataUrl);
    setIsAnnotationMode(false);
    toast({
      title: "Annotations saved",
      description: "Your annotations will be included when processing",
    });
  };

  const handleProcessAll = async () => {
    if (!instruction.trim() || !localSession) return;

    for (let i = 0; i < localSession.pages.length; i++) {
      const page = localSession.pages[i];
      if (page && page.status !== "ready") {
        setCurrentPageIndex(i);
        await processPage(i, instruction);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !localSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error || "Session not found"}</p>
        <Button variant="outline" onClick={() => router.push("/create")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Hub
        </Button>
      </div>
    );
  }

  const hasPages = localSession.pages.length > 0;
  const currentPage = localSession.pages[currentPageIndex];
  const allPagesReady = localSession.pages.every((p) => p.status === "ready");
  const processedCount = localSession.pages.filter((p) => p.status === "ready").length;

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/create")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {localSession.title}
            </h1>
            <p className="text-sm text-muted-foreground">Process Mode</p>
          </div>
        </div>

        {hasPages && processedCount > 0 && (
          <Button onClick={() => setIsExportOpen(true)}>
            Export ({processedCount}/{localSession.pages.length})
          </Button>
        )}
      </div>

      {/* Progress Tracker */}
      {hasPages && (
        <div className="mb-6">
          <ProgressTracker
            mode="process"
            status={localSession.status}
            currentPageIndex={currentPageIndex}
            totalPages={localSession.pages.length}
          />
        </div>
      )}

      {/* Upload section if no pages */}
      {!hasPages && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a PDF or image to start processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Click to upload</p>
                  <p className="text-sm text-muted-foreground">PDF or image files</p>
                </>
              )}
            </label>
          </CardContent>
        </Card>
      )}

      {/* Processing UI */}
      {hasPages && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Thumbnail sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Pages</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <PageThumbnails
                  pages={localSession.pages}
                  currentIndex={currentPageIndex}
                  onPageChange={setCurrentPageIndex}
                  orientation="vertical"
                  thumbnailSize="sm"
                  className="max-h-[60vh]"
                />
              </CardContent>
            </Card>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Image comparison or Annotation mode */}
            <Card>
              <CardContent className="p-4">
                {isAnnotationMode && currentPage?.imageDataUrl ? (
                  /* Annotation Mode */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Annotation Mode</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAnnotationMode(false)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    <ImageAnnotationCanvas
                      imageDataUrl={annotatedImageUrl || currentPage.imageDataUrl}
                      onAnnotationComplete={handleAnnotationComplete}
                      width={800}
                      height={600}
                    />
                  </div>
                ) : (
                  /* Normal comparison view */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Original */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">
                            {annotatedImageUrl ? "Annotated" : "Original"}
                          </p>
                          {currentPage?.imageDataUrl && !annotatedImageUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsAnnotationMode(true)}
                              className="h-7 text-xs"
                            >
                              <PenTool className="h-3 w-3 mr-1" />
                              Annotate
                            </Button>
                          )}
                          {annotatedImageUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAnnotatedImageUrl(null);
                              }}
                              className="h-7 text-xs text-muted-foreground"
                            >
                              Clear annotations
                            </Button>
                          )}
                        </div>
                        <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                          {(annotatedImageUrl || currentPage?.imageDataUrl) && (
                            <img
                              src={annotatedImageUrl || currentPage?.imageDataUrl}
                              alt="Original"
                              className="w-full h-full object-contain"
                            />
                          )}
                        </div>
                      </div>

                      {/* Processed */}
                      <div>
                        <p className="text-sm font-medium mb-2">Processed</p>
                        <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                          {currentPage?.outputImageUrl ? (
                            <img
                              src={currentPage.outputImageUrl}
                              alt="Processed"
                              className="w-full h-full object-contain"
                            />
                          ) : currentPage?.status === "processing" ? (
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Not yet processed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Annotation hint */}
                    {currentPage?.imageDataUrl && !annotatedImageUrl && (
                      <p className="text-xs text-muted-foreground mt-3">
                        <PenTool className="h-3 w-3 inline mr-1" />
                        Use the Annotate button to highlight areas for AI to focus on
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Instruction input */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Enter instruction (e.g., 'Remove the watermark', 'Translate text to English')"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    disabled={isGeneratingPage}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleProcess();
                      }
                    }}
                  />
                  <Button
                    onClick={handleProcess}
                    disabled={isGeneratingPage || !instruction.trim()}
                  >
                    {isGeneratingPage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Process"
                    )}
                  </Button>
                </div>

                {localSession.pages.length > 1 && (
                  <div className="flex justify-end mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleProcessAll}
                      disabled={isGeneratingPage || !instruction.trim() || allPagesReady}
                    >
                      Apply to All Pages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <PageNavigator
              pages={localSession.pages}
              currentIndex={currentPageIndex}
              onPageChange={setCurrentPageIndex}
              showStatus
              className="justify-center"
            />
          </div>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        session={localSession}
      />
    </div>
  );
}
