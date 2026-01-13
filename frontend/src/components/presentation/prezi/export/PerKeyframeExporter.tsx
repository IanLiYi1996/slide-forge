/**
 * PerKeyframeExporter Component
 *
 * Export individual keyframes as separate files:
 * - PNG images (high-quality snapshots)
 * - HTML files (interactive single-page)
 * - Batch export with ZIP packaging
 */

"use client";

import React, { useState } from "react";
import { usePreziEditorStore, useActivePath } from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileImage,
  FileCode,
  Package,
  CheckCircle,
  Loader2,
} from "lucide-react";
import {
  exportKeyframesAsPNG,
  exportKeyframesAsHTML,
} from "@/lib/presentation/prezi/per-keyframe-export-utils";

interface PerKeyframeExporterProps {
  presentationTitle?: string;
}

type ExportFormat = "png" | "html";

/**
 * PerKeyframeExporter component
 */
const PerKeyframeExporter: React.FC<PerKeyframeExporterProps> = ({
  presentationTitle = "Prezi Presentation",
}) => {
  const activePath = useActivePath();
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const { mounted, themeColors } = usePreziTheme();

  const [selectedKeyframes, setSelectedKeyframes] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [packageAsZIP, setPackageAsZIP] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "complete" | "error">("idle");

  if (!mounted) return null;

  if (!activePath || !canvasData || activePath.keyframes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm" style={{ color: themeColors.muted }}>
            No keyframes to export. Create keyframes in Path mode first.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Toggle keyframe selection
  const toggleKeyframe = (keyframeId: string) => {
    setSelectedKeyframes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyframeId)) {
        newSet.delete(keyframeId);
      } else {
        newSet.add(keyframeId);
      }
      return newSet;
    });
  };

  // Select all keyframes
  const selectAll = () => {
    setSelectedKeyframes(new Set(activePath.keyframes.map((kf) => kf.id)));
  };

  // Deselect all keyframes
  const selectNone = () => {
    setSelectedKeyframes(new Set());
  };

  // Handle export
  const handleExport = async () => {
    const selectedKfs = activePath.keyframes.filter((kf) =>
      selectedKeyframes.has(kf.id)
    );

    if (selectedKfs.length === 0) {
      alert("Please select at least one keyframe to export");
      return;
    }

    setIsExporting(true);
    setExportStatus("exporting");
    setExportProgress(0);

    try {
      const options = {
        resolution: { width: 1920, height: 1080 },
        scale: 2,
        packageAsZIP,
        theme: "light" as const,
      };

      if (exportFormat === "png") {
        await exportKeyframesAsPNG(
          selectedKfs,
          canvasData,
          updateCamera,
          updateElement,
          options,
          (progress, current, total) => {
            setExportProgress(progress);
          }
        );
      } else if (exportFormat === "html") {
        await exportKeyframesAsHTML(
          selectedKfs,
          canvasData,
          presentationTitle,
          options,
          (progress, current, total) => {
            setExportProgress(progress);
          }
        );
      }

      setExportStatus("complete");
      setTimeout(() => {
        setExportStatus("idle");
        setExportProgress(0);
      }, 3000);
    } catch (error) {
      console.error("[PerKeyframeExporter] Export failed:", error);
      setExportStatus("error");
      alert(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Keyframe Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Select Keyframes</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll}>
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={selectNone}>
                Select None
              </Button>
            </div>
          </div>
          <p className="text-xs mt-1" style={{ color: themeColors.muted }}>
            Choose which keyframes to export
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {activePath.keyframes.map((keyframe) => {
            const isSelected = selectedKeyframes.has(keyframe.id);
            const elementCount = keyframe.visibleElements?.length || 0;

            return (
              <div
                key={keyframe.id}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: isSelected
                    ? `${themeColors.primary}15`
                    : `${themeColors.muted}08`,
                  border: `1px solid ${isSelected ? themeColors.primary + '50' : themeColors.muted + '30'}`,
                }}
                onClick={() => toggleKeyframe(keyframe.id)}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => toggleKeyframe(keyframe.id)} />
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: themeColors.heading }}>
                    Frame {keyframe.order + 1}
                    {keyframe.title && `: ${keyframe.title}`}
                  </div>
                  <div className="text-xs" style={{ color: themeColors.muted }}>
                    {elementCount} element{elementCount !== 1 ? "s" : ""}
                  </div>
                </div>
                <Badge variant="secondary">{keyframe.order + 1}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Export Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export Format</CardTitle>
          <p className="text-xs mt-1" style={{ color: themeColors.muted }}>
            Choose output format for each keyframe
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
            <div className="space-y-3">
              <div
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: exportFormat === "png" ? `${themeColors.primary}10` : "transparent",
                  border: `1px solid ${exportFormat === "png" ? themeColors.primary + '50' : themeColors.muted + '30'}`,
                }}
                onClick={() => setExportFormat("png")}
              >
                <RadioGroupItem value="png" id="format-png" />
                <div className="flex-1">
                  <Label htmlFor="format-png" className="flex items-center gap-2 cursor-pointer">
                    <FileImage className="h-4 w-4" />
                    <span className="font-medium">PNG Images</span>
                  </Label>
                  <p className="text-xs mt-1" style={{ color: themeColors.muted }}>
                    High-quality snapshots (1920x1080, 2x upsampling)
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all"
                style={{
                  backgroundColor: exportFormat === "html" ? `${themeColors.primary}10` : "transparent",
                  border: `1px solid ${exportFormat === "html" ? themeColors.primary + '50' : themeColors.muted + '30'}`,
                }}
                onClick={() => setExportFormat("html")}
              >
                <RadioGroupItem value="html" id="format-html" />
                <div className="flex-1">
                  <Label htmlFor="format-html" className="flex items-center gap-2 cursor-pointer">
                    <FileCode className="h-4 w-4" />
                    <span className="font-medium">HTML Files</span>
                  </Label>
                  <p className="text-xs mt-1" style={{ color: themeColors.muted }}>
                    Interactive single-page HTML (can be opened in browser)
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Package as ZIP</Label>
              <p className="text-xs" style={{ color: themeColors.muted }}>
                Bundle all files into a single ZIP archive
              </p>
            </div>
            <Checkbox
              checked={packageAsZIP}
              onCheckedChange={(checked) => setPackageAsZIP(checked as boolean)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Button */}
      <div>
        {exportStatus === "idle" && (
          <Button
            className="w-full"
            size="lg"
            variant="gradient"
            onClick={handleExport}
            disabled={selectedKeyframes.size === 0 || isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Selected ({selectedKeyframes.size} keyframe{selectedKeyframes.size !== 1 ? "s" : ""})
          </Button>
        )}

        {exportStatus === "exporting" && (
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 p-4 rounded-lg"
              style={{
                backgroundColor: `${themeColors.primary}10`,
                border: `1px solid ${themeColors.primary}30`,
              }}
            >
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: themeColors.primary }} />
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: themeColors.heading }}>
                  Exporting...
                </div>
                <div className="text-xs" style={{ color: themeColors.muted }}>
                  Please wait while we export your keyframes
                </div>
              </div>
            </div>
            <Progress value={exportProgress} className="w-full" />
            <p className="text-xs text-center" style={{ color: themeColors.muted }}>
              {Math.round(exportProgress)}%
            </p>
          </div>
        )}

        {exportStatus === "complete" && (
          <div
            className="flex items-center gap-2 p-4 rounded-lg"
            style={{
              backgroundColor: "#10b98110",
              border: "1px solid #10b98130",
            }}
          >
            <CheckCircle className="h-5 w-5" style={{ color: "#10b981" }} />
            <div className="flex-1">
              <div className="font-medium text-sm" style={{ color: "#10b981" }}>
                Export Complete!
              </div>
              <div className="text-xs" style={{ color: themeColors.muted }}>
                Your files have been downloaded
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerKeyframeExporter;
