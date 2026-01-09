/**
 * PreziEditor Component
 *
 * Main Prezi editor container that integrates:
 * - Toolbar
 * - Canvas
 * - Properties panel
 * - Layer panel
 * - Path editor (route mode)
 * - Player controls
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePreziEditorStore, createInitialCanvasData } from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { updatePresentation } from "@/app/_actions/presentation/presentationActions";
import PreziCanvas from "./PreziCanvas";
import PreziToolbar from "../toolbar/PreziToolbar";
import ElementProperties from "../toolbar/ElementProperties";
import LayerPanel from "../toolbar/LayerPanel";
import PathEditor from "../path/PathEditor";
import PathPlayer from "../player/PathPlayer";
import PlayerControls from "../player/PlayerControls";
import ExportPanel from "../export/ExportPanel";
import { CreatePreziDialog } from "../CreatePreziDialog";
import { Button } from "@/components/ui/button";
import { Pencil, Route, Download, Presentation, Minimize2, Save, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createPresentation } from "@/app/_actions/presentation/presentationActions";
import { useToast } from "@/components/ui/use-toast";

interface PreziEditorProps {
  presentationId?: string;
  initialData?: any; // PreziCanvasData from database
}

/**
 * PreziEditor component
 */
const PreziEditor: React.FC<PreziEditorProps> = ({
  presentationId,
  initialData,
}) => {
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const setCanvasData = usePreziEditorStore((state) => state.setCanvasData);
  const playPath = usePreziEditorStore((state) => state.playPath);
  const isPlaying = usePreziEditorStore((state) => state.isPlaying);
  const stopPlaying = usePreziEditorStore((state) => state.stopPlaying);
  const [editorMode, setEditorMode] = useState<"edit" | "path" | "export">("edit");
  const [isPresentMode, setIsPresentMode] = useState(false); // 🆕 Presentation mode
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Get theme colors using unified hook
  const { mounted, themeColors, isDark } = usePreziTheme();

  // Save presentation to database
  const handleSave = useCallback(async () => {
    if (!presentationId || !canvasData) {
      console.error("No presentation ID or canvas data");
      return;
    }

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const result = await updatePresentation({
        id: presentationId,
        content: canvasData as any,
        lastAccessedAt: new Date(),
      });

      if (result.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [presentationId, canvasData]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!presentationId) return;

    const autoSaveInterval = setInterval(() => {
      if (canvasData && !isSaving) {
        handleSave();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [presentationId, canvasData, isSaving, handleSave]);

  // Create new Prezi presentation (show dialog)
  const handleNew = () => {
    if (!isSaving) {
      setShowCreateDialog(true);
    }
  };

  // Handle confirm create (from dialog)
  const handleConfirmCreate = useCallback(async (data: { title: string; description?: string }) => {
    setIsSaving(true);

    try {
      const newCanvasData = createInitialCanvasData();
      const result = await createPresentation({
        title: data.title,
        mode: "PREZI",
        content: newCanvasData as any,
        theme: "mystique",
        language: "en-US",
      });

      if (result.success && result.presentation) {
        // Navigate to the new presentation
        router.push(`/presentation/prezi-edit/${result.presentation.id}`);
        toast({
          title: "Prezi Created",
          description: `"${data.title}" is ready to edit!`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create Prezi presentation",
        });
      }
    } catch (error) {
      console.error("Create error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create Prezi presentation",
      });
    } finally {
      setIsSaving(false);
    }
  }, [router, toast]);

  // Auto-play when entering present mode
  useEffect(() => {
    if (isPresentMode && canvasData && !isPlaying) {
      // Start playing after a short delay
      const timer = setTimeout(() => {
        playPath(canvasData.activePath);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPresentMode, canvasData, isPlaying, playPath]);

  // Initialize canvas data (must be before early return!)
  useEffect(() => {
    if (!canvasData) {
      if (initialData) {
        setCanvasData(initialData);
      } else {
        setCanvasData(createInitialCanvasData());
      }
    }
  }, [canvasData, initialData, setCanvasData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Present mode toggle (F5 or P key)
      if (e.key === "F5" || (e.key.toLowerCase() === "p" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setIsPresentMode((prev) => !prev);
        // Also enter browser fullscreen if entering present mode
        if (!isPresentMode && !document.fullscreenElement) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (error) {
            console.error("Fullscreen error:", error);
          }
        }
        return;
      }

      // ESC to exit present mode
      if (e.key === "Escape" && isPresentMode) {
        e.preventDefault();
        setIsPresentMode(false);
        return;
      }

      // Space to play/pause in present mode
      if (isPresentMode && e.key === " ") {
        e.preventDefault();
        if (canvasData) {
          if (isPlaying) {
            stopPlaying();
          } else {
            playPath(canvasData.activePath);
          }
        }
        return;
      }

      // Tool shortcuts (only in edit mode)
      if (!isPresentMode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            usePreziEditorStore.getState().setMode("select");
            break;
          case "h":
            usePreziEditorStore.getState().setMode("pan");
            break;
          case "t":
            usePreziEditorStore.getState().setMode("text");
            break;
          case "i":
            usePreziEditorStore.getState().setMode("draw");
            break;
          case "c":
            usePreziEditorStore.getState().setMode("html");
            break;
        }
      }

      // Save (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (presentationId && !isSaving) {
          handleSave();
        }
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === "z") {
          e.preventDefault();
          usePreziEditorStore.getState().undo();
        } else if (e.key === "y") {
          e.preventDefault();
          usePreziEditorStore.getState().redo();
        }
      }

      // Delete selected elements (only in edit mode)
      if (!isPresentMode && (e.key === "Delete" || e.key === "Backspace")) {
        const selectedElements = usePreziEditorStore.getState().selectedElements;
        if (selectedElements.length > 0) {
          e.preventDefault();
          selectedElements.forEach((id) => {
            usePreziEditorStore.getState().deleteElement(id);
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPresentMode, presentationId, isSaving, handleSave, canvasData, isPlaying, stopPlaying, playPath]);

  // Show loading skeleton during hydration (must be after all Hooks!)
  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-2 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  // Presentation mode view (full screen canvas only)
  if (isPresentMode) {
    return (
      <div
        className="flex h-screen w-full flex-col"
        style={{ backgroundColor: themeColors.background }}
      >
        {/* Canvas - Full screen */}
        <div className="flex-1 relative">
          <PreziCanvas
            showGrid={false}
            showStats={false}
            themeColors={themeColors}
          />

          {/* Exit present mode button - floating */}
          <button
            onClick={() => setIsPresentMode(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 1000,
              backdropFilter: "blur(10px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            }}
          >
            <Minimize2 className="h-4 w-4" />
            Exit Present (ESC)
          </button>
        </div>

        {/* Bottom controls - Player controls */}
        <div
          className="p-4 flex-shrink-0"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex justify-center items-center">
            <PlayerControls className="w-full max-w-lg" />
          </div>
        </div>

        {/* Path player (non-visual) */}
        <PathPlayer />
      </div>
    );
  }

  // Normal editor view
  return (
    <div
      className="flex h-screen w-full flex-col"
      style={{ backgroundColor: themeColors.background }}
    >
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between border-b p-4"
        style={{
          backgroundColor: themeColors.background,
          borderColor: adjustColorOpacity(themeColors.muted, 0.2),
        }}
      >
        {/* Mode switcher */}
        <div className="flex items-center gap-2 rounded-lg p-2 shadow-lg" style={{
          backgroundColor: themeColors.background,
          border: `2px solid ${themeColors.primary}`,
          zIndex: 1000,
        }}>
          <button
            onClick={() => setEditorMode("edit")}
            style={{
              backgroundColor: editorMode === "edit" ? themeColors.primary : "transparent",
              color: editorMode === "edit" ? "#ffffff" : themeColors.text,
              border: editorMode === "edit" ? "none" : `2px solid ${themeColors.muted}`,
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              if (editorMode !== "edit") {
                e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.2);
              }
            }}
            onMouseLeave={(e) => {
              if (editorMode !== "edit") {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setEditorMode("path")}
            style={{
              backgroundColor: editorMode === "path" ? themeColors.primary : "transparent",
              color: editorMode === "path" ? "#ffffff" : themeColors.text,
              border: editorMode === "path" ? "none" : `2px solid ${themeColors.muted}`,
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              if (editorMode !== "path") {
                e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.2);
              }
            }}
            onMouseLeave={(e) => {
              if (editorMode !== "path") {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Route className="h-4 w-4" />
            Path
          </button>
          <button
            onClick={() => setEditorMode("export")}
            style={{
              backgroundColor: editorMode === "export" ? themeColors.primary : "transparent",
              color: editorMode === "export" ? "#ffffff" : themeColors.text,
              border: editorMode === "export" ? "none" : `2px solid ${themeColors.muted}`,
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              if (editorMode !== "export") {
                e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.2);
              }
            }}
            onMouseLeave={(e) => {
              if (editorMode !== "export") {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* Center toolbar */}
        <PreziToolbar themeColors={themeColors} />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* New button */}
          <button
            onClick={handleNew}
            disabled={isSaving}
            style={{
              backgroundColor: "transparent",
              color: themeColors.text,
              border: `2px solid ${adjustColorOpacity(themeColors.muted, 0.3)}`,
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: isSaving ? "wait" : "pointer",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Plus className="h-4 w-4" />
            New
          </button>

          {/* Save button */}
          {presentationId && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: saveStatus === "saved" ? "#10b981" : saveStatus === "error" ? "#ef4444" : "transparent",
                color: saveStatus === "saved" || saveStatus === "error" ? "#ffffff" : themeColors.text,
                border: saveStatus === "saved" || saveStatus === "error" ? "none" : `2px solid ${adjustColorOpacity(themeColors.muted, 0.3)}`,
                borderRadius: "8px",
                padding: "8px 16px",
                cursor: isSaving ? "wait" : "pointer",
                fontSize: "14px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (saveStatus === "idle") {
                  e.currentTarget.style.backgroundColor = adjustColorOpacity(themeColors.accent, 0.1);
                }
              }}
              onMouseLeave={(e) => {
                if (saveStatus === "idle") {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Save className="h-4 w-4" />
                  Saved
                </>
              ) : saveStatus === "error" ? (
                <>
                  <Save className="h-4 w-4" />
                  Error
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </button>
          )}

          {/* Present button */}
          <button
            onClick={() => setIsPresentMode(true)}
            style={{
              backgroundColor: themeColors.primary,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Presentation className="h-4 w-4" />
            Present (F5)
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Layer panel */}
          <div
            className="w-80 border-r p-4 flex flex-col"
            style={{
              backgroundColor: themeColors.background,
              borderColor: adjustColorOpacity(themeColors.muted, 0.2),
            }}
          >
            <LayerPanel />
          </div>

          {/* Center - Canvas */}
          <div className="flex-1">
            <PreziCanvas
              showGrid={true}
              showStats={false}
              themeColors={themeColors}
            />
          </div>

          {/* Right sidebar - Conditional panel */}
          <div
            className="w-80 border-l p-4 flex flex-col"
            style={{
              backgroundColor: themeColors.background,
              borderColor: adjustColorOpacity(themeColors.muted, 0.2),
            }}
          >
            {/* Debug indicator */}
            <div
              className="mb-4 rounded px-2 py-1 text-xs font-mono"
              style={{
                backgroundColor: adjustColorOpacity(themeColors.primary, 0.1),
                color: themeColors.primary,
              }}
            >
              Mode: {editorMode}
            </div>

            {editorMode === "edit" ? (
              <ElementProperties />
            ) : editorMode === "path" ? (
              <PathEditor />
            ) : (
              <ExportPanel presentationTitle={initialData?.title || "Prezi Presentation"} />
            )}
          </div>
        </div>

        {/* Bottom controls - Player controls (ALWAYS SHOW FOR DEBUGGING) */}
        <div
          className="border-t p-4 flex-shrink-0"
          style={{
            backgroundColor: adjustColorOpacity(themeColors.primary, 0.03),
            borderColor: adjustColorOpacity(themeColors.primary, 0.2),
            borderTopWidth: "1px",
          }}
        >
          <div className="flex justify-center items-center">
            <PlayerControls className="w-full max-w-lg" />
          </div>
        </div>
      </div>

      {/* Path player (non-visual) */}
      <PathPlayer />

      {/* Create Prezi Dialog */}
      <CreatePreziDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onConfirm={handleConfirmCreate}
      />
    </div>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  let r = 0, g = 0, b = 0;

  if (color.startsWith("#")) {
    const hex = color.substring(1);
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      r = parseInt(hex[0]! + hex[0], 16);
      g = parseInt(hex[1]! + hex[1], 16);
      b = parseInt(hex[2]! + hex[2], 16);
    }
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default PreziEditor;
