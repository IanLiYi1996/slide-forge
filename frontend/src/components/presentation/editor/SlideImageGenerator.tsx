"use client";

import { generateSlideImageAction } from "@/app/_actions/image/generate-slide-image";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePresentationState } from "@/states/presentation-state";
import { Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AspectRatio, ImageSize } from "@/app/_actions/image/generate-slide-image";

interface SlideImageGeneratorProps {
  slideId: string;
  slideContent: string; // Markdown or text content of the slide
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageGenerated?: (imageUrl: string) => void;
}

export function SlideImageGenerator({
  slideId,
  slideContent,
  open,
  onOpenChange,
  onImageGenerated,
}: SlideImageGeneratorProps) {
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageSize, setImageSize] = useState<ImageSize>("2K");

  const {
    selectedTemplate,
    slideImageGeneration,
    startSlideImageGeneration,
    completeSlideImageGeneration,
    failSlideImageGeneration,
  } = usePresentationState();

  const slideImageState = slideImageGeneration[slideId];
  const isGenerating = slideImageState?.status === "generating";
  const hasImage = slideImageState?.status === "success" && slideImageState.imageUrl;
  const conversationHistory = slideImageState?.conversationHistory || [];

  // Generate initial slide image
  const handleGenerateSlideImage = async () => {
    if (!slideContent.trim()) {
      toast.error("Slide content is empty");
      return;
    }

    startSlideImageGeneration(slideId);

    try {
      const result = await generateSlideImageAction(
        slideContent,
        selectedTemplate,
        { aspectRatio, imageSize },
        [],
      );

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "Failed to generate slide image");
      }

      completeSlideImageGeneration(
        slideId,
        result.imageUrl,
        result.conversationHistory || [],
      );

      toast.success("Slide image generated!");
      onImageGenerated?.(result.imageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate";
      failSlideImageGeneration(slideId, message);
      toast.error(message);
    }
  };

  // Modify existing slide image (multi-turn)
  const handleModifySlideImage = async () => {
    if (!modificationPrompt.trim()) {
      toast.error("Please enter modification instructions");
      return;
    }

    if (!conversationHistory || conversationHistory.length === 0) {
      toast.error("No image to modify. Generate one first.");
      return;
    }

    startSlideImageGeneration(slideId);

    try {
      const result = await generateSlideImageAction(
        slideContent,
        selectedTemplate,
        { aspectRatio, imageSize },
        conversationHistory,
        modificationPrompt,
      );

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || "Failed to modify slide image");
      }

      completeSlideImageGeneration(
        slideId,
        result.imageUrl,
        result.conversationHistory || [],
      );

      toast.success("Slide image updated!");
      setModificationPrompt("");
      onImageGenerated?.(result.imageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to modify";
      failSlideImageGeneration(slideId, message);
      toast.error(message);
    }
  };

  return (
    <>
      {/* Dialog */}
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Generate Full Slide Visualization
            </AlertDialogTitle>
            <AlertDialogDescription>
              Create a complete visual representation of this slide using AI.
              You can modify the generated image multiple times.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Configuration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="aspect-ratio" className="text-xs">
                  Aspect Ratio
                </Label>
                <Select
                  value={aspectRatio}
                  onValueChange={(value) => setAspectRatio(value as AspectRatio)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="image-size" className="text-xs">
                  Resolution
                </Label>
                <Select
                  value={imageSize}
                  onValueChange={(value) => setImageSize(value as ImageSize)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id="image-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1K">1K (Fast)</SelectItem>
                    <SelectItem value="2K">2K (Balanced)</SelectItem>
                    <SelectItem value="4K">4K (High Quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Generated Image Preview */}
            {hasImage && slideImageState.imageUrl && (
              <div className="space-y-2">
                <Label className="text-xs">Generated Slide Image</Label>
                <div className="relative rounded-lg border overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={slideImageState.imageUrl}
                    alt="Generated slide"
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Rounds: {Math.floor(conversationHistory.length / 2) + 1}
                </p>
              </div>
            )}

            {/* Initial Generation or Modification */}
            {!hasImage ? (
              // Initial generation
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Click "Generate" to create a complete visual representation of this
                  slide
                </Label>
                {isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating slide visualization...
                  </div>
                )}
              </div>
            ) : (
              // Multi-turn modification
              <div className="space-y-2">
                <Label htmlFor="modification-prompt" className="text-xs">
                  Modify Image (Optional)
                </Label>
                <Input
                  id="modification-prompt"
                  value={modificationPrompt}
                  onChange={(e) => setModificationPrompt(e.target.value)}
                  placeholder="e.g., Make the colors warmer, Add more illustrations"
                  disabled={isGenerating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isGenerating) {
                      void handleModifySlideImage();
                    }
                  }}
                />
                {isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Modifying slide image...
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {slideImageState?.status === "error" && slideImageState.error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                Error: {slideImageState.error}
              </div>
            )}

            {/* Info box */}
            <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-xs">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                💡 How it works:
              </p>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Initial generation creates a complete slide visualization</li>
                <li>• Use modification prompt to refine the image</li>
                <li>• Each modification builds on the previous image</li>
                <li>
                  • Template: <strong>{selectedTemplate}</strong>
                </li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Close</AlertDialogCancel>
            {!hasImage ? (
              <Button
                onClick={handleGenerateSlideImage}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleModifySlideImage}
                disabled={isGenerating || !modificationPrompt.trim()}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Modifying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Modify
                  </>
                )}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
