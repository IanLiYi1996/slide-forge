"use client";

import { getPresentation, updatePresentation } from "@/app/_actions/presentation/presentationActions";
import { ThinkingDisplay } from "@/components/presentation/dashboard/ThinkingDisplay";
import { SlideBySlideGenerator } from "@/components/presentation/generation/SlideBySlideGenerator";
import { OutlineList } from "@/components/presentation/outline/OutlineList";
import { PromptInput } from "@/components/presentation/outline/PromptInput";
import { ToolCallDisplay } from "@/components/presentation/outline/ToolCallDisplay";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePresentationState } from "@/states/presentation-state";
import { type SlideImage } from "@/types/presentation-types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wand2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function PresentationGenerateWithIdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const {
    setCurrentPresentation,
    setPresentationInput,
    isGeneratingOutline,
    outlineThinking,
    outline,
    setOutline,
    setShouldStartOutlineGeneration,
    selectedTemplate,
  } = usePresentationState();

  const [generationStage, setGenerationStage] = useState<"outline" | "slides" | "completed">("outline");
  const [generatedSlides, setGeneratedSlides] = useState<SlideImage[]>([]);
  const initialLoadComplete = useRef(false);
  const generationStarted = useRef(false);

  // Fetch presentation data
  const { data: presentationData, isLoading } = useQuery({
    queryKey: ["presentation", id],
    queryFn: async () => {
      const result = await getPresentation(id);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load presentation");
      }
      return result.presentation;
    },
    enabled: !!id,
  });

  // Auto-start outline generation on mount
  useEffect(() => {
    if (initialLoadComplete.current) return;
    initialLoadComplete.current = true;

    if (isGeneratingOutline && !generationStarted.current) {
      console.log("Starting outline generation");
      generationStarted.current = true;

      setTimeout(() => {
        setShouldStartOutlineGeneration(true);
      }, 100);
    }
  }, [isGeneratingOutline, setShouldStartOutlineGeneration]);

  // Load presentation data
  useEffect(() => {
    if (presentationData && !isLoading) {
      setCurrentPresentation(presentationData.id, presentationData.title);
      setPresentationInput(presentationData.presentation?.prompt ?? presentationData.title);

      // Load existing outline if available
      if (presentationData.presentation?.outline) {
        setOutline(presentationData.presentation.outline);

        // If outline exists, check if we should go to slides generation
        if (presentationData.presentation.outline.length > 0) {
          setGenerationStage("outline");
        }
      }
    }
  }, [presentationData, isLoading, setCurrentPresentation, setPresentationInput, setOutline]);

  // Handle start slides generation
  const handleStartSlidesGeneration = () => {
    if (!outline || outline.length === 0) {
      toast.error("Please generate an outline first");
      return;
    }

    setGenerationStage("slides");
  };

  // Handle slides generation completion
  const handleSlidesComplete = async (slides: SlideImage[]) => {
    console.log("All slides completed:", slides);
    setGeneratedSlides(slides);
    setGenerationStage("completed");

    // Save slides to database
    try {
      const slideUrls = slides.map((s) => s.imageUrl).filter(Boolean) as string[];
      console.log("Saving slide URLs to database:", slideUrls);

      const result = await updatePresentation({
        id: id,
        slides: slideUrls, // Save as array of image URLs
      });

      console.log("Save result:", result);

      if (!result.success) {
        throw new Error(result.message || "Failed to save");
      }

      toast.success("Presentation completed!");

      // Navigate to view mode
      setTimeout(() => {
        router.push(`/presentation/${id}`);
      }, 1500);
    } catch (error) {
      console.error("Failed to save presentation:", error);
      toast.error("Failed to save presentation");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Outline Generation Stage */}
      {generationStage === "outline" && (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="max-w-5xl mx-auto p-8 space-y-8">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold">Outline Generation</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  AI is analyzing your topic and creating an outline
                </p>
              </div>
              <div className="w-32" /> {/* Spacer */}
            </div>

            {/* Content Area */}
            <div className="space-y-6">
              <PromptInput />

              <ThinkingDisplay
                thinking={outlineThinking}
                isGenerating={isGeneratingOutline}
                title="AI is thinking about your outline..."
              />

              <ToolCallDisplay />
              <OutlineList />
            </div>

            {/* Start Slides Generation Button */}
            {outline && outline.length > 0 && !isGeneratingOutline && (
              <div className="sticky bottom-0 left-0 right-0 flex justify-center border-t bg-background/95 backdrop-blur-md p-6 shadow-lg">
                <Button
                  size="lg"
                  className="gap-2 px-12 shadow-lg"
                  onClick={handleStartSlidesGeneration}
                >
                  <Wand2 className="h-5 w-5" />
                  Start Generating Slides ({outline.length} slides)
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slides Generation Stage */}
      {generationStage === "slides" && outline && outline.length > 0 && (
        <SlideBySlideGenerator
          outline={outline}
          templateId={selectedTemplate}
          onComplete={handleSlidesComplete}
        />
      )}

      {/* Completion Stage */}
      {generationStage === "completed" && (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="text-center space-y-6 p-8 rounded-2xl border bg-card shadow-2xl max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-2">
              <div className="text-5xl">🎉</div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">All Done!</h2>
              <p className="text-muted-foreground">
                Your presentation with {generatedSlides.length} slides is ready
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => router.push(`/presentation/${id}`)}
              className="gap-2 w-full"
            >
              View Presentation
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
