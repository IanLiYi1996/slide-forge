"use client";

import { useState, useEffect } from "react";
import { PageImage } from "@/lib/document-processor/pdf-utils";
import { DocumentUploader } from "./DocumentUploader";
import { ProcessingView } from "./ProcessingView";
import { SessionCreatingLoader } from "./SessionCreatingLoader";
import { SessionErrorView } from "./SessionErrorView";
import { Toaster } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface DocumentProcessorPageProps {
  sessionId?: string;
}

type UploadState =
  | 'idle'              // 无文件上传
  | 'creating-session'  // 正在创建 session
  | 'session-ready'     // Session 已创建，可以处理
  | 'session-error';    // Session 创建失败

interface SessionCreationData {
  images: PageImage[];
  file: File;
  error?: string;
}

export function DocumentProcessorPage({ sessionId }: DocumentProcessorPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [images, setImages] = useState<PageImage[]>([]);
  const [processedImages, setProcessedImages] = useState<Map<number, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [fileName, setFileName] = useState<string>("");
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [pendingSessionData, setPendingSessionData] = useState<SessionCreationData | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Load existing session if sessionId is provided
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  // 清理：组件卸载时中止待处理的请求
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const loadSession = async (id: string) => {
    setUploadState('creating-session'); // 显示加载状态

    try {
      const response = await fetch(`/api/document-processor/session/${id}`);
      if (!response.ok) throw new Error("Failed to load session");

      const data = await response.json();
      const session = data.session;

      // 恢复图片和处理过的图片
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
      setUploadState('session-ready'); // 设置为就绪状态

      console.log("Session loaded:", id);
    } catch (error) {
      console.error("Error loading session:", error);
      setPendingSessionData({
        images: [],
        file: new File([], ''),
        error: "Failed to load session"
      });
      setUploadState('session-error'); // 设置错误状态
      toast({
        title: "Error",
        description: "Failed to load session",
        variant: "destructive",
      });
    }
  };

  const createSession = async (loadedImages: PageImage[], file: File) => {
    const controller = new AbortController();
    setAbortController(controller); // 存储以便清理

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
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create session`);
      }

      const data = await response.json();
      const session = data.session;

      setCurrentSessionId(session.sessionId);
      setFileName(file.name);

      // 导航到 session URL
      router.push(`/document-processor/${session.sessionId}`);

      console.log("Session created:", session.sessionId);
    } catch (error) {
      // 中止错误不抛出（正常清理）
      if (error instanceof Error && error.name === 'AbortError') {
        console.log("Session creation aborted");
        return;
      }
      console.error("Error creating session:", error);
      throw error; // 重新抛出让调用者处理
    } finally {
      setAbortController(null); // 清除控制器
    }
  };

  const handleImagesLoaded = async (loadedImages: PageImage[], file: File) => {
    console.log("=== handleImagesLoaded called ===");
    console.log("Loaded images count:", loadedImages.length);

    // 防止并发上传
    if (uploadState === 'creating-session') {
      toast({
        title: "Please wait",
        description: "Previous upload still processing",
        variant: "destructive",
      });
      return;
    }

    // 存储待处理数据并设置状态为创建中
    setPendingSessionData({ images: loadedImages, file });
    setUploadState('creating-session');

    // 不要立即设置 images - 等待 session 创建
    try {
      await createSession(loadedImages, file);
      // Session 创建成功 - 现在设置图片和状态
      setImages(loadedImages);
      setProcessedImages(new Map());
      setUploadState('session-ready');
      setPendingSessionData(null); // 清除待处理数据
    } catch (error) {
      // 保留待处理数据，设置错误状态
      setPendingSessionData({
        images: loadedImages,
        file,
        error: error instanceof Error ? error.message : 'Failed to create session'
      });
      setUploadState('session-error');
    }
  };

  const handleRetrySessionCreation = async () => {
    if (!pendingSessionData) return;

    setUploadState('creating-session');

    try {
      await createSession(pendingSessionData.images, pendingSessionData.file);
      setImages(pendingSessionData.images);
      setProcessedImages(new Map());
      setUploadState('session-ready');
      setPendingSessionData(null);
    } catch (error) {
      setPendingSessionData({
        ...pendingSessionData,
        error: error instanceof Error ? error.message : 'Failed to create session'
      });
      setUploadState('session-error');
    }
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
    // 中止任何待处理的请求
    if (abortController) {
      abortController.abort();
    }

    setImages([]);
    setProcessedImages(new Map());
    setIsProcessing(false);
    setCurrentSessionId(null);
    setFileName("");
    setUploadState('idle');
    setPendingSessionData(null);
    setAbortController(null);

    // 导航回上传页面
    router.push("/document-processor");
  };

  return (
    <>
      <div className="h-full w-full bg-background">
        {uploadState === 'idle' ? (
          <DocumentUploader onImagesLoaded={handleImagesLoaded} />
        ) : uploadState === 'creating-session' ? (
          <SessionCreatingLoader
            fileName={pendingSessionData?.file.name}
            pageCount={pendingSessionData?.images.length}
          />
        ) : uploadState === 'session-error' ? (
          <SessionErrorView
            error={pendingSessionData?.error}
            pageCount={pendingSessionData?.images.length}
            onRetry={handleRetrySessionCreation}
            onCancel={handleReset}
          />
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
