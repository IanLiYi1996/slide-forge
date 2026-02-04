"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getModeDescription,
  getAllModeDescriptions,
} from "@/lib/smart-hub/mode-detector";
import { type ProcessingMode } from "@/types/smart-hub";

interface ModeSelectorProps {
  suggestedMode?: ProcessingMode;
  confidence?: number;
  selectedMode: ProcessingMode | null;
  onSelect: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

export function ModeSelector({
  suggestedMode,
  confidence = 0,
  selectedMode,
  onSelect,
  disabled = false,
}: ModeSelectorProps) {
  const allModes = getAllModeDescriptions();
  const modes: ProcessingMode[] = ["generate", "process", "extract"];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Choose Processing Mode</h3>
        {suggestedMode && confidence > 0.6 && (
          <p className="text-sm text-muted-foreground mt-1">
            Based on your input, we recommend{" "}
            <span className="font-medium text-primary">
              {getModeDescription(suggestedMode).title}
            </span>{" "}
            mode
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {modes.map((mode) => {
          const info = allModes[mode];
          const isSelected = selectedMode === mode;
          const isSuggested = suggestedMode === mode;

          return (
            <Card
              key={mode}
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary border-primary",
                isSuggested && !isSelected && "border-primary/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && onSelect(mode)}
            >
              {isSuggested && (
                <Badge
                  className="absolute -top-2 -right-2 bg-primary"
                  variant="default"
                >
                  Recommended
                </Badge>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <CardTitle className="text-lg">{info.title}</CardTitle>
                  {isSelected && (
                    <Check className="h-5 w-5 text-primary ml-auto" />
                  )}
                </div>
                <CardDescription>{info.description}</CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {info.useCases.map((useCase, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">-</span>
                      {useCase}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Compact inline mode selector
interface CompactModeSelectorProps {
  selectedMode: ProcessingMode | null;
  onSelect: (mode: ProcessingMode) => void;
  disabled?: boolean;
  className?: string;
}

export function CompactModeSelector({
  selectedMode,
  onSelect,
  disabled = false,
  className,
}: CompactModeSelectorProps) {
  const modes: Array<{ mode: ProcessingMode; icon: string; label: string }> = [
    { mode: "generate", icon: "✨", label: "Generate" },
    { mode: "process", icon: "🔄", label: "Process" },
    { mode: "extract", icon: "📑", label: "Extract" },
  ];

  return (
    <div className={cn("flex gap-2", className)}>
      {modes.map(({ mode, icon, label }) => (
        <Button
          key={mode}
          variant={selectedMode === mode ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(mode)}
          disabled={disabled}
          className="gap-1.5"
        >
          <span>{icon}</span>
          {label}
        </Button>
      ))}
    </div>
  );
}
