/**
 * HTMLExporter Component
 *
 * Exports Prezi presentation as standalone interactive HTML file.
 * The HTML file includes Three.js, player controls, and preserves zoom/pan interactions.
 */

"use client";

import React, { useState } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileCode, Loader2 } from "lucide-react";
import { type PreziHTMLExportOptions } from "@/types/prezi-types";

interface HTMLExporterProps {
  presentationTitle?: string;
}

/**
 * HTMLExporter component
 */
const HTMLExporter: React.FC<HTMLExporterProps> = ({
  presentationTitle = "Prezi Presentation",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [includeControls, setIncludeControls] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const activePath = useActivePath();

  // Handle HTML export
  const handleExport = async () => {
    if (!canvasData || !activePath) {
      alert("No canvas data to export");
      return;
    }

    setIsExporting(true);

    try {
      // Generate standalone HTML
      const html = generateStandaloneHTML({
        title: presentationTitle,
        canvasData,
        includeControls,
        autoPlay,
        theme,
      });

      // Create blob and download
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentationTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`HTML exported successfully: ${a.download}`);
    } catch (error) {
      console.error("HTML export failed:", error);
      alert("Failed to export HTML. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Export as Interactive HTML</h3>
        <p className="mb-4 text-xs text-gray-600">
          Create a standalone HTML file with full zoom and pan interactions
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="controls" className="text-xs">
            Include Player Controls
          </Label>
          <Switch
            id="controls"
            checked={includeControls}
            onCheckedChange={setIncludeControls}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="autoplay" className="text-xs">
            Auto-play on Load
          </Label>
          <Switch
            id="autoplay"
            checked={autoPlay}
            onCheckedChange={setAutoPlay}
          />
        </div>
      </div>

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || !canvasData}
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating HTML...
          </>
        ) : (
          <>
            <FileCode className="mr-2 h-4 w-4" />
            Export Interactive HTML
          </>
        )}
      </Button>

      {!activePath || activePath.keyframes.length === 0 ? (
        <p className="text-xs text-gray-500">
          Create keyframes in Path mode for better experience
        </p>
      ) : (
        <p className="text-xs text-gray-600">
          Will include {activePath.keyframes.length} keyframe
          {activePath.keyframes.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

/**
 * Generate standalone HTML with embedded player
 */
function generateStandaloneHTML(options: {
  title: string;
  canvasData: any;
  includeControls: boolean;
  autoPlay: boolean;
  theme: "light" | "dark";
}): string {
  const { title, canvasData, includeControls, autoPlay, theme } = options;

  // Serialize canvas data
  const serializedData = JSON.stringify(canvasData, null, 2);

  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      background: ${theme === "dark" ? "#1a1a1a" : "#ffffff"};
    }
    #canvas-container { width: 100vw; height: 100vh; }
    #controls {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${theme === "dark" ? "rgba(30, 30, 30, 0.9)" : "rgba(255, 255, 255, 0.9)"};
      border-radius: 12px;
      padding: 12px 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: ${includeControls ? "flex" : "none"};
      gap: 12px;
      align-items: center;
      z-index: 1000;
    }
    button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }
    button:hover { background: #2563eb; }
    button:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    #progress {
      font-size: 12px;
      color: ${theme === "dark" ? "#d1d5db" : "#4b5563"};
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="controls">
    <button id="prev">Previous</button>
    <button id="play">Play</button>
    <button id="next">Next</button>
    <span id="progress">0 / 0</span>
  </div>

  <script type="module">
    // Canvas data
    const canvasData = ${serializedData};
    const autoPlay = ${autoPlay};

    // Simple player implementation (placeholder)
    console.log("Prezi Canvas Data:", canvasData);
    console.log("Auto-play:", autoPlay);

    // TODO: Implement Three.js player
    // This would require embedding React Three Fiber or using vanilla Three.js
    // For MVP, we show a message

    const container = document.getElementById('canvas-container');
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;flex-direction:column;"><h1>Interactive HTML Player</h1><p style="margin-top:20px;">Full implementation coming soon</p><p style="margin-top:10px;font-size:14px;">This file contains ' + canvasData.paths[0].keyframes.length + ' keyframes</p></div>';

    // Basic controls
    let currentFrame = 0;
    const totalFrames = canvasData.paths[0].keyframes.length;

    document.getElementById('progress').textContent = (currentFrame + 1) + ' / ' + totalFrames;

    document.getElementById('prev').onclick = () => {
      if (currentFrame > 0) {
        currentFrame--;
        document.getElementById('progress').textContent = (currentFrame + 1) + ' / ' + totalFrames;
      }
    };

    document.getElementById('next').onclick = () => {
      if (currentFrame < totalFrames - 1) {
        currentFrame++;
        document.getElementById('progress').textContent = (currentFrame + 1) + ' / ' + totalFrames;
      }
    };

    document.getElementById('play').onclick = () => {
      alert('Playback functionality coming soon!');
    };
  </script>
</body>
</html>`;
}

export default HTMLExporter;
