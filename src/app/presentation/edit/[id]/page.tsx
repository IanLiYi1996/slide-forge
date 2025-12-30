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
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PresentationEditPage() {
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
    selectedTemplate,
  } = usePresentationState();

  const [generationStage, setGenerationStage] = useState<"outline" | "slides" | "completed">("outline");
  const [generatedSlides, setGeneratedSlides] = useState<SlideImage[]>([]);
  const [initialSlideIndex, setInitialSlideIndex] = useState(0);

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

  // Load presentation data and determine stage
  useEffect(() => {
    if (presentationData && !isLoading) {
      setCurrentPresentation(presentationData.id, presentationData.title);
      setPresentationInput(presentationData.presentation?.prompt ?? presentationData.title);

      // Load existing outline
      if (presentationData.presentation?.outline) {
        setOutline(presentationData.presentation.outline);
      }

      // Determine generation stage from database
      const dbStage = presentationData.presentation?.generationStage;
      const currentSlideIndex = presentationData.presentation?.currentSlideIndex ?? 0;

      if (dbStage) {
        if (dbStage === "outline") {
          setGenerationStage("outline");
        } else if (dbStage === "slides" || dbStage === "completed" || dbStage === "exported") {
          // All these stages should allow slide editing
          setGenerationStage("slides");
          setInitialSlideIndex(currentSlideIndex);
        }
      } else {
        // Legacy presentations without generationStage - default to slides if outline exists
        if (presentationData.presentation?.outline && presentationData.presentation.outline.length > 0) {
          setGenerationStage("slides");
        }
      }

      toast.success("Session restored - Continue editing");
    }
  }, [presentationData, isLoading, setCurrentPresentation, setPresentationInput, setOutline]);

  // Handle start slides generation
  const handleStartSlidesGeneration = async () => {
    if (!outline || outline.length === 0) {
      toast.error("Please generate an outline first");
      return;
    }

    // Update generation stage in database
    try {
      await updatePresentation({
        id: id,
        generationStage: "slides",
        lastAccessedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to update generation stage:", error);
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
        slides: slideUrls,
        generationStage: "completed",
        slidesGenerated: slideUrls.length,
        lastAccessedAt: new Date(),
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
      {/* Outline Editing Stage */}
      {generationStage === "outline" && (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
          <div className="max-w-5xl mx-auto p-8 space-y-8">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/presentation")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold">Edit Outline</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Review and edit your presentation outline
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

      {/* Slides Editing Stage */}
      {generationStage === "slides" && outline && outline.length > 0 && (
        <SlideBySlideGenerator
          outline={outline}
          templateId={selectedTemplate}
          onComplete={handleSlidesComplete}
          editMode={true}
          initialSlideIndex={initialSlideIndex}
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
