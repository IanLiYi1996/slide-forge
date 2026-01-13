/**
 * TransitionPicker Component
 *
 * Visual transition effect picker for keyframe-to-keyframe animations.
 * Displays all available transitions grouped by category with preview cards.
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePreziTheme } from "@/hooks/usePreziTheme";
import { cn } from "@/lib/utils";
import {
  TRANSITION_PRESETS,
  TRANSITION_CATEGORIES,
  getRecommendedDuration,
} from "@/lib/presentation/prezi/transition-presets";
import { type TransitionType } from "@/types/prezi-types";
import { Sparkles, Clock, Zap } from "lucide-react";

interface TransitionPickerProps {
  currentTransition?: TransitionType;
  onSelect: (type: TransitionType) => void;
  className?: string;
}

/**
 * TransitionPreviewCard - Individual transition card with animation preview
 */
const TransitionPreviewCard: React.FC<{
  type: TransitionType;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ type, isSelected, onSelect }) => {
  const { mounted, themeColors } = usePreziTheme();
  const [isHovered, setIsHovered] = useState(false);
  const preset = TRANSITION_PRESETS[type];

  if (!mounted) return null;

  // Format transition name (convert "ease-in-out" to "Ease In Out")
  const formatName = (name: string): string => {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get icon based on transition category
  const getIcon = () => {
    if (type.includes("elastic") || type.includes("bounce")) {
      return <Sparkles className="h-4 w-4" />;
    }
    if (type === "zoom-reveal" || type === "pan-zoom" || type === "focus-shift") {
      return <Zap className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:scale-105",
        isSelected && "ring-2"
      )}
      style={{
        backgroundColor: isHovered
          ? `${themeColors.primary}10`
          : isSelected
          ? `${themeColors.primary}15`
          : themeColors.background,
        borderColor: isSelected ? themeColors.primary : `${themeColors.muted}40`,
        boxShadow: isSelected
          ? `0 4px 12px ${themeColors.primary}40`
          : "0 2px 4px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Icon and duration */}
        <div className="flex items-center justify-between mb-2">
          <div style={{ color: isSelected ? themeColors.primary : themeColors.muted }}>
            {getIcon()}
          </div>
          <Badge
            variant="secondary"
            className="text-xs"
            style={{
              backgroundColor: `${themeColors.accent}20`,
              color: themeColors.text,
            }}
          >
            {preset.duration}s
          </Badge>
        </div>

        {/* Transition name */}
        <div
          className="font-medium text-sm mb-1"
          style={{
            color: isSelected ? themeColors.primary : themeColors.heading,
          }}
        >
          {formatName(type)}
        </div>

        {/* Description */}
        <div
          className="text-xs leading-relaxed"
          style={{
            color: themeColors.muted,
          }}
        >
          {preset.description}
        </div>

        {/* Visual preview curve (simplified SVG) */}
        <div className="mt-3">
          <svg
            width="100%"
            height="24"
            viewBox="0 0 100 24"
            style={{ opacity: isHovered || isSelected ? 1 : 0.5 }}
          >
            <path
              d={getPreviewCurvePath(type)}
              fill="none"
              stroke={isSelected ? themeColors.primary : themeColors.accent}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Get SVG path for transition preview curve
 */
const getPreviewCurvePath = (type: TransitionType): string => {
  // Simplified visual representations
  const curves: Record<string, string> = {
    linear: "M 0,12 L 100,12",
    ease: "M 0,20 Q 25,20 50,12 T 100,4",
    "ease-in": "M 0,20 Q 50,20 100,4",
    "ease-out": "M 0,20 Q 50,4 100,4",
    "ease-in-out": "M 0,20 Q 25,20 50,12 Q 75,4 100,4",
    "elastic-in": "M 0,12 Q 20,12 40,4 Q 60,20 80,8 Q 90,14 100,12",
    "elastic-out": "M 0,12 Q 20,18 40,8 Q 60,4 80,10 Q 90,12 100,12",
    "bounce-in": "M 0,12 L 70,12 Q 80,4 85,12 Q 90,18 95,12 Q 97,8 100,12",
    "bounce-out": "M 0,12 Q 10,18 20,12 Q 30,8 40,12 L 100,12",
    "back-in": "M 0,12 Q 30,20 70,8 Q 85,4 100,12",
    "back-out": "M 0,12 Q 30,4 70,16 Q 85,20 100,12",
    swoop: "M 0,20 Q 30,4 50,12 Q 70,20 100,12",
    dive: "M 0,4 Q 40,4 60,16 Q 80,20 100,12",
    orbit: "M 0,12 Q 25,4 50,12 Q 75,20 100,12",
    spiral: "M 0,12 Q 20,4 40,12 Q 60,20 80,12 L 100,12",
    "zoom-reveal": "M 0,20 Q 20,4 40,12 Q 60,12 80,4 Q 90,12 100,12",
    "pan-zoom": "M 0,16 Q 40,16 60,8 Q 80,4 100,4",
    "focus-shift": "M 0,20 Q 30,4 60,8 Q 80,12 100,12",
  };

  return curves[type] || curves["ease"] || "M 0,12 L 100,12";
};

/**
 * Main TransitionPicker Component
 */
const TransitionPicker: React.FC<TransitionPickerProps> = ({
  currentTransition = "ease-in-out",
  onSelect,
  className,
}) => {
  const { mounted, themeColors } = usePreziTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  if (!mounted) return null;

  // Get all transitions or filter by category
  const filteredTransitions =
    selectedCategory === "all"
      ? (Object.keys(TRANSITION_PRESETS) as TransitionType[])
      : (TRANSITION_CATEGORIES[selectedCategory as keyof typeof TRANSITION_CATEGORIES]?.types as TransitionType[]) || [];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={selectedCategory === "all" ? "default" : "outline"}
          onClick={() => setSelectedCategory("all")}
          className="text-xs"
        >
          All ({Object.keys(TRANSITION_PRESETS).length})
        </Button>
        {Object.entries(TRANSITION_CATEGORIES).map(([key, category]) => (
          <Button
            key={key}
            size="sm"
            variant={selectedCategory === key ? "default" : "outline"}
            onClick={() => setSelectedCategory(key)}
            className="text-xs"
          >
            {category.label} ({category.types.length})
          </Button>
        ))}
      </div>

      {/* Transition cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredTransitions.map((type) => (
          <TransitionPreviewCard
            key={type}
            type={type}
            isSelected={currentTransition === type}
            onSelect={() => onSelect(type)}
          />
        ))}
      </div>

      {/* Selected transition info */}
      {currentTransition && (
        <Card
          style={{
            backgroundColor: `${themeColors.primary}10`,
            borderColor: `${themeColors.primary}30`,
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="text-sm font-medium"
                style={{ color: themeColors.primary }}
              >
                Selected:
              </div>
              <div className="text-sm font-bold" style={{ color: themeColors.heading }}>
                {currentTransition
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              </div>
              <Badge variant="secondary" className="ml-auto">
                {getRecommendedDuration(currentTransition)}s
              </Badge>
            </div>
            <div className="text-xs" style={{ color: themeColors.muted }}>
              {TRANSITION_PRESETS[currentTransition]?.description}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransitionPicker;
