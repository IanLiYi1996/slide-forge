"use client";

import { generateSlideImageAction } from "@/app/_actions/image/generate-slide-image";
import { updatePresentation, getPresentation } from "@/app/_actions/presentation/presentationActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePresentationState } from "@/states/presentation-state";
import { type SlideImage } from "@/types/presentation-types";
import { Check, Loader2, RefreshCw, Sparkles, X, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SlideBySlideGeneratorProps {
  outline: string[]; // Array of outline topics
  templateId: string;
  onComplete: (slides: SlideImage[]) => void;
}

export function SlideBySlideGenerator({
  outline,
  templateId,
  onComplete,
}: SlideBySlideGeneratorProps) {
  const router = useRouter();
  const { customThemePrompt, imageModel } = usePresentationState();
  const [slides, setSlides] = useState<SlideImage[]>(() =>
    outline.map((content, index) => ({
      id: `slide-${index}`,
      index,
      outlineContent: content,
      status: "pending" as const,
      conversationHistory: [],
      modificationCount: 0,
    })),
  );

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestored, setIsRestored] = useState(false); // Track if slides were restored from database

  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const completedCount = slides.filter((s) => s.status === "ready").length;

  // Generate image for current slide
  const generateCurrentSlide = async (isModification = false) => {
    if (!currentSlide) return;

    setIsGenerating(true);

    try {
      const result = await generateSlideImageAction(
        currentSlide.outlineContent,
        templateId,
        imageModel, // Use user-configured image settings from state
        currentSlide.conversationHistory,
        isModification ? modificationPrompt : undefined,
        customThemePrompt, // Pass custom theme prompt
      );

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "Failed to generate slide");
      }

      // Update slide state
      setSlides((prev) =>
        prev.map((slide) =>
          slide.index === currentSlideIndex
            ? {
                ...slide,
                imageUrl: result.imageUrl,
                status: "ready" as const,
                conversationHistory: result.conversationHistory || [],
                modificationCount: slide.modificationCount + 1,
                generatedAt: new Date(),
              }
            : slide,
        ),
      );

      if (isModification) {
        toast.success("Slide modified!");
        setModificationPrompt("");
      } else {
        toast.success(`Slide ${currentSlideIndex + 1} generated!`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate";

      // Update slide error state
      setSlides((prev) =>
        prev.map((slide) =>
          slide.index === currentSlideIndex
            ? {
                ...slide,
                status: "error" as const,
                error: message,
              }
            : slide,
        ),
      );

      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle confirm and move to next slide
  const handleConfirm = () => {
    if (!currentSlide?.imageUrl) {
      toast.error("Please generate the slide first");
      return;
    }

    if (isLastSlide) {
      // All slides completed
      onComplete(slides);
    } else {
      // Move to next slide
      setCurrentSlideIndex((prev) => prev + 1);
      setModificationPrompt("");
    }
  };

  // Load saved slide images from database on mount
  useEffect(() => {
    const loadSavedImages = async () => {
      const { currentPresentationId } = usePresentationState.getState();
      if (!currentPresentationId) {
        setIsRestored(true); // Mark as restored even if no data
        return;
      }

      try {
        const result = await getPresentation(currentPresentationId);

        if (result.success && result.presentation?.presentation) {
          const presentation = result.presentation.presentation as any;
          const savedSlideImages = presentation.slideImages as Record<string, any>;

          if (!savedSlideImages) {
            setIsRestored(true); // No saved data, mark as restored
            return;
          }

          console.log("Loading saved slide images from database:", Object.keys(savedSlideImages).length);

          // Restore saved images to slides state
          setSlides((prev) =>
            prev.map((slide) => {
              const savedData = savedSlideImages[slide.id];
              if (savedData) {
                return {
                  ...slide,
                  imageUrl: savedData.imageUrl,
                  status: "ready" as const,
                  conversationHistory: savedData.conversationHistory || [],
                  modificationCount: savedData.modificationCount || 0,
                };
              }
              return slide;
            })
          );

          toast.success("Previous images restored");
        }
      } catch (error) {
        console.error("Failed to load saved images:", error);
      } finally {
        // Always mark as restored, even if there was an error
        setIsRestored(true);
      }
    };

    void loadSavedImages();
  }, []); // Only run once on mount

  // Auto-generate first slide on mount (only if not restored or if first slide is still pending)
  useEffect(() => {
    // Wait for restoration to complete
    if (!isRestored) return;

    // Only auto-generate if the first slide is still pending
    if (currentSlideIndex === 0 && currentSlide?.status === "pending") {
      const timer = setTimeout(() => {
        generateCurrentSlide();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isRestored, currentSlide?.status]); // Depend on isRestored and slide status

  // Save to database when slides change (debounced)
  useEffect(() => {
    const { currentPresentationId } = usePresentationState.getState();
    if (!currentPresentationId) return;

    // Check if any slides have images to save
    const hasImagesToSave = slides.some(
      (slide) => slide.imageUrl && slide.conversationHistory.length > 0
    );

    if (!hasImagesToSave) return;

    // Debounce save to avoid too frequent saves
    const timer = setTimeout(() => {
      // Build slideImages data
      const slideImagesData: Record<string, any> = {};
      slides.forEach((slide) => {
        if (slide.imageUrl && slide.conversationHistory.length > 0) {
          slideImagesData[slide.id] = {
            imageUrl: slide.imageUrl,
            conversationHistory: slide.conversationHistory,
            modificationCount: slide.modificationCount,
          };
        }
      });

      // Save to database in background
      void updatePresentation({
        id: currentPresentationId,
        slideImages: slideImagesData,
      })
        .then(() => {
          console.log("Slide images auto-saved to database");
        })
        .catch((err) => {
          console.error("Failed to auto-save slide images:", err);
        });
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [slides]); // Save when slides change

  if (!currentSlide) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No slides to generate</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/30 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b bg-background/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <h2 className="text-lg font-bold mb-1">Slide Generation</h2>
          <p className="text-sm text-muted-foreground">
            {completedCount} / {slides.length} completed
          </p>
        </div>

        {/* Slides List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {slides.map((slide) => (
            <button
              key={slide.id}
              onClick={() => {
                setCurrentSlideIndex(slide.index);
                setModificationPrompt("");
              }}
              disabled={isGenerating}
              className={`
                w-full rounded-lg border-2 transition-all overflow-hidden
                ${
                  slide.index === currentSlideIndex
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-muted hover:border-primary/50"
                }
                ${isGenerating ? "opacity-50" : ""}
              `}
            >
              {/* Slide Preview */}
              <div className="aspect-video bg-card relative">
                {slide.imageUrl ? (
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${slide.index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    {slide.status === "generating" ? (
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : slide.status === "error" ? (
                      <X className="h-6 w-6 text-red-500" />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">
                        {slide.index + 1}
                      </span>
                    )}
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <div className={`
                    px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm
                    ${slide.status === "ready" ? "bg-green-500/90 text-white" : ""}
                    ${slide.status === "generating" ? "bg-blue-500/90 text-white" : ""}
                    ${slide.status === "error" ? "bg-red-500/90 text-white" : ""}
                    ${slide.status === "pending" ? "bg-gray-500/90 text-white" : ""}
                  `}>
                    {slide.status === "ready" && "✓ Ready"}
                    {slide.status === "generating" && "Generating..."}
                    {slide.status === "error" && "Error"}
                    {slide.status === "pending" && "Pending"}
                  </div>
                </div>

                {/* Slide Number */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                  {slide.index + 1}
                </div>
              </div>

              {/* Slide Title Preview */}
              <div className="p-2 text-left">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {slide.outlineContent.split("\n")[0]?.replace("#", "").trim()}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Progress Summary */}
        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{completedCount} / {slides.length}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completedCount / slides.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="border-b bg-background/50 backdrop-blur-sm px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                Slide {currentSlideIndex + 1} of {slides.length}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review and confirm before proceeding
              </p>
            </div>
            {currentSlide.modificationCount > 0 && (
              <div className="text-xs text-muted-foreground">
                Modified {currentSlide.modificationCount} time(s)
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8 space-y-6">
            {/* Outline Content */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Slide Content
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="text-sm whitespace-pre-wrap font-mono">
                  {currentSlide.outlineContent}
                </div>
              </div>
            </div>

            {/* Generated Image */}
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                Generated Image
              </h3>

              {/* Image Display */}
              {currentSlide.status === "generating" || isGenerating ? (
                <div className="aspect-video w-full max-h-[60vh] rounded-lg bg-muted flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-sm font-medium">Generating slide...</p>
                    <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                  </div>
                </div>
              ) : currentSlide.status === "ready" && currentSlide.imageUrl ? (
                <div className="aspect-video w-full max-h-[60vh] rounded-lg border overflow-hidden bg-white shadow-lg">
                  <img
                    src={currentSlide.imageUrl}
                    alt={`Slide ${currentSlideIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : currentSlide.status === "error" ? (
                <div className="aspect-video w-full rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center border border-red-200 dark:border-red-800">
                  <div className="text-center space-y-3">
                    <X className="h-12 w-12 mx-auto text-red-500" />
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {currentSlide.error || "Failed to generate slide"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCurrentSlide()}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center border-2 border-dashed">
                  <div className="text-center space-y-2">
                    <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Waiting to generate...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modification Section */}
            {currentSlide.status === "ready" && currentSlide.imageUrl && (
              <div className="rounded-lg border bg-card p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide">
                  Refine This Slide (Optional)
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="modification" className="text-sm">
                      Modification Instructions
                    </Label>
                    <Input
                      id="modification"
                      value={modificationPrompt}
                      onChange={(e) => setModificationPrompt(e.target.value)}
                      placeholder="e.g., Make colors warmer, add more illustrations, change layout"
                      disabled={isGenerating}
                      className="mt-1.5"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isGenerating && modificationPrompt.trim()) {
                          void generateCurrentSlide(true);
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCurrentSlide(true)}
                      disabled={isGenerating || !modificationPrompt.trim()}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Modify
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setModificationPrompt("");
                        generateCurrentSlide(false);
                      }}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="border-t bg-background/80 backdrop-blur-sm px-8 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <Button
              variant="outline"
              onClick={() => {
                if (currentSlideIndex > 0) {
                  setCurrentSlideIndex((prev) => prev - 1);
                  setModificationPrompt("");
                }
              }}
              disabled={currentSlideIndex === 0 || isGenerating}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-3">
              {/* Generate Button (if not ready) */}
              {(currentSlide.status === "pending" || currentSlide.status === "error") && (
                <Button
                  onClick={() => generateCurrentSlide()}
                  disabled={isGenerating}
                  size="lg"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Slide
                    </>
                  )}
                </Button>
              )}

              {/* Confirm Button (if ready) */}
              {currentSlide.status === "ready" && (
                <Button
                  onClick={handleConfirm}
                  disabled={isGenerating}
                  size="lg"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-5 w-5" />
                  {isLastSlide ? "Finish & Save" : "Confirm & Next"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
