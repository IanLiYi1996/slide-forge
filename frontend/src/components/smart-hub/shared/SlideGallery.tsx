"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Layers,
  Sparkles,
  Play,
  Pause,
  Edit3,
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
  const [imageLoaded, setImageLoaded] = useState<Record<number, boolean>>({});

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Slide Gallery
              {completionPercent === 100 && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {readySlides.length} of {pages.length} slides ready
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground w-10">
            {completionPercent}%
          </span>
        </div>
      </div>

      {/* Grid Gallery */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={cn(
              "group relative rounded-xl overflow-hidden cursor-pointer",
              "transition-all duration-300 ease-out",
              "hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10",
              "border-2",
              index === currentIndex
                ? "border-primary ring-4 ring-primary/20 shadow-lg shadow-primary/20"
                : "border-border/50 hover:border-primary/50",
              !page.outputImageUrl && "bg-gradient-to-br from-muted to-muted/50"
            )}
            style={{ aspectRatio: "16/9" }}
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
                {/* Image with loading state */}
                <div className="absolute inset-0">
                  {!imageLoaded[index] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <img
                    src={page.outputImageUrl}
                    alt={`Slide ${index + 1}`}
                    className={cn(
                      "w-full h-full object-cover transition-opacity duration-300",
                      imageLoaded[index] ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setImageLoaded((prev) => ({ ...prev, [index]: true }))}
                  />
                </div>

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Hover content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 mb-2 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xs text-white/90 font-medium">Click to preview</span>
                </div>

                {/* Slide number badge */}
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {index + 1}
                </div>

                {/* Modification count */}
                {page.modificationCount > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium flex items-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    {page.modificationCount}
                  </div>
                )}

                {/* Current indicator */}
                {index === currentIndex && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                    Current
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-3 gap-2">
                {page.status === "processing" ? (
                  <>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <Sparkles className="h-4 w-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      Generating...
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground/50">{index + 1}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Pending
                    </span>
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
          className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black border-none rounded-none z-[100] fixed inset-0"
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

          {/* Main image */}
          <div className="w-full h-full flex items-center justify-center px-4 sm:px-16 py-20">
            <img
              src={readySlides[lightboxIndex]?.outputImageUrl}
              alt={`Slide ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in fade-in duration-300"
              key={lightboxIndex}
            />
          </div>

          {/* Navigation arrows */}
          {readySlides.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-50 text-white bg-white/10 hover:bg-white/20 backdrop-blur-md h-14 w-14 rounded-full border border-white/10 transition-all hover:scale-105"
                onClick={prevSlide}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 text-white bg-white/10 hover:bg-white/20 backdrop-blur-md h-14 w-14 rounded-full border border-white/10 transition-all hover:scale-105"
                onClick={nextSlide}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Bottom bar with thumbnails */}
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-6">
            {/* Progress bar */}
            <div className="w-full px-6 mb-4">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 ease-out"
                  style={{ width: `${((lightboxIndex + 1) / readySlides.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Thumbnail strip */}
            <div className="flex justify-center gap-2 px-6 overflow-x-auto">
              {readySlides.map((slide, idx) => (
                <button
                  key={slide.id}
                  className={cn(
                    "flex-shrink-0 w-20 h-12 rounded-lg overflow-hidden transition-all duration-200",
                    "border-2 hover:border-white/60",
                    idx === lightboxIndex
                      ? "border-white ring-2 ring-white/30 scale-105"
                      : "border-white/20 opacity-50 hover:opacity-80"
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

            {/* Keyboard hint */}
            <div className="flex justify-center gap-4 mt-4 text-white/40 text-xs">
              <span>← → Navigate</span>
              <span>Space Slideshow</span>
              <span>Esc Close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
