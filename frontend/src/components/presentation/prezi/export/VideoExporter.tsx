/**
 * VideoExporter Component
 *
 * Exports Prezi presentation as video (MP4/WebM) or animated GIF.
 * Records the path playback animation.
 */

"use client";

import React, { useState } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Video, Loader2 } from "lucide-react";
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";
import GIF from "gif.js";

interface VideoExporterProps {
  presentationTitle?: string;
}

/**
 * VideoExporter component
 */
const VideoExporter: React.FC<VideoExporterProps> = ({
  presentationTitle = "Prezi Presentation",
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [format, setFormat] = useState<"mp4" | "webm" | "gif">("gif");

  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const activePath = useActivePath();
  const playPath = usePreziEditorStore((state) => state.playPath);
  const stopPlaying = usePreziEditorStore((state) => state.stopPlaying);

  // Handle video export
  const handleExport = async () => {
    if (!canvasData || !activePath || activePath.keyframes.length === 0) {
      alert("No keyframes to export");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      if (format === "gif") {
        await exportAsGIF();
      } else {
        await exportAsVideo(format);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export. Please try again.");
    } finally {
      setIsExporting(false);
      setProgress(0);
      stopPlaying();
    }
  };

  // Export as GIF
  const exportAsGIF = async (): Promise<void> => {
    const canvasElement = document.querySelector("canvas");
    if (!canvasElement || !activePath) return;

    // Create GIF encoder
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: 1280,
      height: 720,
      workerScript: "/gif.worker.js", // Need to add this to public folder
    });

    // Play path and capture frames
    playPath(activePath.id);

    const fps = 30;
    const frameDelay = 1000 / fps;
    const animator = getCameraAnimator();
    const state = animator.getState();
    const totalDuration = state.duration * 1000; // Convert to ms
    const totalFrames = Math.floor(totalDuration / frameDelay);

    let capturedFrames = 0;

    const captureInterval = setInterval(async () => {
      if (capturedFrames >= totalFrames) {
        clearInterval(captureInterval);
        stopPlaying();

        // Render GIF
        gif.on("progress", (p) => {
          setProgress(Math.round(p * 100));
        });

        gif.on("finished", (blob) => {
          // Download GIF
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${presentationTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.gif`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          alert(`GIF exported successfully: ${a.download}`);
        });

        gif.render();
        return;
      }

      // Capture frame
      const context = canvasElement.getContext("2d", { willReadFrequently: true });
      if (context) {
        gif.addFrame(context, { delay: frameDelay, copy: true });
      }

      capturedFrames++;
      setProgress(Math.round((capturedFrames / totalFrames) * 100));
    }, frameDelay);
  };

  // Export as video (MP4/WebM)
  const exportAsVideo = async (videoFormat: "mp4" | "webm"): Promise<void> => {
    const canvasElement = document.querySelector("canvas");
    if (!canvasElement || !activePath) return;

    // Check if MediaRecorder is supported
    if (!("MediaRecorder" in window)) {
      alert("Video recording is not supported in this browser");
      return;
    }

    // Get canvas stream
    const stream = canvasElement.captureStream(30); // 30 fps
    const mimeType = videoFormat === "mp4" ? "video/mp4" : "video/webm";

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${presentationTitle.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.${videoFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Video exported successfully: ${a.download}`);
    };

    // Start recording
    mediaRecorder.start();

    // Play path
    playPath(activePath.id);

    // Get total duration
    const animator = getCameraAnimator();
    const state = animator.getState();
    const totalDuration = state.duration * 1000;

    // Update progress
    const progressInterval = setInterval(() => {
      const currentProgress = animator.getState().progress;
      setProgress(Math.round(currentProgress * 100));
    }, 100);

    // Stop recording after path completes
    setTimeout(() => {
      mediaRecorder.stop();
      clearInterval(progressInterval);
      stopPlaying();
    }, totalDuration + 1000); // Add 1s buffer
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Export as Video/GIF</h3>
        <p className="mb-4 text-xs text-gray-600">
          Record the path animation as video or animated GIF
        </p>
      </div>

      {/* Format selection */}
      <div className="space-y-2">
        <Label className="text-xs">Export Format</Label>
        <RadioGroup value={format} onValueChange={(v) => setFormat(v as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gif" id="gif" />
            <Label htmlFor="gif" className="text-sm font-normal">
              Animated GIF (best compatibility)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="webm" id="webm" />
            <Label htmlFor="webm" className="text-sm font-normal">
              WebM Video (smaller file size)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mp4" id="mp4" />
            <Label htmlFor="mp4" className="text-sm font-normal">
              MP4 Video (universal)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || !activePath || activePath.keyframes.length === 0}
        className="w-full"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Recording... {progress}%
          </>
        ) : (
          <>
            <Video className="mr-2 h-4 w-4" />
            Export {format.toUpperCase()}
          </>
        )}
      </Button>

      {!activePath || activePath.keyframes.length === 0 ? (
        <p className="text-xs text-gray-500">
          Create keyframes in Path mode to export
        </p>
      ) : (
        <p className="text-xs text-yellow-700">
          Note: Recording will play the path automatically
        </p>
      )}
    </div>
  );
};

export default VideoExporter;
