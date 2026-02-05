"use client";

import { useState } from "react";
import { Download, X, ChevronLeft, ChevronRight, ZoomIn, Grid, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type HubPage } from "@/types/smart-hub";

interface SlideGalleryProps {
  pages: HubPage[];
  currentIndex: number;
  onSlideClick?: (index: number) => void;
  title?: string;
}

export function SlideGallery({
  pages,
  currentIndex,
  onSlideClick,
  title = "Presentation",
}: SlideGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const readySlides = pages.filter((p) => p.outputImageUrl);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const nextSlide = () => {
    setLightboxIndex((prev) => (prev + 1) % readySlides.length);
  };

  const prevSlide = () => {
    setLightboxIndex((prev) => (prev - 1 + readySlides.length) % readySlides.length);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    } else if (e.key === "Escape") {
      setLightboxOpen(false);
    }
  };

  const downloadSlide = (url: string, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}_slide_${index + 1}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (readySlides.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No slides generated yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gallery Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            All Slides ({readySlides.length})
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Click any slide to preview in fullscreen
        </p>
      </div>

      {/* Grid Gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={cn(
              "group relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
              "border-2 hover:border-primary hover:shadow-lg",
              index === currentIndex ? "border-primary ring-2 ring-primary/30" : "border-border",
              !page.outputImageUrl && "bg-muted"
            )}
            onClick={() => {
              if (page.outputImageUrl) {
                openLightbox(index);
              } else {
                onSlideClick?.(index);
              }
            }}
          >
            {page.outputImageUrl ? (
              <>
                <img
                  src={page.outputImageUrl}
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Slide number badge */}
                <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {index + 1}
                </div>
                {/* Modification count */}
                {page.modificationCount > 0 && (
                  <div className="absolute top-1 right-1 bg-primary/90 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                    {page.modificationCount}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2">
                <span className="text-xs text-muted-foreground text-center">
                  Slide {index + 1}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {page.status === "processing" ? "Generating..." : "Pending"}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none"
          onKeyDown={handleKeyDown}
        >
          <DialogTitle className="sr-only">
            Slide {lightboxIndex + 1} of {readySlides.length}
          </DialogTitle>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Download button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-16 z-50 text-white hover:bg-white/20"
            onClick={() => {
              const slide = readySlides[lightboxIndex];
              if (slide?.outputImageUrl) {
                downloadSlide(slide.outputImageUrl, lightboxIndex);
              }
            }}
            title="Download this slide"
          >
            <Download className="h-5 w-5" />
          </Button>

          {/* Slide counter */}
          <div className="absolute top-4 left-4 z-50 text-white/80 text-sm">
            {lightboxIndex + 1} / {readySlides.length}
          </div>

          {/* Main image */}
          <div className="w-full h-full flex items-center justify-center p-8">
            <img
              src={readySlides[lightboxIndex]?.outputImageUrl}
              alt={`Slide ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Navigation arrows */}
          {readySlides.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={prevSlide}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={nextSlide}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Thumbnail strip */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 max-w-[80vw] overflow-x-auto p-2 bg-black/50 rounded-lg">
            {readySlides.map((slide, idx) => (
              <button
                key={slide.id}
                className={cn(
                  "flex-shrink-0 w-16 h-9 rounded overflow-hidden border-2 transition-all",
                  idx === lightboxIndex
                    ? "border-white ring-2 ring-white/30"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
                onClick={() => setLightboxIndex(idx)}
              >
                <img
                  src={slide.outputImageUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
