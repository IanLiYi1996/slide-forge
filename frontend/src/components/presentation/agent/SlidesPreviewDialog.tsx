/**
 * Slides Preview Dialog
 *
 * Shows all generated slides in a grid view with ability to view individual slides
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutGrid,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { SlideHTMLRenderer } from './slides/SlideHTMLRenderer';
import { ImageSlideRenderer } from './slides/ImageSlideRenderer';
import type { SlideData } from '@/lib/agent/types/workflow';

interface SlidesPreviewDialogProps {
  slides: SlideData[];
  trigger?: React.ReactNode;
}

export function SlidesPreviewDialog({ slides, trigger }: SlidesPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);

  // Filter slides that have HTML content
  const validSlides = slides.filter((slide) => slide.html || slide.imageUrl);

  if (validSlides.length === 0) {
    return null;
  }

  return (
    <>
      {/* Main Preview Dialog - Grid View */}
      <Dialog open={open && selectedSlideIndex === null} onOpenChange={setOpen}>
        {trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Preview All ({validSlides.length})
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Presentation Preview</DialogTitle>
            <DialogDescription>
              {validSlides.length} slides generated - Click any slide to view full size
            </DialogDescription>
          </DialogHeader>

          {/* Grid View */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {validSlides.map((slide, index) => {
                const slideNumber = slides.indexOf(slide) + 1;
                return (
                  <button
                    key={slide.id}
                    onClick={() => setSelectedSlideIndex(index)}
                    className="group relative aspect-video rounded-lg border-2 border-border hover:border-primary transition-all overflow-hidden bg-background shadow-sm hover:shadow-lg"
                  >
                    {/* Slide Preview */}
                    <div className="w-full h-full">
                      {slide.slideType === "image" && slide.imageUrl ? (
                        <ImageSlideRenderer
                          imageUrl={slide.imageUrl}
                          slideId={slide.id}
                        />
                      ) : (
                        <SlideHTMLRenderer
                          html={slide.html!}
                          slideId={slide.id}
                        />
                      )}
                    </div>

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Slide Number Badge */}
                    <div className="absolute top-2 left-2">
                      <Badge variant="default" className="shadow-md">
                        {slideNumber}
                      </Badge>
                    </div>

                    {/* Status Badge */}
                    {slide.status === 'generating' && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="shadow-md">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Individual Slide View Dialog */}
      {selectedSlideIndex !== null && validSlides[selectedSlideIndex] && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedSlideIndex(null);
          }}
        >
          <DialogContent className="max-w-7xl max-h-[95vh] p-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/50">
              <div className="flex items-center gap-3">
                <Badge variant="default">
                  Slide {slides.indexOf(validSlides[selectedSlideIndex]!) + 1}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {validSlides[selectedSlideIndex]!.outlineContent?.split('\n')[0]?.replace('#', '').trim()}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedSlideIndex + 1} of {validSlides.length}
              </span>
            </div>

            {/* Slide Content */}
            <div className="flex-1 overflow-auto p-6 bg-muted/30 flex items-center justify-center">
              {/* ✅ 移除 max-w-5xl 限制，使用 w-fit 适配内容宽度 */}
              <div className="w-fit mx-auto">
                {validSlides[selectedSlideIndex]!.slideType === "image" && validSlides[selectedSlideIndex]!.imageUrl ? (
                  <ImageSlideRenderer
                    imageUrl={validSlides[selectedSlideIndex]!.imageUrl!}
                    slideId={validSlides[selectedSlideIndex]!.id}
                    fixedSize={true}
                  />
                ) : (
                  <SlideHTMLRenderer
                    html={validSlides[selectedSlideIndex]!.html!}
                    slideId={validSlides[selectedSlideIndex]!.id}
                    fixedSize={true}
                  />
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/50">
              <Button
                variant="outline"
                onClick={() => setSelectedSlideIndex(Math.max(0, selectedSlideIndex - 1))}
                disabled={selectedSlideIndex === 0}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="flex gap-1">
                {validSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedSlideIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === selectedSlideIndex
                        ? 'bg-primary w-6'
                        : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() =>
                  setSelectedSlideIndex(Math.min(validSlides.length - 1, selectedSlideIndex + 1))
                }
                disabled={selectedSlideIndex === validSlides.length - 1}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
