"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Layers,
  Play,
  Pause,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const readySlides = pages.filter((p) => p.outputImageUrl);
  const completionPercent = Math.round((readySlides.length / pages.length) * 100);

  const openLightbox = (index: number) => {
    // Find the actual index in readySlides
    const readyIndex = readySlides.findIndex((s) => s.id === pages[index]?.id);
    if (readyIndex !== -1) {
      setLightboxIndex(readyIndex);
      setLightboxOpen(true);
    }
  };

  const nextSlide = useCallback(() => {
    setLightboxIndex((prev) => (prev + 1) % readySlides.length);
  }, [readySlides.length]);

  const prevSlide = useCallback(() => {
    setLightboxIndex((prev) => (prev - 1 + readySlides.length) % readySlides.length);
  }, [readySlides.length]);

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || !lightboxOpen) return;
    const timer = setInterval(nextSlide, 3000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, lightboxOpen, nextSlide]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsAutoPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, nextSlide, prevSlide]);

  const downloadSlide = (url: string, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}_slide_${index + 1}.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Layers className="h-12 w-12 mb-4 opacity-30" />
        <p>No slides to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gallery Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {readySlides.length} of {pages.length} slides
          </span>
          {completionPercent === 100 && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
              Complete
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">
            {completionPercent}%
          </span>
        </div>
      </div>

      {/* Grid Gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={cn(
              "group relative aspect-video rounded-xl overflow-hidden cursor-pointer",
              "transition-all duration-300 ease-out",
              "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10",
              "border-2",
              index === currentIndex
                ? "border-primary ring-4 ring-primary/20 shadow-lg shadow-primary/20"
                : "border-border/50 hover:border-primary/50",
              !page.outputImageUrl && "bg-gradient-to-br from-muted to-muted/50"
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
                {/* Image */}
                <img
                  src={page.outputImageUrl}
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                  <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>

                {/* Slide number badge */}
                <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
                  {index + 1}
                </div>

                {/* Modification count */}
                {page.modificationCount > 0 && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
                    {page.modificationCount}x
                  </div>
                )}

                {/* Current indicator */}
                {index === currentIndex && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-medium">
                    Current
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                {page.status === "processing" ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Generating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold text-muted-foreground/40">{index + 1}</span>
                    <span className="text-xs text-muted-foreground">Pending</span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => {
        setLightboxOpen(open);
        if (!open) setIsAutoPlaying(false);
      }}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none rounded-xl"
        >
          <DialogTitle className="sr-only">
            Slide {lightboxIndex + 1} of {readySlides.length}
          </DialogTitle>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
            {/* Left: Slide info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                <Layers className="h-4 w-4 text-white/80" />
                <span className="text-white font-medium">
                  {lightboxIndex + 1}
                  <span className="text-white/50 mx-1">/</span>
                  {readySlides.length}
                </span>
              </div>
              <h4 className="text-white/80 text-sm font-medium hidden sm:block">
                {title}
              </h4>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Auto-play toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-white hover:bg-white/10 rounded-full",
                  isAutoPlaying && "bg-white/20"
                )}
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                title={isAutoPlaying ? "Pause slideshow" : "Play slideshow"}
              >
                {isAutoPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              {/* Download button */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-full"
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

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 rounded-full"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Main image container */}
          <div className="flex-1 flex items-center justify-center p-4 pt-16 pb-24 overflow-hidden">
            <img
              src={readySlides[lightboxIndex]?.outputImageUrl}
              alt={`Slide ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              key={lightboxIndex}
            />
          </div>

          {/* Navigation arrows */}
          {readySlides.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 h-10 w-10 rounded-full"
                onClick={prevSlide}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 h-10 w-10 rounded-full"
                onClick={nextSlide}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Bottom thumbnails */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
            <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
              {readySlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  className={cn(
                    "flex-shrink-0 w-16 h-10 rounded overflow-hidden transition-all",
                    "border-2",
                    idx === lightboxIndex
                      ? "border-white opacity-100"
                      : "border-transparent opacity-50 hover:opacity-80"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
