/**
 * Test page for Prezi Editor
 *
 * This page demonstrates the Prezi canvas editor with sample elements.
 * Access at: http://localhost:3000/test-prezi
 *
 * Features to test:
 * 1. Edit Mode:
 *    - Select elements (click)
 *    - Multi-select (Ctrl+Click)
 *    - Pan canvas (H key or Pan tool)
 *    - Zoom (scroll wheel)
 *    - Edit properties (position, size, rotation, scale, opacity)
 *    - Delete elements (Delete/Backspace key)
 *    - Undo/Redo (Ctrl+Z/Y)
 *
 * 2. Path Mode:
 *    - Switch to Path mode (top button)
 *    - Adjust camera view in canvas
 *    - Click "Capture Current View" to create keyframes
 *    - Create 3-5 keyframes at different camera positions
 *    - Click Play to test path animation
 *    - Use Previous/Next buttons to navigate frames
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { usePresentationState } from "@/states/presentation-state";
import PreziEditor from "@/components/presentation/prezi/editor/PreziEditor";
import { generateDemoPresentation, generateMinimalDemo } from "@/lib/presentation/prezi/demo-data";

/**
 * Test page component
 */
export default function TestPreziPage() {
  const [demoType, setDemoType] = useState<"full" | "minimal" | null>(null);
  const setCanvasData = usePreziEditorStore((state) => state.setCanvasData);
  const setTheme = usePresentationState((state) => state.setTheme);
  const setPresentationMode = usePresentationState((state) => state.setPresentationMode);

  // Initialize presentation state for Prezi mode
  useEffect(() => {
    setPresentationMode("PREZI");
    setTheme("mystique"); // Set default theme
    // Note: Theme variables are automatically applied by usePreziTheme hook in child components
  }, [setPresentationMode, setTheme]);

  // Load demo data
  useEffect(() => {
    if (demoType) {
      const timer = setTimeout(() => {
        const demoData =
          demoType === "full"
            ? generateDemoPresentation()
            : generateMinimalDemo();
        setCanvasData(demoData);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [demoType, setCanvasData]);

  // Show demo selector if no demo loaded
  if (!demoType) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="w-full max-w-2xl space-y-6 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">
              Prezi Editor Test Page
            </h1>
            <p className="mt-2 text-muted-foreground">
              Choose a demo to get started
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => setDemoType("full")}
              className="rounded-lg border-2 border-primary/30 bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-primary">
                Full Demo
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                7 elements with pre-configured path (7 keyframes)
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>• Title and subtitle</li>
                <li>• 3 feature sections</li>
                <li>• Image example</li>
                <li>• Complete zoom path</li>
              </ul>
            </button>

            <button
              onClick={() => setDemoType("minimal")}
              className="rounded-lg border-2 border-muted bg-card p-6 text-left transition-all hover:border-muted-foreground hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-foreground">
                Minimal Demo
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Single element, empty path (for manual testing)
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>• 1 text element</li>
                <li>• Empty canvas</li>
                <li>• Create your own path</li>
              </ul>
            </button>
          </div>

          <div className="rounded-lg bg-primary/10 p-4 text-sm text-foreground">
            <strong>💡 Pro Tips:</strong>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• Press Ctrl+S to save your work</li>
              <li>• Click "New" button to create a new presentation</li>
              <li>• Use keyboard shortcuts (click ⌨️ icon in toolbar)</li>
              <li>• Auto-save enabled (every 30 seconds)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <PreziEditor />
    </div>
  );
}
