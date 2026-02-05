"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Wand2,
  Upload,
  PenTool,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  Grid,
  LayoutDashboard,
  Send,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/components/ui/use-toast";
import { useSmartHubState } from "@/states/smart-hub-state";
import { ExportDialog } from "@/components/smart-hub/shared/ExportDialog";
import { ImageAnnotationCanvas } from "@/components/smart-hub/process/ImageAnnotationCanvas";
import { processUploadedFile } from "@/lib/document-processor/pdf-utils";
import { type HubSession, type HubPage } from "@/types/smart-hub";
import { cn } from "@/lib/utils";

// Available aspect ratios and image sizes
type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
type ImageSize = "1K" | "2K" | "4K";

const ASPECT_RATIOS: { value: AspectRatio; label: string; ratio: number }[] = [
  { value: "1:1", label: "1:1 (Square)", ratio: 1 },
  { value: "4:3", label: "4:3 (Standard)", ratio: 4/3 },
  { value: "3:2", label: "3:2 (Photo)", ratio: 3/2 },
  { value: "16:9", label: "16:9 (Widescreen)", ratio: 16/9 },
  { value: "21:9", label: "21:9 (Ultrawide)", ratio: 21/9 },
  { value: "3:4", label: "3:4 (Portrait)", ratio: 3/4 },
  { value: "2:3", label: "2:3 (Portrait Photo)", ratio: 2/3 },
  { value: "9:16", label: "9:16 (Mobile)", ratio: 9/16 },
  { value: "4:5", label: "4:5 (Instagram)", ratio: 4/5 },
  { value: "5:4", label: "5:4 (Large Format)", ratio: 5/4 },
];

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: "1K", label: "1K (Standard)" },
  { value: "2K", label: "2K (High)" },
  { value: "4K", label: "4K (Ultra)" },
];

// Calculate closest aspect ratio from image dimensions
function detectAspectRatio(width: number, height: number): AspectRatio {
  const imageRatio = width / height;
  let closest: AspectRatio = "16:9";
  let minDiff = Infinity;

  for (const ar of ASPECT_RATIOS) {
    const diff = Math.abs(ar.ratio - imageRatio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ar.value;
    }
  }

  return closest;
}

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
  } = useSmartHubState();

  const [instruction, setInstruction] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [localSession, setLocalSession] = useState<HubSession | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"single" | "gallery">("single");

  // Annotation mode state
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [annotatedImageUrl, setAnnotatedImageUrl] = useState<string | null>(null);

  // Generation config state
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDetectedRatio, setAutoDetectedRatio] = useState<AspectRatio | null>(null);

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

  // Auto-detect aspect ratio from current page's image
  useEffect(() => {
    const currentPage = localSession?.pages[currentPageIndex];
    if (currentPage?.imageDataUrl) {
      const img = new window.Image();
      img.onload = () => {
        const detected = detectAspectRatio(img.naturalWidth, img.naturalHeight);
        setAutoDetectedRatio(detected);
        setAspectRatio(detected);
      };
      img.src = currentPage.imageDataUrl;
    }
  }, [currentPageIndex, localSession?.pages]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const images = await processUploadedFile(file);

      const response = await fetch(`/api/smart-hub/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "page_processing",
          title: file.name.replace(/\.[^/.]+$/, ""),
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

    // Make direct API call with config parameters
    try {
      const page = localSession?.pages[currentPageIndex];
      if (!page?.imageDataUrl) {
        throw new Error("No image to process");
      }

      const response = await fetch("/api/smart-hub/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          pageIndex: currentPageIndex,
          imageDataUrl: annotatedImageUrl || page.imageDataUrl,
          instruction,
          aspectRatio,
          imageSize,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Processing failed");
      }

      const { session } = await response.json();
      setLocalSession(session);

      toast({
        title: "Processing complete",
        description: "Page has been processed",
      });
      setInstruction("");
      setAnnotatedImageUrl(null);
      setIsAnnotationMode(false);
    } catch (err) {
      console.error("Process error:", err);
      toast({
        title: "Processing failed",
        description: err instanceof Error ? err.message : "Failed to process",
        variant: "destructive",
      });
    }
  };

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

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
      setAnnotatedImageUrl(null);
    }
  };

  const goToNextPage = () => {
    if (localSession && currentPageIndex < localSession.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
      setAnnotatedImageUrl(null);
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
  const processedCount = localSession.pages.filter((p) => p.status === "ready").length;
  const completionPercent = hasPages ? Math.round((processedCount / localSession.pages.length) * 100) : 0;

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

        <div className="flex items-center gap-2">
          {hasPages && (
            <>
              {/* View toggle */}
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={viewMode === "single" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("single")}
                >
                  <LayoutDashboard className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "gallery" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("gallery")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={() => setIsExportOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Export {processedCount > 0 ? `(${processedCount})` : ""}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {hasPages && (
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {processedCount}/{localSession.pages.length} processed
          </span>
          {completionPercent === 100 && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              <Check className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
      )}

      {/* Upload section if no pages */}
      {!hasPages && (
        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a PDF or image to start processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center p-16 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <>
                  <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Processing file...</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-10 w-10 text-primary" />
                  </div>
                  <p className="font-semibold text-lg mb-1">Click to upload</p>
                  <p className="text-sm text-muted-foreground">PDF or image files</p>
                </>
              )}
            </label>
          </CardContent>
        </Card>
      )}

      {/* Gallery View */}
      {hasPages && viewMode === "gallery" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Grid className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">All Pages</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Click a page to edit it
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {localSession.pages.map((page, index) => (
                <div
                  key={page.id}
                  className={cn(
                    "group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer",
                    "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
                    "border-2",
                    index === currentPageIndex
                      ? "border-primary ring-4 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => {
                    setCurrentPageIndex(index);
                    setViewMode("single");
                    setAnnotatedImageUrl(null);
                  }}
                >
                  {/* Original image */}
                  {page.imageDataUrl && (
                    <img
                      src={page.imageDataUrl}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Processed overlay */}
                  {page.outputImageUrl && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Check className="h-8 w-8 text-green-400" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  {!page.outputImageUrl && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Wand2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  {/* Page number */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                    {index + 1}
                  </div>

                  {/* Status badge */}
                  {page.status === "ready" && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-500 text-white text-xs">
                      Done
                    </div>
                  )}
                  {page.status === "processing" && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary text-white text-xs flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single Page View */}
      {hasPages && viewMode === "single" && (
        <div className="space-y-4">
          {/* Main editor */}
          <Card>
            <CardContent className="p-6">
              {isAnnotationMode && currentPage?.imageDataUrl ? (
                /* Annotation Mode */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PenTool className="h-4 w-4" />
                      <p className="font-medium">Annotation Mode</p>
                      <span className="text-sm text-muted-foreground">
                        Draw on the image to highlight areas
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setIsAnnotationMode(false)}>
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
                /* Normal view */
                <div className="space-y-4">
                  {/* Page indicator */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Page {currentPageIndex + 1} of {localSession.pages.length}
                      </span>
                      {currentPage?.status === "ready" && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Processed
                        </Badge>
                      )}
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPrevPage}
                        disabled={currentPageIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={currentPageIndex === localSession.pages.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Image comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-muted-foreground">
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
                            onClick={() => setAnnotatedImageUrl(null)}
                            className="h-7 text-xs"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden border">
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
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Processed Result</p>
                      <div className="aspect-[4/3] bg-muted rounded-xl overflow-hidden border flex items-center justify-center">
                        {currentPage?.outputImageUrl ? (
                          <img
                            src={currentPage.outputImageUrl}
                            alt="Processed"
                            className="w-full h-full object-contain"
                          />
                        ) : currentPage?.status === "processing" || isGeneratingPage ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Processing...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Sparkles className="h-8 w-8 opacity-30" />
                            <span className="text-sm">Enter instruction to process</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instruction input */}
          {!isAnnotationMode && (
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter instruction (e.g., 'Remove watermark', 'Translate to English', 'Enhance quality')"
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
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Process
                      </>
                    )}
                  </Button>
                  {currentPage?.outputImageUrl && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInstruction("Regenerate with a different approach");
                        handleProcess();
                      }}
                      disabled={isGeneratingPage}
                      title="Regenerate"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Generation Settings */}
                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="mt-3 pt-3 border-t">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Settings2 className="h-3.5 w-3.5" />
                        <span>Generation Settings</span>
                        {autoDetectedRatio && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Auto: {autoDetectedRatio}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {aspectRatio} · {imageSize}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Aspect Ratio</Label>
                        <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASPECT_RATIOS.map((ar) => (
                              <SelectItem key={ar.value} value={ar.value} className="text-xs">
                                {ar.label}
                                {ar.value === autoDetectedRatio && " (Original)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Image Size</Label>
                        <Select value={imageSize} onValueChange={(v) => setImageSize(v as ImageSize)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_SIZES.map((size) => (
                              <SelectItem key={size.value} value={size.value} className="text-xs">
                                {size.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {autoDetectedRatio && aspectRatio !== autoDetectedRatio && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <span>⚠</span>
                        Output ratio differs from original ({autoDetectedRatio})
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {localSession.pages.length > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Tip: Use the same instruction to process all pages at once
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleProcessAll}
                      disabled={isGeneratingPage || !instruction.trim() || processedCount === localSession.pages.length}
                    >
                      Apply to All Pages
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Page thumbnails strip */}
          {localSession.pages.length > 1 && (
            <div className="flex justify-center gap-2 py-2 overflow-x-auto">
              {localSession.pages.map((page, index) => (
                <button
                  key={page.id}
                  className={cn(
                    "flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all",
                    "border-2",
                    index === currentPageIndex
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border opacity-60 hover:opacity-100"
                  )}
                  onClick={() => {
                    setCurrentPageIndex(index);
                    setAnnotatedImageUrl(null);
                  }}
                >
                  {page.imageDataUrl && (
                    <img
                      src={page.imageDataUrl}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {page.status === "ready" && (
                    <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
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
