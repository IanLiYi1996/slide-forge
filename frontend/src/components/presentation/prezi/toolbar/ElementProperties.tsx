/**
 * ElementProperties Component
 *
 * Properties panel for editing selected elements:
 * - Position (X, Y, Z)
 * - Size (Width, Height)
 * - Rotation (X, Y, Z)
 * - Scale
 * - Opacity
 */

"use client";

import React from "react";
import { usePreziEditorStore, useSelectedElementsData } from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * ElementProperties component
 */
const ElementProperties: React.FC = () => {
  const selectedElements = useSelectedElementsData();
  const updateElement = usePreziEditorStore((state) => state.updateElement);

  // Get theme colors using unified hook
  const { mounted, themeColors } = usePreziTheme();

  // Show loading during hydration
  if (!mounted) {
    return null;
  }

  // No selection
  if (selectedElements.length === 0) {
    return (
      <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
        <CardHeader className="px-0 flex-shrink-0">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent className="px-0 flex-1">
          <p className="text-sm opacity-60">No element selected</p>
        </CardContent>
      </Card>
    );
  }

  // Multi-selection (simplified)
  if (selectedElements.length > 1) {
    return (
      <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
        <CardHeader className="px-0 flex-shrink-0">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent className="px-0 flex-1">
          <p className="text-sm">
            {selectedElements.length} elements selected
          </p>
          <p className="mt-2 text-xs opacity-60">
            Multi-element editing coming soon
          </p>
        </CardContent>
      </Card>
    );
  }

  // Single selection
  const element = selectedElements[0]!;

  // Handle text content change (for text elements)
  const handleTextChange = (value: string) => {
    if (element.type === "text") {
      updateElement(element.id, {
        content: [
          {
            type: "p",
            children: [{ text: value }],
          },
        ],
      } as any);
    }
  };

  // Handle image URL change (for image elements)
  const handleImageUrlChange = (value: string) => {
    if (element.type === "image") {
      updateElement(element.id, {
        url: value,
      } as any);
    }
  };

  // Handle background color change (for text and html elements)
  const handleBackgroundColorChange = (value: string) => {
    if (element.type === "text" || element.type === "html") {
      updateElement(element.id, {
        backgroundColor: value,
      } as any);
    }
  };

  // Handle HTML content change (for html elements)
  const handleHTMLChange = (value: string) => {
    if (element.type === "html") {
      updateElement(element.id, {
        htmlContent: value,
      } as any);
    }
  };

  // Handle CSS change (for html elements)
  const handleCSSChange = (value: string) => {
    if (element.type === "html") {
      updateElement(element.id, {
        css: value,
      } as any);
    }
  };

  const handlePositionChange = (axis: "x" | "y" | "z", value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateElement(element.id, {
        position: {
          ...element.position,
          [axis]: numValue,
        },
      });
    }
  };

  const handleSizeChange = (dimension: "width" | "height", value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateElement(element.id, {
        size: {
          ...element.size,
          [dimension]: numValue,
        },
      });
    }
  };

  const handleRotationChange = (axis: "x" | "y" | "z", value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateElement(element.id, {
        rotation: {
          ...element.rotation,
          [axis]: (numValue * Math.PI) / 180, // Convert degrees to radians
        },
      });
    }
  };

  const handleScaleChange = (value: number[]) => {
    updateElement(element.id, {
      scale: value[0]!,
    });
  };

  const handleOpacityChange = (value: number[]) => {
    updateElement(element.id, {
      opacity: value[0]!,
    });
  };

  return (
    <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col" style={{ color: themeColors.text }}>
      <CardHeader className="px-0 flex-shrink-0">
        <CardTitle className="text-sm" style={{ color: themeColors.heading }}>Properties</CardTitle>
        <p className="text-xs" style={{ color: themeColors.muted }}>
          {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Element
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-0 flex-1 overflow-y-auto">
        {/* Content editing - Text */}
        {element.type === "text" && (
          <div className="space-y-2 pb-4 border-b" style={{ borderColor: adjustColorOpacity(themeColors.muted, 0.2) }}>
            <Label className="text-xs font-semibold">Text Content</Label>
            <textarea
              value={
                element.content
                  .map((node: any) => {
                    if (node.type === "p" && node.children) {
                      return node.children
                        .map((child: any) => child.text || "")
                        .join("");
                    }
                    return "";
                  })
                  .join("\n") || ""
              }
              onChange={(e) => handleTextChange(e.target.value)}
              className="w-full rounded border p-2 text-sm"
              style={{
                backgroundColor: themeColors.background,
                color: themeColors.text,
                borderColor: adjustColorOpacity(themeColors.muted, 0.3),
                minHeight: "80px",
              }}
              placeholder="Enter text content..."
            />
            <div className="space-y-2">
              <Label htmlFor="bg-color" className="text-xs">
                Background Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="bg-color"
                  type="text"
                  value={element.backgroundColor === "transparent" ? "transparent" : (element.backgroundColor || "#ffffff")}
                  onChange={(e) => handleBackgroundColorChange(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="#ffffff or transparent"
                />
                {element.backgroundColor !== "transparent" && (
                  <input
                    type="color"
                    value={element.backgroundColor || "#ffffff"}
                    onChange={(e) => handleBackgroundColorChange(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border"
                    style={{ borderColor: adjustColorOpacity(themeColors.muted, 0.3) }}
                  />
                )}
                <Button
                  size="sm"
                  variant={element.backgroundColor === "transparent" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => handleBackgroundColorChange("transparent")}
                  title="Transparent background"
                >
                  {element.backgroundColor === "transparent" ? "✓" : "⊘"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Content editing - Image */}
        {element.type === "image" && (
          <div className="space-y-2 pb-4 border-b" style={{ borderColor: adjustColorOpacity(themeColors.muted, 0.2) }}>
            <Label className="text-xs font-semibold">Image URL</Label>
            <Input
              type="text"
              value={element.url}
              onChange={(e) => handleImageUrlChange(e.target.value)}
              className="h-8 text-xs"
              placeholder="https://example.com/image.jpg"
            />
            <div className="mt-2 rounded overflow-hidden" style={{ border: `1px solid ${adjustColorOpacity(themeColors.muted, 0.2)}` }}>
              <img
                src={element.url}
                alt="Preview"
                className="w-full h-24 object-cover"
                onError={(e) => {
                  e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23ddd' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3ENo Image%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
          </div>
        )}

        {/* Content editing - HTML */}
        {element.type === "html" && (
          <div className="space-y-2 pb-4 border-b" style={{ borderColor: adjustColorOpacity(themeColors.muted, 0.2) }}>
            <Label className="text-xs font-semibold">HTML Content</Label>
            <textarea
              value={element.htmlContent || ""}
              onChange={(e) => handleHTMLChange(e.target.value)}
              className="w-full rounded border p-2 text-xs font-mono"
              style={{
                backgroundColor: themeColors.background,
                color: themeColors.text,
                borderColor: adjustColorOpacity(themeColors.muted, 0.3),
                minHeight: "120px",
              }}
              placeholder="<div>Your HTML here...</div>"
            />
            <Label className="text-xs font-semibold mt-2">Custom CSS (Optional)</Label>
            <textarea
              value={element.css || ""}
              onChange={(e) => handleCSSChange(e.target.value)}
              className="w-full rounded border p-2 text-xs font-mono"
              style={{
                backgroundColor: themeColors.background,
                color: themeColors.text,
                borderColor: adjustColorOpacity(themeColors.muted, 0.3),
                minHeight: "80px",
              }}
              placeholder=".my-class { color: red; }"
            />
            <div className="space-y-2 mt-2">
              <Label htmlFor="html-bg-color" className="text-xs">
                Background Color
              </Label>
              <div className="flex gap-2">
                <Input
                  id="html-bg-color"
                  type="text"
                  value={element.backgroundColor === "transparent" ? "transparent" : (element.backgroundColor || "#ffffff")}
                  onChange={(e) => handleBackgroundColorChange(e.target.value)}
                  className="h-8 text-xs flex-1"
                  placeholder="#ffffff or transparent"
                />
                {element.backgroundColor !== "transparent" && (
                  <input
                    type="color"
                    value={element.backgroundColor || "#ffffff"}
                    onChange={(e) => handleBackgroundColorChange(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border"
                    style={{ borderColor: adjustColorOpacity(themeColors.muted, 0.3) }}
                  />
                )}
                <Button
                  size="sm"
                  variant={element.backgroundColor === "transparent" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => handleBackgroundColorChange("transparent")}
                  title="Transparent background"
                >
                  {element.backgroundColor === "transparent" ? "✓" : "⊘"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Position */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Position</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="pos-x" className="text-xs text-prezi-ui-muted">
                X
              </Label>
              <Input
                id="pos-x"
                type="number"
                value={Math.round(element.position.x)}
                onChange={(e) => handlePositionChange("x", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="pos-y" className="text-xs text-prezi-ui-muted">
                Y
              </Label>
              <Input
                id="pos-y"
                type="number"
                value={Math.round(element.position.y)}
                onChange={(e) => handlePositionChange("y", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="pos-z" className="text-xs text-prezi-ui-muted">
                Z
              </Label>
              <Input
                id="pos-z"
                type="number"
                value={Math.round(element.position.z)}
                onChange={(e) => handlePositionChange("z", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="size-w" className="text-xs text-prezi-ui-muted">
                Width
              </Label>
              <Input
                id="size-w"
                type="number"
                value={Math.round(element.size.width)}
                onChange={(e) => handleSizeChange("width", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="size-h" className="text-xs text-prezi-ui-muted">
                Height
              </Label>
              <Input
                id="size-h"
                type="number"
                value={Math.round(element.size.height)}
                onChange={(e) => handleSizeChange("height", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Rotation (degrees)</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="rot-x" className="text-xs text-prezi-ui-muted">
                X
              </Label>
              <Input
                id="rot-x"
                type="number"
                value={Math.round((element.rotation.x * 180) / Math.PI)}
                onChange={(e) => handleRotationChange("x", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="rot-y" className="text-xs text-prezi-ui-muted">
                Y
              </Label>
              <Input
                id="rot-y"
                type="number"
                value={Math.round((element.rotation.y * 180) / Math.PI)}
                onChange={(e) => handleRotationChange("y", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="rot-z" className="text-xs text-prezi-ui-muted">
                Z
              </Label>
              <Input
                id="rot-z"
                type="number"
                value={Math.round((element.rotation.z * 180) / Math.PI)}
                onChange={(e) => handleRotationChange("z", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Scale */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Scale</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[element.scale]}
              onValueChange={handleScaleChange}
              min={0.1}
              max={5}
              step={0.1}
              className="flex-1"
            />
            <span className="min-w-[40px] text-xs" style={{ color: themeColors.text }}>
              {element.scale.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Opacity */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Opacity</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={[element.opacity]}
              onValueChange={handleOpacityChange}
              min={0}
              max={1}
              step={0.05}
              className="flex-1"
            />
            <span className="min-w-[40px] text-xs" style={{ color: themeColors.text }}>
              {Math.round(element.opacity * 100)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Helper function to adjust color opacity
 */
function adjustColorOpacity(color: string, opacity: number): string {
  let r = 0,
    g = 0,
    b = 0;

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

export default ElementProperties;
