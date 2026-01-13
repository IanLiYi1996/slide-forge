/**
 * UnifiedKeyframePanel Component
 *
 * Unified sidebar panel that combines:
 * - Element Pool (top): All elements with drag-and-drop support
 * - Keyframe List (bottom): Keyframes with their associated elements
 *
 * Features:
 * - Drag elements from pool to keyframes
 * - Visual feedback for drag operations
 * - Collapsible element pool
 * - Element usage indicators
 */

"use client";

import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  usePreziEditorStore,
  useActivePath,
  useElementsArray,
  addElementToKeyframe,
  removeElementFromKeyframe,
  associateAllElementsToAllKeyframes,
} from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  X,
  Type,
  Image as ImageIcon,
  Code,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PreziElement } from "@/types/prezi-types";
import { ANIMATION_VARIANTS } from "@/lib/presentation/prezi/animation-utils";

/**
 * Get icon for element type
 */
const getElementIcon = (type: string) => {
  switch (type) {
    case "text":
      return Type;
    case "image":
      return ImageIcon;
    case "html":
      return Code;
    default:
      return Package;
  }
};

/**
 * DraggableElement - Element item that can be dragged
 */
const DraggableElement: React.FC<{
  element: PreziElement;
  usedInKeyframes: number[];
}> = ({ element, usedInKeyframes }) => {
  const { themeColors } = usePreziTheme();
  const Icon = getElementIcon(element.type);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: element.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:scale-[1.03]",
        isDragging && "opacity-50"
      )}
      style={{
        backgroundColor: `${themeColors.muted}10`,
        border: `1px solid ${themeColors.muted}30`,
      }}
    >
      <GripVertical className="h-4 w-4" style={{ color: themeColors.muted }} />
      <Icon className="h-4 w-4" style={{ color: themeColors.text }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: themeColors.text }}>
          {element.type === "text" ? "Text" : element.type === "image" ? "Image" : element.type}
        </div>
      </div>
      {usedInKeyframes.length > 0 ? (
        <Badge variant="secondary" className="text-xs">
          {usedInKeyframes.join(", ")}
        </Badge>
      ) : (
        <span className="text-xs" style={{ color: themeColors.muted }}>
          Unused
        </span>
      )}
    </div>
  );
};

/**
 * KeyframeElementItem - Draggable element item inside a keyframe
 */
const KeyframeElementItem: React.FC<{
  element: PreziElement;
  keyframe: any;
  index: number;
  isSelected: boolean;
  onElementClick: (id: string, event: React.MouseEvent) => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
  onDelete: () => void;
}> = ({ element, keyframe, index, isSelected, onElementClick, onToggleVisibility, onRemove, onDelete }) => {
  const { themeColors } = usePreziTheme();
  const Icon = getElementIcon(element.type);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `keyframe-element-${keyframe.id}-${element.id}`,
    data: { elementId: element.id, keyframeId: keyframe.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all hover:scale-[1.02]",
        isDragging && "opacity-30"
      )}
      style={{
        backgroundColor: isSelected
          ? `${themeColors.primary}18`
          : `${themeColors.muted}08`,
        border: `1px solid ${isSelected ? themeColors.primary + '50' : 'transparent'}`,
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Drag to move or remove"
      >
        <GripVertical className="h-3 w-3" style={{ color: themeColors.muted }} />
      </div>

      {/* Element info */}
      <div
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={(e) => onElementClick(element.id, e)}
      >
        <Icon className="h-3 w-3 flex-shrink-0" style={{ color: themeColors.text }} />
        <span className="flex-1 text-xs truncate" style={{ color: themeColors.text }}>
          {element.type === "text" ? "Text" : element.type === "image" ? "Image" : element.type}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
        {/* Toggle visibility */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          title={element.visible === false ? "Show" : "Hide"}
        >
          {element.visible === false ? (
            <EyeOff className="h-3 w-3" style={{ color: "#9ca3af" }} />
          ) : (
            <Eye className="h-3 w-3" style={{ color: themeColors.muted }} />
          )}
        </Button>

        {/* Remove from keyframe */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 hover:bg-orange-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from this keyframe"
        >
          <X className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
        </Button>

        {/* Delete element permanently */}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 hover:bg-red-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete element permanently"
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
        </Button>
      </div>
    </div>
  );
};

/**
 * ElementPool - Top section showing all elements (also a drop zone for removal)
 */
const ElementPool: React.FC<{
  elements: PreziElement[];
  getElementUsage: (elementId: string) => number[];
  isOver: boolean;
}> = ({ elements, getElementUsage, isOver }) => {
  const { themeColors } = usePreziTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { setNodeRef } = useDroppable({
    id: "element-pool",
  });

  return (
    <GlassCard
      ref={setNodeRef}
      blur={12}
      className="m-4 relative"
      style={{
        background: `linear-gradient(135deg, ${themeColors.gradientStart || themeColors.primary}10, ${themeColors.gradientEnd || themeColors.accent}08)`,
        ...(isOver && {
          border: `2px dashed ${themeColors.primary}`,
          boxShadow: `0 0 20px ${themeColors.primary}40`,
        }),
      }}
    >
      {/* Drop indicator for element pool */}
      {isOver && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div
            className="px-4 py-2 rounded-lg font-semibold text-sm"
            style={{
              backgroundColor: themeColors.primary,
              color: "#fff",
            }}
          >
            Drop here to remove from keyframe
          </div>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" style={{ color: themeColors.primary }} />
            <CardTitle className="text-sm">Element Pool</CardTitle>
            <Badge variant="secondary">{elements.length}</Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs mt-1" style={{ color: themeColors.muted }}>
          Drag elements to keyframes below
        </p>
      </CardHeader>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="pt-0 space-y-1 max-h-64 overflow-y-auto">
              {elements.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: themeColors.muted }}>
                  No elements yet. Create elements in Edit mode.
                </p>
              ) : (
                elements.map((element) => (
                  <DraggableElement
                    key={element.id}
                    element={element}
                    usedInKeyframes={getElementUsage(element.id)}
                  />
                ))
              )}
            </CardContent>          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
};

/**
 * KeyframeCardContent - Individual keyframe card with drop zone
 */
const KeyframeCardContent: React.FC<{
  keyframe: any;
  elements: PreziElement[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}> = ({ keyframe, elements, isCollapsed, onToggleCollapse }) => {
  const { themeColors } = usePreziTheme();
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const selectedElements = usePreziEditorStore((state) => state.selectedElements);
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const updateCamera = usePreziEditorStore((state) => state.updateCamera);
  const setCurrentKeyframeIndex = usePreziEditorStore((state) => state.setCurrentKeyframeIndex);
  const deleteElement = usePreziEditorStore((state) => state.deleteElement);

  const { setNodeRef, isOver } = useDroppable({
    id: `keyframe-${keyframe.id}`,
  });

  const handleElementClick = (id: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (selectedElements.includes(id)) {
        selectElements(selectedElements.filter((eid) => eid !== id));
      } else {
        selectElements([...selectedElements, id]);
      }
    } else {
      selectElements([id]);
    }
  };

  // ✨ Handle keyframe card click - jump to this keyframe
  const handleKeyframeClick = () => {
    if (!canvasData) return;

    console.log(`[UnifiedPanel] Jumping to keyframe ${keyframe.order + 1}`);

    // Update camera to keyframe's camera state
    updateCamera(keyframe.camera);

    // Update current keyframe index (triggers PreziCamera to apply the change)
    setCurrentKeyframeIndex(keyframe.order);

    // Update element visibility based on keyframe.visibleElements
    const visibleElementIds = keyframe.visibleElements || [];
    if (visibleElementIds.length > 0) {
      Object.keys(canvasData.elements).forEach((elementId) => {
        const shouldBeVisible = visibleElementIds.includes(elementId);
        updateElement(elementId, { visible: shouldBeVisible });
      });
      console.log(`[UnifiedPanel] Updated visibility: ${visibleElementIds.length} elements visible`);
    }
  };

  return (
    <GlassCard
      ref={setNodeRef}
      blur={10}
      className="keyframe-card relative"
      style={{
        borderLeft: `4px solid ${themeColors.primary}`,
        transition: 'all 0.3s',
      }}
    >
      {/* Drag-over indicator */}
      {isOver && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div
            className="absolute inset-0 border-2 border-dashed animate-pulse"
            style={{ borderColor: themeColors.primary }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}20, ${themeColors.accent}10)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="px-4 py-2 rounded-lg font-semibold text-sm"
              style={{
                backgroundColor: themeColors.primary,
                color: "#fff",
              }}
            >
              Drop here to add element
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          {/* Collapse toggle */}
          <motion.div
            className="cursor-pointer flex-shrink-0"
            onClick={onToggleCollapse}
            whileHover={{ scale: 1.1 }}
          >
            <motion.div
              animate={{ rotate: isCollapsed ? 0 : 90 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: themeColors.primary }} />
            </motion.div>
          </motion.div>

          {/* Keyframe info - clickable to preview */}
          <div
            className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleKeyframeClick}
            title="Click to preview this keyframe"
          >
            <div className="font-semibold text-sm" style={{ color: themeColors.heading }}>
              Frame {keyframe.order + 1}
              {keyframe.title && `: ${keyframe.title}`}
            </div>
            <div className="text-xs" style={{ color: themeColors.muted }}>
              {elements.length} element{elements.length !== 1 ? "s" : ""}
            </div>
          </div>

          <Badge variant="secondary">{keyframe.order + 1}</Badge>
        </div>

        {/* Element list */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              className="mt-3 space-y-1"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {elements.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: themeColors.muted }}>
                  No elements. Drag from pool above or click +
                </p>
              ) : (
                elements.map((element, index) => (
                  <KeyframeElementItem
                    key={element.id}
                    element={element}
                    keyframe={keyframe}
                    index={index}
                    isSelected={selectedElements.includes(element.id)}
                    onElementClick={handleElementClick}
                    onToggleVisibility={() => updateElement(element.id, { visible: !(element.visible === false) })}
                    onRemove={() => removeElementFromKeyframe(element.id, keyframe.id)}
                    onDelete={() => {
                      if (confirm("Delete this element permanently from all keyframes?")) {
                        deleteElement(element.id);
                      }
                    }}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </GlassCard>
  );
};

/**
 * Main UnifiedKeyframePanel Component
 */
const UnifiedKeyframePanel: React.FC = () => {
  const activePath = useActivePath();
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const allElements = useElementsArray();
  const { mounted, themeColors } = usePreziTheme();

  const [activeElement, setActiveElement] = useState<PreziElement | null>(null);
  const [overedKeyframe, setOveredKeyframe] = useState<string | null>(null);
  const [collapsedKeyframes, setCollapsedKeyframes] = useState<Set<string>>(new Set());

  if (!mounted) return null;

  // Get element usage (which keyframes use each element)
  const getElementUsage = (elementId: string): number[] => {
    if (!activePath) return [];
    return activePath.keyframes
      .filter((kf) => kf.visibleElements?.includes(elementId))
      .map((kf) => kf.order + 1);
  };

  // Get elements for each keyframe
  const getKeyframeElements = (keyframeId: string): PreziElement[] => {
    if (!canvasData) {
      console.log("[getKeyframeElements] No canvas data");
      return [];
    }
    const keyframe = activePath?.keyframes.find((kf) => kf.id === keyframeId);
    if (!keyframe) {
      console.log("[getKeyframeElements] Keyframe not found:", keyframeId);
      return [];
    }

    const visibleIds = keyframe.visibleElements || [];
    console.log(`[getKeyframeElements] Frame ${keyframe.order + 1} visibleElements:`, visibleIds);

    const elements = visibleIds
      .map((id) => {
        const el = canvasData.elements[id];
        if (!el) {
          console.warn(`[getKeyframeElements] Element ${id} not found in canvas data`);
        }
        return el;
      })
      .filter((el): el is PreziElement => el !== undefined);

    console.log(`[getKeyframeElements] Frame ${keyframe.order + 1} returning ${elements.length} elements`);
    return elements;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const elementId = event.active.id as string;
    const element = canvasData?.elements[elementId];
    console.log("[UnifiedPanel] Drag started:", elementId);
    if (element) {
      setActiveElement(element);
    }
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    console.log("[UnifiedPanel] Drag over:", overId);

    if (overId === "element-pool") {
      setOveredKeyframe("pool");
    } else if (overId && overId.startsWith("keyframe-")) {
      setOveredKeyframe(overId.replace("keyframe-", ""));
    } else {
      setOveredKeyframe(null);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log("[UnifiedPanel] Drag end - active:", active.id, "over:", over?.id);

    const activeId = active.id as string;
    const overId = over?.id as string | undefined;

    if (!overId) {
      console.log("[UnifiedPanel] Drag cancelled - no drop target");
      setActiveElement(null);
      setOveredKeyframe(null);
      return;
    }

    // Case 1: Dragging from element pool to keyframe
    if (!activeId.startsWith("keyframe-element-") && overId.startsWith("keyframe-")) {
      const elementId = activeId;
      const keyframeId = overId.replace("keyframe-", "");
      console.log(`[UnifiedPanel] Adding element ${elementId} to keyframe ${keyframeId}`);
      addElementToKeyframe(elementId, keyframeId);
    }
    // Case 2: Dragging from keyframe back to element pool (removal)
    else if (activeId.startsWith("keyframe-element-") && overId === "element-pool") {
      // Parse the active ID to get elementId and keyframeId
      // Format: keyframe-element-{keyframeId}-{elementId}
      const parts = activeId.split("-");
      if (parts.length >= 4) {
        const keyframeId = parts[2];
        const elementId = parts.slice(3).join("-"); // Handle element IDs with dashes
        if (keyframeId && elementId) {
          console.log(`[UnifiedPanel] Removing element ${elementId} from keyframe ${keyframeId}`);
          removeElementFromKeyframe(elementId, keyframeId);
        }
      }
    }
    // Case 3: Dragging between keyframes (move element)
    else if (activeId.startsWith("keyframe-element-") && overId.startsWith("keyframe-")) {
      const parts = activeId.split("-");
      if (parts.length >= 4) {
        const fromKeyframeId = parts[2];
        const elementId = parts.slice(3).join("-");
        const toKeyframeId = overId.replace("keyframe-", "");

        if (fromKeyframeId && elementId && fromKeyframeId !== toKeyframeId) {
          console.log(`[UnifiedPanel] Moving element ${elementId} from ${fromKeyframeId} to ${toKeyframeId}`);
          // Remove from old keyframe
          removeElementFromKeyframe(elementId, fromKeyframeId);
          // Add to new keyframe
          addElementToKeyframe(elementId, toKeyframeId);
        }
      }
    } else {
      console.log("[UnifiedPanel] Invalid drag operation");
    }

    setActiveElement(null);
    setOveredKeyframe(null);
  };

  // Toggle keyframe collapse
  const toggleKeyframeCollapse = (keyframeId: string) => {
    setCollapsedKeyframes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyframeId)) {
        newSet.delete(keyframeId);
      } else {
        newSet.add(keyframeId);
      }
      return newSet;
    });
  };

  // Sort keyframes by order
  const sortedKeyframes = activePath?.keyframes
    ? [...activePath.keyframes].sort((a, b) => a.order - b.order)
    : [];

  // Check if keyframes have empty visibleElements (needs sync)
  const needsSync = sortedKeyframes.some((kf) => {
    const elements = getKeyframeElements(kf.id);
    const totalElements = allElements.length;
    return totalElements > 0 && elements.length === 0;
  });

  // Handle sync - associate all elements with all keyframes
  const handleSync = () => {
    if (!canvasData || !activePath) return;

    if (confirm("Associate all elements with all keyframes?\n\nThis will make every element visible in every keyframe. You can then use drag-to-remove to refine.")) {
      // Use the existing function that handles Immer correctly
      associateAllElementsToAllKeyframes();
    }
  };

  // No keyframes state
  if (!activePath || sortedKeyframes.length === 0) {
    return (
      <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
        <CardHeader className="px-4 flex-shrink-0">
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-center" style={{ color: themeColors.muted }}>
            No keyframes yet.
            <br />
            Create keyframes in Path mode.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        {/* Sync button (if needed) */}
        {needsSync && (
          <div className="mx-4 mt-4">
            <Button
              variant="gradient"
              size="sm"
              className="w-full"
              onClick={handleSync}
            >
              <Package className="h-3 w-3 mr-2" />
              Sync Elements to Keyframes
            </Button>
            <p className="text-xs mt-1 text-center" style={{ color: themeColors.muted }}>
              Keyframes are empty. Click to auto-associate elements.
            </p>
          </div>
        )}

        {/* Element Pool */}
        <ElementPool
          elements={allElements}
          getElementUsage={getElementUsage}
          isOver={overedKeyframe === "pool"}
        />

        {/* Keyframe List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {sortedKeyframes.map((keyframe) => {
            const elements = getKeyframeElements(keyframe.id);

            return (
              <KeyframeCardContent
                key={keyframe.id}
                keyframe={keyframe}
                elements={elements}
                isCollapsed={collapsedKeyframes.has(keyframe.id)}
                onToggleCollapse={() => toggleKeyframeCollapse(keyframe.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Drag Overlay (Ghost element) */}
      <DragOverlay>
        {activeElement && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 0.8 }}
            className="p-3 rounded-lg"
            style={{
              background: themeColors.glassBackground || `${themeColors.primary}80`,
              backdropFilter: 'blur(12px)',
              border: `2px solid ${themeColors.primary}`,
              boxShadow: `0 8px 32px ${themeColors.shadowColor || 'rgba(0,0,0,0.3)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              {React.createElement(getElementIcon(activeElement.type), {
                className: "h-4 w-4",
                style: { color: "#fff" },
              })}
              <span className="text-sm font-medium text-white">
                {activeElement.type} Element
              </span>
            </div>
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default UnifiedKeyframePanel;
