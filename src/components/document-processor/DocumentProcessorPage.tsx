"use client";

import { useState } from "react";
import { PageImage } from "@/lib/document-processor/pdf-utils";
import { DocumentUploader } from "./DocumentUploader";
import { ProcessingView } from "./ProcessingView";
import { Toaster } from "@/components/ui/toaster";

export function DocumentProcessorPage() {
  const [images, setImages] = useState<PageImage[]>([]);
  const [processedImages, setProcessedImages] = useState<Map<number, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImagesLoaded = (loadedImages: PageImage[]) => {
    console.log("=== handleImagesLoaded called ===");
    console.log("Loaded images count:", loadedImages.length);
    setImages(loadedImages);
    setProcessedImages(new Map());
    console.log("State updated, should now show ProcessingView");
  };

  const handleImageProcessed = (pageNumber: number, processedImageUrl: string) => {
    setProcessedImages((prev) => {
      const newMap = new Map(prev);
      newMap.set(pageNumber, processedImageUrl);
      return newMap;
    });
  };

  const handleReset = () => {
    setImages([]);
    setProcessedImages(new Map());
    setIsProcessing(false);
  };

  return (
    <>
      <div className="h-full w-full bg-background">
        {images.length === 0 ? (
          <DocumentUploader onImagesLoaded={handleImagesLoaded} />
        ) : (
          <ProcessingView
            images={images}
            processedImages={processedImages}
            onImageProcessed={handleImageProcessed}
            onReset={handleReset}
          />
        )}
      </div>
      <Toaster />
    </>
  );
}
