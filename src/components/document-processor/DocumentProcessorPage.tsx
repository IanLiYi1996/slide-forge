"use client";

import { useState, useEffect } from "react";
import { PageImage } from "@/lib/document-processor/pdf-utils";
import { DocumentUploader } from "./DocumentUploader";
import { ProcessingView } from "./ProcessingView";
import { Toaster } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface DocumentProcessorPageProps {
  sessionId?: string;
}

export function DocumentProcessorPage({ sessionId }: DocumentProcessorPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [images, setImages] = useState<PageImage[]>([]);
  const [processedImages, setProcessedImages] = useState<Map<number, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [fileName, setFileName] = useState<string>("");

  // Load existing session if sessionId is provided
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  const loadSession = async (id: string) => {
    try {
      const response = await fetch(`/api/document-processor/session/${id}`);
      if (!response.ok) throw new Error("Failed to load session");

      const data = await response.json();
      const session = data.session;

      // Restore images and processed images
      if (session.images) {
        setImages(session.images);
      }
      if (session.processedImages) {
        const processedMap = new Map<number, string>();
        Object.entries(session.processedImages).forEach(([key, value]) => {
          processedMap.set(Number(key), value as string);
        });
        setProcessedImages(processedMap);
      }
      setFileName(session.fileName || "");
      setCurrentSessionId(id);

      console.log("Session loaded:", id);
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Error",
        description: "Failed to load session",
        variant: "destructive",
      });
    }
  };

  const createSession = async (loadedImages: PageImage[], file: File) => {
    try {
      const response = await fetch("/api/document-processor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Document ${file.name}`,
          fileName: file.name,
          fileType: file.type,
          totalPages: loadedImages.length,
          images: loadedImages,
        }),
      });

      if (!response.ok) throw new Error("Failed to create session");

      const data = await response.json();
      const session = data.session;

      setCurrentSessionId(session.sessionId);
      setFileName(file.name);

      // Navigate to the session URL
      router.push(`/document-processor/${session.sessionId}`);

      console.log("Session created:", session.sessionId);
    } catch (error) {
      console.error("Error creating session:", error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
    }
  };

  const handleImagesLoaded = async (loadedImages: PageImage[], file: File) => {
    console.log("=== handleImagesLoaded called ===");
    console.log("Loaded images count:", loadedImages.length);
    setImages(loadedImages);
    setProcessedImages(new Map());
    console.log("State updated, should now show ProcessingView");

    // Create a new session
    await createSession(loadedImages, file);
  };

  const handleImageProcessed = async (pageNumber: number, processedImageUrl: string) => {
    const newMap = new Map(processedImages);
    newMap.set(pageNumber, processedImageUrl);
    setProcessedImages(newMap);

    // Update session in database
    if (currentSessionId) {
      try {
        const processedImagesObj: Record<number, string> = {};
        newMap.forEach((value, key) => {
          processedImagesObj[key] = value;
        });

        await fetch(`/api/document-processor/session/${currentSessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processedPages: newMap.size,
            processedImages: processedImagesObj,
            status: newMap.size === images.length ? "completed" : "active",
          }),
        });

        console.log("Session updated:", currentSessionId);
      } catch (error) {
        console.error("Error updating session:", error);
      }
    }
  };

  const handleReset = () => {
    setImages([]);
    setProcessedImages(new Map());
    setIsProcessing(false);
    setCurrentSessionId(null);
    setFileName("");
    // Navigate back to upload page
    router.push("/document-processor");
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
