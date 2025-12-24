"use client";

import { createEmptyPresentation } from "@/app/_actions/presentation/presentationActions";
import { Button } from "@/components/ui/button";
import { usePresentationState } from "@/states/presentation-state";
import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { PresentationControls } from "./PresentationControls";
import { PresentationExamples } from "./PresentationExamples";
import { PresentationInput } from "./PresentationInput";
import { TemplateSelector } from "./TemplateSelector";

export function PresentationDashboard() {
  const router = useRouter();
  const {
    presentationInput,
    isGeneratingOutline,
    setCurrentPresentation,
    setIsGeneratingOutline,
    language,
    theme,
    setShouldStartOutlineGeneration,
  } = usePresentationState();

  useEffect(() => {
    setCurrentPresentation("", "");
    // Make sure to reset any generation flags when landing on dashboard
    setIsGeneratingOutline(false);
    setShouldStartOutlineGeneration(false);
  }, []);

  const handleGenerate = async () => {
    if (!presentationInput.trim()) {
      toast.error("Please enter a topic for your presentation");
      return;
    }

    // Set UI loading state
    setIsGeneratingOutline(true);

    try {
      const result = await createEmptyPresentation(
        presentationInput.substring(0, 50) || "Untitled Presentation",
        theme,
        language,
      );

      if (result.success && result.presentation) {
        // Set the current presentation
        setCurrentPresentation(
          result.presentation.id,
          result.presentation.title,
        );
        router.push(`/presentation/generate/${result.presentation.id}`);
      } else {
        setIsGeneratingOutline(false);
        toast.error(result.message || "Failed to create presentation");
      }
    } catch (error) {
      setIsGeneratingOutline(false);
      console.error("Error creating presentation:", error);
      toast.error("Failed to create presentation");
    }
  };

  return (
    <div className="notebook-section relative h-full w-full overflow-auto">
      {/* Main Content - Centered considering sidebar width (256px / 2 = 128px offset) */}
      <div className="min-h-full flex items-center justify-center" style={{ marginLeft: '-128px' }}>
        <div className="w-full max-w-3xl space-y-10 px-8 py-16">
          {/* Main Input Section */}
          <div className="space-y-6">
            <PresentationInput handleGenerate={handleGenerate} />
            <PresentationControls />

            <div className="flex items-center justify-center pt-4">
              <Button
                onClick={handleGenerate}
                disabled={!presentationInput.trim() || isGeneratingOutline}
                variant={isGeneratingOutline ? "loading" : "default"}
                size="lg"
                className="gap-2 px-12 h-12 text-base shadow-lg"
              >
                <Wand2 className="h-5 w-5" />
                {isGeneratingOutline ? "Generating..." : "Generate Presentation"}
              </Button>
            </div>
          </div>

          <PresentationExamples />
        </div>
      </div>

      {/* Template Selector Dialog */}
      <TemplateSelector />
    </div>
  );
}
