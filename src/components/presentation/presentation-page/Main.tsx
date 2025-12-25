"use client";

import { getPresentation, deletePresentation } from "@/app/_actions/presentation/presentationActions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ExportButton } from "@/components/presentation/presentation-page/buttons/ExportButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Pure Image Presentation Viewer
 * Displays slides as full-page images (no editing)
 */
export default function PresentationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch presentation data
  const { data: presentationData, isLoading } = useQuery({
    queryKey: ["presentation-view", id],
    queryFn: async () => {
      const result = await getPresentation(id);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load presentation");
      }
      return result.presentation;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!presentationData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl">Presentation not found</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Get slides (stored as image URLs array in database)
  // presentationData is BaseDocument, actual content is in presentationData.presentation.content
  const presentationContent = presentationData.presentation?.content as { slides?: string[] } | null;
  const slideUrls = presentationContent?.slides || [];

  console.log("Full presentation data:", presentationData);
  console.log("Presentation.content:", presentationData.presentation?.content);
  console.log("Extracted slides:", slideUrls);

  if (slideUrls.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl">No slides generated yet</p>
          <Button
            variant="outline"
            onClick={() => router.push(`/presentation/generate/${id}`)}
          >
            Generate Slides
          </Button>
        </div>
      </div>
    );
  }

  const currentSlideUrl = slideUrls[currentSlideIndex];
  const isFirstSlide = currentSlideIndex === 0;
  const isLastSlide = currentSlideIndex === slideUrls.length - 1;

  const nextSlide = () => {
    if (!isLastSlide) {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (!isFirstSlide) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    }
  };

  // Handle delete
  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const result = await deletePresentation(id);

      if (!result.success) {
        toast({
          title: "Delete Failed",
          description: result.message || "Failed to delete presentation",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Deleted",
        description: "Presentation deleted successfully",
      });

      // Redirect to dashboard
      router.push("/");
    } catch (error) {
      console.error("Error deleting presentation:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div
      className="h-screen w-screen bg-background flex flex-col fixed inset-0"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-6 py-4 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>

          {/* Export Button */}
          <ExportButton
            presentationId={id}
            fileName={presentationData.title || "presentation"}
            variant="toolbar"
          />

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        <div className="text-base font-semibold">
          {presentationData.title}
        </div>

        <div className="text-sm text-muted-foreground">
          {currentSlideIndex + 1} / {slideUrls.length}
        </div>
      </div>

      {/* Main Slide Display */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden">
        {currentSlideUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={currentSlideUrl}
              alt={`Slide ${currentSlideIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border"
            />
          </div>
        ) : (
          <div className="text-muted-foreground">Slide not available</div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between px-8 py-6 bg-background/95 backdrop-blur-sm border-t shadow-sm">
        <Button
          variant="outline"
          size="lg"
          onClick={prevSlide}
          disabled={isFirstSlide}
          className="gap-2"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>

        <div className="flex gap-2">
          {slideUrls.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlideIndex(index)}
              className={`
                h-2.5 rounded-full transition-all
                ${
                  index === currentSlideIndex
                    ? "w-10 bg-primary"
                    : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }
              `}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={nextSlide}
          disabled={isLastSlide}
          className="gap-2"
        >
          Next
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Presentation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{presentationData.title}"? This action cannot be undone.
              All slides and generated images will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
