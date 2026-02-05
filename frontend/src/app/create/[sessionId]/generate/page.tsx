"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Sparkles, Settings2, Send, RotateCcw, MessageSquare, Plus, Trash2, ChevronUp, ChevronDown, Grid, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useSmartHubState } from "@/states/smart-hub-state";
import { PageNavigator } from "@/components/smart-hub/shared/PageNavigator";
import { ProgressTracker } from "@/components/smart-hub/shared/ProgressTracker";
import { ExportDialog } from "@/components/smart-hub/shared/ExportDialog";
import { GenerateConfigDialog } from "@/components/smart-hub/shared/GenerateConfigDialog";
import { SlideGallery } from "@/components/smart-hub/shared/SlideGallery";
import { type HubSession, type GenerateConfig } from "@/types/smart-hub";
import { DEFAULT_GENERATE_CONFIG } from "@/types/smart-hub";

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = params.sessionId as string;

  const {
    currentSession,
    loadSession,
    outline,
    setOutline,
    isLoading,
    error,
    isGeneratingOutline,
    isGeneratingPage,
    currentPageIndex,
    setCurrentPageIndex,
    generateOutline,
    confirmOutline,
    generatePage,
  } = useSmartHubState();

  const [inputText, setInputText] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [localSession, setLocalSession] = useState<HubSession | null>(null);
  const [generateConfig, setGenerateConfig] = useState<GenerateConfig>(DEFAULT_GENERATE_CONFIG);

  // Slide modification state
  const [modificationInput, setModificationInput] = useState("");
  const [isModifying, setIsModifying] = useState(false);

  // View mode: 'single' for single slide view, 'gallery' for all slides grid
  const [viewMode, setViewMode] = useState<"single" | "gallery">("single");

  // Load session on mount
  useEffect(() => {
    async function load() {
      const loaded = await loadSession(sessionId);
      if (!loaded) {
        toast({
          title: "Session not found",
          description: "The session you're looking for doesn't exist",
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
      if (currentSession.outline) {
        setOutline(currentSession.outline, currentSession.outlineTitle || null);
      }
      if (currentSession.inputText) {
        setInputText(currentSession.inputText);
      }
      if (currentSession.generateConfig) {
        setGenerateConfig(currentSession.generateConfig);
      }
    }
  }, [currentSession, setOutline]);

  const handleGenerateOutline = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Please enter content",
        description: "Enter some text to generate an outline from",
        variant: "destructive",
      });
      return;
    }

    const success = await generateOutline(inputText, generateConfig);
    if (success) {
      toast({
        title: "Outline generated",
        description: "Review and edit the outline, then confirm to generate slides",
      });
    }
  };

  const handleConfirmOutline = async () => {
    const success = await confirmOutline();
    if (success) {
      // Start generating first slide
      await generatePage(0);
    }
  };

  const handleGenerateSlide = async (index: number) => {
    await generatePage(index);
  };

  const handleGenerateAllSlides = async () => {
    for (let i = 0; i < outline.length; i++) {
      setCurrentPageIndex(i);
      await generatePage(i);
    }
  };

  // Handle slide modification
  const handleModifySlide = async () => {
    if (!modificationInput.trim() || !localSession) return;

    setIsModifying(true);
    try {
      const response = await fetch("/api/smart-hub/generate/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: localSession.sessionId,
          pageIndex: currentPageIndex,
          modification: modificationInput,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to modify slide");
      }

      const data = await response.json();
      setLocalSession(data.session);
      setModificationInput("");
      toast({
        title: "Slide modified",
        description: `Modification #${data.modificationCount} applied successfully`,
      });
    } catch (error) {
      console.error("Failed to modify slide:", error);
      toast({
        title: "Modification failed",
        description: "Could not apply the modification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsModifying(false);
    }
  };

  // Handle config change with persistence
  const handleConfigChange = async (newConfig: GenerateConfig) => {
    setGenerateConfig(newConfig);

    // Save to backend immediately
    if (localSession) {
      try {
        const response = await fetch(`/api/smart-hub/session/${localSession.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generateConfig: newConfig,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setLocalSession(data.session);
        }
      } catch (error) {
        console.error("Failed to save config:", error);
      }
    }
  };

  // Handle slide regeneration
  const handleRegenerateSlide = async () => {
    if (!localSession) return;

    setIsModifying(true);
    try {
      const response = await fetch("/api/smart-hub/generate/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: localSession.sessionId,
          pageIndex: currentPageIndex,
          modification: "Regenerate this slide with a fresh design",
          regenerate: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate slide");
      }

      const data = await response.json();
      setLocalSession(data.session);
      toast({
        title: "Slide regenerated",
        description: "A new version of the slide has been created",
      });
    } catch (error) {
      console.error("Failed to regenerate slide:", error);
      toast({
        title: "Regeneration failed",
        description: "Could not regenerate the slide. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsModifying(false);
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

  const isOutlinePhase = localSession.status === "idle" || localSession.status === "outline_generation";
  const isSlidePhase = localSession.status === "slide_generation" || localSession.status === "completed";
  const allSlidesReady = localSession.pages.every((p) => p.status === "ready");

  return (
    <div className="container mx-auto max-w-5xl py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/create")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {localSession.title}
            </h1>
            <p className="text-sm text-muted-foreground">Generate Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle - only show in slide phase */}
          {isSlidePhase && localSession.pages.length > 0 && (
            <div className="flex items-center border rounded-lg p-1">
              <Button
                variant={viewMode === "single" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("single")}
                title="Single slide view"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "gallery" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("gallery")}
                title="Gallery view"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsConfigOpen(true)}
            title="Generation Settings"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          {allSlidesReady && (
            <Button onClick={() => setIsExportOpen(true)}>
              Export Presentation
            </Button>
          )}
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="mb-8">
        <ProgressTracker
          mode="generate"
          status={localSession.status}
          currentPageIndex={currentPageIndex}
          totalPages={localSession.pages.length || outline.length}
        />
      </div>

      {/* Outline Phase */}
      {isOutlinePhase && (
        <div className="space-y-6">
          {/* Text Input */}
          <Card>
            <CardHeader>
              <CardTitle>Your Content</CardTitle>
              <CardDescription>
                Enter the text you want to transform into a presentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your content here or describe what you want to present..."
                className="min-h-[200px]"
                disabled={isGeneratingOutline}
              />

              {/* Config Summary */}
              <div className="flex flex-wrap items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground">Settings:</span>
                <span className="text-xs bg-background px-2 py-1 rounded border">
                  {generateConfig.numberOfSlides} slides
                </span>
                <span className="text-xs bg-background px-2 py-1 rounded border">
                  {generateConfig.aspectRatio}
                </span>
                <span className="text-xs bg-background px-2 py-1 rounded border">
                  {generateConfig.imageSize}
                </span>
                <span className="text-xs bg-background px-2 py-1 rounded border capitalize">
                  {generateConfig.style}
                </span>
                <span className="text-xs bg-background px-2 py-1 rounded border">
                  {generateConfig.language === "en-US" ? "English" :
                   generateConfig.language === "zh-CN" ? "Chinese" : generateConfig.language}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setIsConfigOpen(true)}
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleGenerateOutline}
                  disabled={isGeneratingOutline || !inputText.trim()}
                >
                  {isGeneratingOutline ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Outline"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Outline Editor */}
          {outline.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Presentation Outline</CardTitle>
                    <CardDescription>
                      Review and edit the outline. Each item will become a slide.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOutline = [...outline, `Slide ${outline.length + 1}: New Slide\n\n// NARRATIVE GOAL (叙事目标)\n[描述这张幻灯片的目的]\n\n// KEY CONTENT (关键内容)\n- 要点 1\n- 要点 2\n\n// VISUAL (视觉画面)\n[描述视觉元素]\n\n// LAYOUT (布局结构)\n[描述布局]`];
                      setOutline(newOutline, localSession.outlineTitle || null);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Slide
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {outline.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 group">
                      <div className="flex flex-col gap-1 pt-2">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        {/* Move and Delete buttons */}
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => {
                              const newOutline = [...outline];
                              const temp = newOutline[index];
                              newOutline[index] = newOutline[index - 1] ?? '';
                              newOutline[index - 1] = temp ?? '';
                              setOutline(newOutline, localSession.outlineTitle || null);
                            }}
                            title="Move up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === outline.length - 1}
                            onClick={() => {
                              const newOutline = [...outline];
                              const temp = newOutline[index];
                              newOutline[index] = newOutline[index + 1] ?? '';
                              newOutline[index + 1] = temp ?? '';
                              setOutline(newOutline, localSession.outlineTitle || null);
                            }}
                            title="Move down"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            disabled={outline.length <= 1}
                            onClick={() => {
                              const newOutline = outline.filter((_, i) => i !== index);
                              setOutline(newOutline, localSession.outlineTitle || null);
                            }}
                            title="Delete slide"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={item}
                        onChange={(e) => {
                          const newOutline = [...outline];
                          newOutline[index] = e.target.value;
                          setOutline(newOutline, localSession.outlineTitle || null);
                        }}
                        className="flex-1 min-h-[120px] font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    {outline.length} slides in outline
                  </p>
                  <Button onClick={handleConfirmOutline}>
                    Confirm & Generate Slides
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Slide Generation Phase */}
      {isSlidePhase && localSession.pages.length > 0 && (
        <div className="space-y-6">
          {/* Gallery View */}
          {viewMode === "gallery" && (
            <Card>
              <CardContent className="p-6">
                <SlideGallery
                  pages={localSession.pages}
                  currentIndex={currentPageIndex}
                  onSlideClick={(index) => {
                    setCurrentPageIndex(index);
                    setViewMode("single");
                  }}
                  title={localSession.title}
                />
              </CardContent>
            </Card>
          )}

          {/* Single Slide View */}
          {viewMode === "single" && (
            <>
              {/* Current Slide Preview */}
              <Card>
                <CardContent className="p-6">
                  <div className="aspect-video max-h-[60vh] w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center relative mx-auto">
                    {localSession.pages[currentPageIndex]?.outputImageUrl ? (
                      <>
                        <img
                          src={localSession.pages[currentPageIndex].outputImageUrl}
                          alt={`Slide ${currentPageIndex + 1}`}
                          className="w-full h-full object-contain"
                        />
                        {/* Modification count badge */}
                        {localSession.pages[currentPageIndex]?.modificationCount > 0 && (
                          <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground px-2 py-1 rounded-full text-xs font-medium">
                            {localSession.pages[currentPageIndex].modificationCount} edits
                          </div>
                        )}
                      </>
                    ) : localSession.pages[currentPageIndex]?.status === "processing" || isModifying ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {isModifying ? "Applying modification..." : "Generating slide..."}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-muted-foreground">
                          {localSession.pages[currentPageIndex]?.textContent || `Slide ${currentPageIndex + 1}`}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateSlide(currentPageIndex)}
                          disabled={isGeneratingPage}
                        >
                          Generate This Slide
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Slide Modification Controls - Show when slide is ready */}
                  {localSession.pages[currentPageIndex]?.outputImageUrl && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Modify this slide</span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={modificationInput}
                          onChange={(e) => setModificationInput(e.target.value)}
                          placeholder="e.g., Make the title larger, change background color to blue..."
                          disabled={isModifying}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleModifySlide();
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          onClick={handleModifySlide}
                          disabled={isModifying || !modificationInput.trim()}
                          title="Apply modification"
                        >
                          {isModifying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleRegenerateSlide}
                          disabled={isModifying}
                          title="Regenerate slide with fresh design"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Describe what changes you want to make to this slide. Press Enter to apply.
                      </p>
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
              />
            </>
          )}

          {/* Generate All Button - show in both views */}
          {!allSlidesReady && (
            <div className="flex justify-center">
              <Button
                onClick={handleGenerateAllSlides}
                disabled={isGeneratingPage}
                size="lg"
              >
                {isGeneratingPage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Slides...
                  </>
                ) : (
                  "Generate All Remaining Slides"
                )}
              </Button>
            </div>
          )}

          {/* Show Gallery hint when all slides are ready and in single view */}
          {allSlidesReady && viewMode === "single" && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setViewMode("gallery")}
                className="gap-2"
              >
                <Grid className="h-4 w-4" />
                View All Slides
              </Button>
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

      {/* Config Dialog */}
      <GenerateConfigDialog
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        config={generateConfig}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
