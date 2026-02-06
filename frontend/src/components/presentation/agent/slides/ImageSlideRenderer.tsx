"use client";

/**
 * ImageSlideRenderer
 * Renders an AI-generated image slide with fullscreen support
 */

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageOff, Maximize2, Loader2 } from "lucide-react";

interface ImageSlideRendererProps {
  imageUrl: string;
  slideId: string;
  className?: string;
  fixedSize?: boolean;
}

export function ImageSlideRenderer({
  imageUrl,
  slideId,
  className = "",
  fixedSize = false,
}: ImageSlideRendererProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/50 ${
          fixedSize ? "w-[1280px] h-[720px]" : "aspect-video w-full"
        } ${className}`}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No image available</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted/50 ${
          fixedSize ? "w-[1280px] h-[720px]" : "aspect-video w-full"
        } ${className}`}
      >
        <div className="text-center text-muted-foreground">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative group cursor-pointer overflow-hidden rounded-lg ${
          fixedSize ? "w-[1280px] h-[720px]" : "aspect-video w-full"
        } ${className}`}
        onClick={() => setIsFullscreen(true)}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <img
          src={imageUrl}
          alt={`Slide ${slideId}`}
          className={`w-full h-full object-contain bg-black ${
            isLoading ? "opacity-0" : "opacity-100"
          } transition-opacity duration-300`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <Maximize2 className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          <div className="flex items-center justify-center w-full h-full">
            <img
              src={imageUrl}
              alt={`Slide ${slideId} - Full Size`}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
