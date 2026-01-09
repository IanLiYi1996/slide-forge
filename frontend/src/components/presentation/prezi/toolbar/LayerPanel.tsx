/**
 * LayerPanel Component
 *
 * Layer management panel for organizing elements:
 * - List all elements with hierarchy
 * - Show/hide elements
 * - Lock/unlock elements
 * - Reorder layers (z-index)
 * - Delete elements
 */

"use client";

import React from "react";
import {
  usePreziEditorStore,
  useElementsArray,
} from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, Unlock, Trash2, Type, Image as ImageIcon, Code } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * LayerPanel component
 */
const LayerPanel: React.FC = () => {
  const elements = useElementsArray();
  const selectedElements = usePreziEditorStore((state) => state.selectedElements);
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const deleteElement = usePreziEditorStore((state) => state.deleteElement);

  // Get theme colors using unified hook
  const { mounted, themeColors } = usePreziTheme();

  // Show loading during hydration
  if (!mounted) {
    return null;
  }

  // Sort by zIndex (highest first)
  const sortedElements = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  // Get icon for element type
  const getElementIcon = (type: string) => {
    switch (type) {
      case "text":
        return Type;
      case "image":
        return ImageIcon;
      case "html":
        return Code;
      default:
        return Type;
    }
  };

  // Handle element click (select)
  const handleElementClick = (id: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      if (selectedElements.includes(id)) {
        selectElements(selectedElements.filter((eid) => eid !== id));
      } else {
        selectElements([...selectedElements, id]);
      }
    } else {
      // Single select
      selectElements([id]);
    }
  };

  // Toggle visibility (placeholder)
  const handleToggleVisibility = (id: string) => {
    // TODO: Add visibility property to element type
    console.log("Toggle visibility:", id);
  };

  // Toggle lock
  const handleToggleLock = (id: string, currentLocked: boolean) => {
    updateElement(id, { locked: !currentLocked });
  };

  // Delete element
  const handleDelete = (id: string) => {
    if (confirm("Delete this element?")) {
      deleteElement(id);
    }
  };

  return (
    <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
      <CardHeader className="px-0 flex-shrink-0">
        <CardTitle className="text-sm">Layers</CardTitle>
        <p className="text-xs opacity-60">{elements.length} elements</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-1 overflow-y-auto px-0">
        {sortedElements.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: themeColors.muted }}>
            No elements yet
          </p>
        ) : (
          sortedElements.map((element) => {
            const Icon = getElementIcon(element.type);
            const isSelected = selectedElements.includes(element.id);

            return (
              <div
                key={element.id}
                className="group flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-all cursor-pointer"
                style={{
                  backgroundColor: isSelected
                    ? `${themeColors.primary}18`
                    : "transparent",
                  color: isSelected ? themeColors.primary : themeColors.text,
                  border: isSelected
                    ? `1px solid ${themeColors.primary}50`
                    : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = `${themeColors.accent}15`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                onClick={(e) => handleElementClick(element.id, e)}
                role="button"
                tabIndex={0}
              >
                {/* Element icon */}
                <Icon className="h-4 w-4 flex-shrink-0" />

                {/* Element info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {element.type === "text"
                      ? "Text Element"
                      : element.type === "image"
                      ? "Image Element"
                      : element.type === "html"
                      ? "HTML Element"
                      : element.type.charAt(0).toUpperCase() +
                        element.type.slice(1)}
                  </div>
                  <div className="text-xs" style={{ color: themeColors.muted }}>
                    z: {element.zIndex}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Visibility toggle (placeholder) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    style={{ color: themeColors.muted }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(element.id);
                    }}
                    title="Toggle visibility"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>

                  {/* Lock toggle */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleLock(element.id, element.locked);
                    }}
                    title={element.locked ? "Unlock" : "Lock"}
                  >
                    {element.locked ? (
                      <Lock className="h-3 w-3" style={{ color: "#f59e0b" }} />
                    ) : (
                      <Unlock className="h-3 w-3" style={{ color: themeColors.muted }} />
                    )}
                  </Button>

                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    style={{ color: "#ef4444" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(element.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default LayerPanel;
