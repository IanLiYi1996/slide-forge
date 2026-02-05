"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { UnifiedUploader } from "./input/UnifiedUploader";
import { ModeSelector } from "./ModeSelector";
import { useSmartHubState } from "@/states/smart-hub-state";
import { type InputMetadata, type ProcessingMode } from "@/types/smart-hub";
import { type PageImage } from "@/lib/document-processor/pdf-utils";

interface RecentSession {
  sessionId: string;
  title: string;
  mode: ProcessingMode;
  updatedAt: string;
  pageCount: number;
}

export function SmartHubLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const {
    setInputText,
    setInputFile,
    setInputMetadata,
    selectedMode,
    setSelectedMode,
  } = useSmartHubState();

  const [inputMetadata, setLocalInputMetadata] = useState<InputMetadata | null>(null);
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Load recent sessions on mount
  useEffect(() => {
    loadRecentSessions();
  }, []);

  const loadRecentSessions = async () => {
    try {
      const response = await fetch("/api/smart-hub/session");
      if (response.ok) {
        const data = await response.json();
        setRecentSessions(data.sessions?.slice(0, 5) || []);
      }
    } catch (error) {
      console.error("Failed to load recent sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleInputChange = useCallback(
    (
      input: File | string | null,
      metadata: InputMetadata | null,
      images?: PageImage[]
    ) => {
      setLocalInputMetadata(metadata);
      setInputMetadata(metadata);

      if (images) {
        setPageImages(images);
      }

      if (typeof input === "string") {
        setInputText(input);
        setInputFile(null);
      } else if (input instanceof File) {
        setInputFile(input);
        setInputText("");
      } else {
        setInputText("");
        setInputFile(null);
        setPageImages([]);
      }

      // Auto-select suggested mode if confidence is high
      if (metadata && metadata.confidence > 0.7) {
        setSelectedMode(metadata.suggestedMode);
      }
    },
    [setInputText, setInputFile, setInputMetadata, setSelectedMode]
  );

  const handleModeSelect = useCallback(
    (mode: ProcessingMode) => {
      setSelectedMode(mode);
    },
    [setSelectedMode]
  );

  const handleContinue = async () => {
    if (!selectedMode) {
      toast({
        title: "Please select a mode",
        description: "Choose how you want to process your content",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Get current input text from the global state
      const currentInputText = useSmartHubState.getState().inputText;

      // Create session first
      const response = await fetch("/api/smart-hub/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          title: inputMetadata?.fileName || getDefaultTitle(selectedMode),
          inputMetadata,
          inputText: currentInputText || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      const sessionId = data.session.sessionId;

      // If process mode and we have images, add them to the session
      if (selectedMode === "process" && pageImages.length > 0) {
        const pagesResponse = await fetch(`/api/smart-hub/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "page_processing",
            pages: pageImages.map((img, index) => ({
              id: crypto.randomUUID(),
              index,
              sourceType: "image",
              imageDataUrl: img.dataUrl,
              status: "pending",
              conversationHistory: [],
              modificationCount: 0,
              createdAt: new Date().toISOString(),
            })),
          }),
        });

        if (!pagesResponse.ok) {
          console.error("Failed to add pages to session");
        }
      }

      // Navigate to the appropriate mode page
      router.push(`/create/${sessionId}/${selectedMode}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      toast({
        title: "Failed to create session",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openSession = (sessionId: string, mode: ProcessingMode) => {
    router.push(`/create/${sessionId}/${mode}`);
  };

  // Check for mode query parameter
  const preselectedMode = searchParams.get("mode") as ProcessingMode | null;
  if (preselectedMode && !selectedMode) {
    setSelectedMode(preselectedMode);
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Smart Document Hub</h1>
        </div>
        <p className="text-muted-foreground">
          Create, process, and transform your documents with AI
        </p>
      </div>

      {/* Main content area */}
      <div className="space-y-8">
        {/* Input section */}
        <Card>
          <CardHeader>
            <CardTitle>Start with your content</CardTitle>
            <CardDescription>
              Enter text or upload a file to get started. We&apos;ll suggest the best
              processing mode for your content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedUploader
              onInputChange={handleInputChange}
              disabled={isCreating}
              placeholder="Paste your text here, or describe what you want to create..."
            />
          </CardContent>
        </Card>

        {/* Mode selection - show when we have input or preselected mode */}
        {(inputMetadata || preselectedMode) && (
          <ModeSelector
            suggestedMode={inputMetadata?.suggestedMode}
            confidence={inputMetadata?.confidence}
            selectedMode={selectedMode}
            onSelect={handleModeSelect}
            disabled={isCreating}
          />
        )}

        {/* Continue button */}
        {selectedMode && (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={isCreating}
              className="gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Continue with {getModeLabel(selectedMode)}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Recent sessions */}
        {!inputMetadata && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Sessions</CardTitle>
              <CardDescription>
                Continue where you left off
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent sessions. Start by entering content above.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => openSession(session.sessionId, session.mode)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {getModeIcon(session.mode)}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{session.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.pageCount} pages -{" "}
                            {formatDistanceToNow(new Date(session.updatedAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function getDefaultTitle(mode: ProcessingMode): string {
  switch (mode) {
    case "generate":
      return "New Presentation";
    case "process":
      return "Document Processing";
    case "extract":
      return "Content Extraction";
  }
}

function getModeLabel(mode: ProcessingMode): string {
  switch (mode) {
    case "generate":
      return "Generate";
    case "process":
      return "Process";
    case "extract":
      return "Extract";
  }
}

function getModeIcon(mode: ProcessingMode): string {
  switch (mode) {
    case "generate":
      return "✨";
    case "process":
      return "🔄";
    case "extract":
      return "📑";
  }
}
