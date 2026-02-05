"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, FileOutput, Upload, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useSmartHubState } from "@/states/smart-hub-state";
import { PageNavigator, PageThumbnails } from "@/components/smart-hub/shared/PageNavigator";
import { ProgressTracker } from "@/components/smart-hub/shared/ProgressTracker";
import { ExportDialog } from "@/components/smart-hub/shared/ExportDialog";
import { processUploadedFile } from "@/lib/document-processor/pdf-utils";
import { type HubSession } from "@/types/smart-hub";

export default function ExtractPage() {
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
  } = useSmartHubState();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [localSession, setLocalSession] = useState<HubSession | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

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
          status: "extracting",
          inputMetadata: {
            type: file.type.startsWith("image/") ? "image" : "pdf",
            fileName: file.name,
            fileSize: file.size,
            pageCount: images.length,
            hasText: true,
            hasImages: true,
            suggestedMode: "extract",
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
        description: `${images.length} page(s) ready for extraction`,
      });
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, toast]);

  const handleExtractAll = async () => {
    if (!localSession) return;

    setIsExtracting(true);
    try {
      // Call extraction API for each page
      const response = await fetch("/api/smart-hub/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          extractAll: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Extraction failed");
      }

      const data = await response.json();
      setLocalSession(data.session);

      toast({
        title: "Extraction complete",
        description: "Content has been extracted from all pages",
      });
    } catch (err) {
      console.error("Extraction error:", err);
      toast({
        title: "Extraction failed",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConvertToSlides = async () => {
    if (!localSession) return;

    try {
      // Redirect to generate mode with extracted content
      const extractedContent = localSession.pages
        .map((p) => p.extractedContent)
        .filter(Boolean)
        .join("\n\n");

      // Create a new generate session with the extracted content
      const response = await fetch("/api/smart-hub/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          title: `Slides from ${localSession.title}`,
          inputText: extractedContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      router.push(`/create/${data.session.sessionId}/generate`);
    } catch (err) {
      toast({
        title: "Conversion failed",
        variant: "destructive",
      });
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
  const extractedCount = localSession.pages.filter((p) => p.extractedContent).length;
  const allExtracted = extractedCount === localSession.pages.length && hasPages;

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
              <FileOutput className="h-5 w-5" />
              {localSession.title}
            </h1>
            <p className="text-sm text-muted-foreground">Extract Mode</p>
          </div>
        </div>

        {hasPages && (
          <div className="flex gap-2">
            {allExtracted && (
              <Button variant="outline" onClick={handleConvertToSlides}>
                <Presentation className="h-4 w-4 mr-2" />
                Convert to Slides
              </Button>
            )}
            <Button onClick={() => setIsExportOpen(true)}>
              Export
            </Button>
          </div>
        )}
      </div>

      {/* Progress Tracker */}
      {hasPages && (
        <div className="mb-6">
          <ProgressTracker
            mode="extract"
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
              Upload a PDF or document to extract content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                accept=".pdf,.docx,image/*"
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
                  <p className="text-sm text-muted-foreground">PDF, DOCX, or image files</p>
                </>
              )}
            </label>
          </CardContent>
        </Card>
      )}

      {/* Extraction UI */}
      {hasPages && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Thumbnail sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Pages ({extractedCount}/{localSession.pages.length})</CardTitle>
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
            <Tabs defaultValue="source" className="w-full">
              <TabsList>
                <TabsTrigger value="source">Source Image</TabsTrigger>
                <TabsTrigger value="extracted">Extracted Content</TabsTrigger>
              </TabsList>

              <TabsContent value="source">
                <Card>
                  <CardContent className="p-4">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                      {currentPage?.imageDataUrl && (
                        <img
                          src={currentPage.imageDataUrl}
                          alt={`Page ${currentPageIndex + 1}`}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="extracted">
                <Card>
                  <CardContent className="p-4">
                    <div className="min-h-[300px] p-4 bg-muted/50 rounded-lg">
                      {currentPage?.extractedContent ? (
                        <div className="prose prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {currentPage.extractedContent}
                          </pre>
                        </div>
                      ) : currentPage?.status === "processing" ? (
                        <div className="flex items-center justify-center h-[300px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                          <FileText className="h-12 w-12 mb-2" />
                          <p>Content not yet extracted</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={handleExtractAll}
                disabled={isExtracting || allExtracted}
                size="lg"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : allExtracted ? (
                  "All Content Extracted"
                ) : (
                  "Extract All Content"
                )}
              </Button>
            </div>

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
