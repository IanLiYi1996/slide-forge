/**
 * KeyframeElementsPanel Component
 *
 * Displays elements grouped by keyframes with collapsible sections.
 * Shows which elements belong to which keyframes, making it easier to
 * understand and manage the presentation structure.
 */

"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  usePreziEditorStore,
  useActivePath,
  getElementsByKeyframe,
  getUngroupedElements,
  addElementToKeyframe,
  removeElementFromKeyframe,
  associateAllElementsToAllKeyframes,
} from "@/states/prezi-editor-state";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Type,
  Image as ImageIcon,
  Code,
  ChevronDown,
  ChevronRight,
  Star,
  Plus,
  Link,
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
      return Type;
  }
};

/**
 * KeyframeGroup Component - Collapsible group for each keyframe
 */
const KeyframeGroup: React.FC<{
  keyframeId: string;
  keyframeTitle: string;
  keyframeOrder: number;
  elements: PreziElement[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  allElements: PreziElement[];
}> = ({
  keyframeId,
  keyframeTitle,
  keyframeOrder,
  elements,
  isCollapsed,
  onToggleCollapse,
  allElements,
}) => {
  const { mounted, themeColors } = usePreziTheme();
  const selectedElements = usePreziEditorStore((state) => state.selectedElements);
  const selectElements = usePreziEditorStore((state) => state.selectElements);
  const updateElement = usePreziEditorStore((state) => state.updateElement);
  const deleteElement = usePreziEditorStore((state) => state.deleteElement);
  const [showAddMenu, setShowAddMenu] = useState(false);

  if (!mounted) return null;

  // Get elements not in this keyframe
  const availableElements = allElements.filter(
    (el) => !elements.find((e) => e.id === el.id)
  );

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

  // Toggle visibility
  const handleToggleVisibility = (id: string, currentVisible: boolean) => {
    updateElement(id, { visible: !currentVisible });
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

  // Remove element from this keyframe
  const handleRemoveFromKeyframe = (elementId: string) => {
    if (confirm("Remove element from this keyframe?")) {
      removeElementFromKeyframe(elementId, keyframeId);
    }
  };

  return (
    <motion.div
      className="mb-2"
      {...ANIMATION_VARIANTS.fadeIn}
    >
      {/* Keyframe Header with glass effect */}
      <motion.div
        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer overflow-hidden relative group"
        style={{
          background: themeColors.glassBackground || `${themeColors.primary}10`,
          backdropFilter: "blur(8px)",
          borderLeft: `3px solid ${themeColors.primary}`,
          boxShadow: `0 2px 8px ${themeColors.shadowColor || 'rgba(0,0,0,0.1)'}`,
        }}
        onClick={onToggleCollapse}
        whileHover={{ scale: 1.01, x: 2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.2 }}
      >
        {/* Gradient overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, ${themeColors.gradientStart || themeColors.primary}15, ${themeColors.gradientEnd || themeColors.accent}10)`,
          }}
        />

        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 90 }}
          transition={{ duration: 0.2 }}
          className="relative z-10"
        >
          <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: themeColors.primary }} />
        </motion.div>

        <div className="flex-1 min-w-0 relative z-10">
          <div className="font-semibold text-sm" style={{ color: themeColors.heading }}>
            Frame {keyframeOrder + 1}
            {keyframeTitle && `: ${keyframeTitle}`}
          </div>
          <div className="text-xs font-medium" style={{ color: themeColors.muted }}>
            {elements.length} element{elements.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Add element button */}
        {availableElements.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 relative z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddMenu(!showAddMenu);
            }}
            title="Add elements to this keyframe"
          >
            <Plus className="h-3 w-3" style={{ color: themeColors.primary }} />
          </Button>
        )}
      </motion.div>

      {/* Add element dropdown menu */}
      {showAddMenu && !isCollapsed && availableElements.length > 0 && (
        <motion.div
          className="ml-4 mt-2 mb-2 p-2 rounded-lg"
          style={{
            backgroundColor: `${themeColors.accent}10`,
            border: `1px solid ${themeColors.accent}30`,
          }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="text-xs font-medium mb-2" style={{ color: themeColors.heading }}>
            Add elements:
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {availableElements.map((el) => {
              const Icon = getElementIcon(el.type);
              return (
                <button
                  key={el.id}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-white/50 transition-colors"
                  onClick={() => {
                    addElementToKeyframe(el.id, keyframeId);
                    setShowAddMenu(false);
                  }}
                >
                  <Icon className="h-3 w-3" />
                  <span className="flex-1 text-left truncate">
                    {el.type === "text" ? "Text Element" : `${el.type} Element`}
                  </span>
                  <Plus className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Elements List (collapsible with animation) */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            className="ml-4 mt-1 space-y-1"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {elements.length === 0 ? (
              <p className="py-4 text-center text-xs" style={{ color: themeColors.muted }}>
                No elements in this keyframe
              </p>
            ) : (
              elements.map((element, index) => {
                const Icon = getElementIcon(element.type);
                const isSelected = selectedElements.includes(element.id);

                return (
                  <motion.div
                    key={element.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
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
                    <div
                      className="truncate font-medium"
                      style={{
                        opacity: element.visible === false ? 0.5 : 1,
                        textDecoration: element.visible === false ? "line-through" : "none",
                      }}
                    >
                      {element.type === "text"
                        ? "Text Element"
                        : element.type === "image"
                        ? "Image Element"
                        : element.type === "html"
                        ? "HTML Element"
                        : element.type.charAt(0).toUpperCase() + element.type.slice(1)}
                    </div>
                    <div className="text-xs" style={{ color: themeColors.muted }}>
                      {element.visible === false && "Hidden • "}
                      {element.locked && "Locked"}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* Visibility toggle */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(element.id, element.visible !== false);
                      }}
                      title={element.visible === false ? "Show" : "Hide"}
                    >
                      {element.visible === false ? (
                        <EyeOff className="h-3 w-3" style={{ color: "#9ca3af" }} />
                      ) : (
                        <Eye className="h-3 w-3" style={{ color: themeColors.muted }} />
                      )}
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

                    {/* Remove from keyframe */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      style={{ color: "#f59e0b" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromKeyframe(element.id);
                      }}
                      title="Remove from keyframe"
                    >
                      <Star className="h-3 w-3" />
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
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Main KeyframeElementsPanel Component
 */
const KeyframeElementsPanel: React.FC = () => {
  const activePath = useActivePath();
  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const { mounted, themeColors } = usePreziTheme();

  // Track which keyframes are collapsed
  const [collapsedKeyframes, setCollapsedKeyframes] = useState<Set<string>>(new Set());

  // Get grouped elements and ungrouped elements
  const groupedElements = useMemo(() => getElementsByKeyframe(), [canvasData]);
  const ungroupedElements = useMemo(() => getUngroupedElements(), [canvasData]);

  if (!mounted) return null;

  if (!activePath || activePath.keyframes.length === 0) {
    return (
      <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
        <CardHeader className="px-0 flex-shrink-0">
          <CardTitle className="text-sm">Keyframes</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center px-0">
          <p className="text-sm text-center" style={{ color: themeColors.muted }}>
            No keyframes yet.
            <br />
            Create keyframes in Path mode.
          </p>
        </CardContent>
      </Card>
    );
  }

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
  const sortedKeyframes = [...activePath.keyframes].sort((a, b) => a.order - b.order);

  // Get all elements array
  const allElements = canvasData ? Object.values(canvasData.elements) : [];

  // Count total elements
  const totalElements = allElements.length;

  // Check if all elements are ungrouped (quick fix needed)
  const needsQuickFix = totalElements > 0 && ungroupedElements.length === totalElements;

  // Handle quick fix
  const handleQuickFix = () => {
    const message = `This will associate all ${totalElements} elements with all ${sortedKeyframes.length} keyframes.\n\nThis means every element will be visible in every keyframe.\n\nRecommendation: Use this for quick setup, then manually refine by removing unwanted elements from specific keyframes.\n\nContinue?`;

    if (confirm(message)) {
      associateAllElementsToAllKeyframes();
    }
  };

  return (
    <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
      <CardHeader className="px-0 flex-shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <CardTitle className="text-sm">Keyframes</CardTitle>
            <p className="text-xs" style={{ color: themeColors.muted }}>
              {sortedKeyframes.length} keyframe{sortedKeyframes.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Quick fix button when all elements are ungrouped */}
          {needsQuickFix && (
            <Button
              size="sm"
              variant="gradient"
              onClick={handleQuickFix}
              className="text-xs h-7"
              title="Associate all elements with all keyframes"
            >
              <Plus className="h-3 w-3 mr-1" />
              Link All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 overflow-y-auto px-0">
        {/* Keyframe Groups */}
        {sortedKeyframes.map((keyframe) => {
          const elementsInKeyframe = groupedElements.get(keyframe.id) || [];
          return (
            <KeyframeGroup
              key={keyframe.id}
              keyframeId={keyframe.id}
              keyframeTitle={keyframe.title || ""}
              keyframeOrder={keyframe.order}
              elements={elementsInKeyframe}
              isCollapsed={collapsedKeyframes.has(keyframe.id)}
              onToggleCollapse={() => toggleKeyframeCollapse(keyframe.id)}
              allElements={allElements}
            />
          );
        })}

        {/* Ungrouped Elements Section */}
        {ungroupedElements.length > 0 && (
          <motion.div
            className="mt-4 pt-4 border-t"
            style={{ borderColor: `${themeColors.muted}30` }}
            {...ANIMATION_VARIANTS.fadeIn}
          >
            <GlassCard
              blur={8}
              opacity={0.5}
              className="mb-2"
              style={{
                backgroundColor: `${themeColors.muted}15`,
                borderColor: `${themeColors.muted}30`,
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: themeColors.heading }}>
                      Ungrouped Elements
                    </div>
                    <div className="text-xs" style={{ color: themeColors.muted }}>
                      {ungroupedElements.length} element{ungroupedElements.length !== 1 ? "s" : ""} not assigned to any keyframe
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {ungroupedElements.map((element) => {
                    const Icon = getElementIcon(element.type);
                    const isSelected = usePreziEditorStore.getState().selectedElements.includes(element.id);

                    return (
                      <motion.div
                        key={element.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/30 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: `${themeColors.muted}10`,
                          color: themeColors.text,
                        }}
                        whileHover={{ scale: 1.02, x: 2 }}
                        onClick={() => {
                          usePreziEditorStore.getState().selectElements([element.id]);
                        }}
                      >
                        <Icon className="h-3 w-3" />
                        <span className="flex-1 truncate">
                          {element.type === "text"
                            ? "Text Element"
                            : element.type === "image"
                            ? "Image Element"
                            : `${element.type} Element`}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this element?")) {
                              usePreziEditorStore.getState().deleteElement(element.id);
                            }
                          }}
                          title="Delete element"
                        >
                          <Trash2 className="h-2.5 w-2.5" style={{ color: "#ef4444" }} />
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </GlassCard>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default KeyframeElementsPanel;
