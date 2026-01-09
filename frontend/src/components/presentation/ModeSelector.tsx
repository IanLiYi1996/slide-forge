/**
 * ModeSelector Component
 *
 * Allows users to choose between Traditional and Prezi presentation modes.
 */

"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Presentation, Route, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  selectedMode?: "TRADITIONAL" | "PREZI";
  onModeSelect: (mode: "TRADITIONAL" | "PREZI") => void;
}

/**
 * ModeSelector component
 */
const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
}) => {
  const modes = [
    {
      id: "TRADITIONAL" as const,
      title: "Traditional Slides",
      description: "Classic linear slide-by-slide presentation",
      icon: Presentation,
      features: [
        "Linear slide sequence",
        "Easy to create and edit",
        "Standard export formats (PDF, PPTX)",
        "Familiar presentation style",
      ],
    },
    {
      id: "PREZI" as const,
      title: "Prezi Canvas",
      description: "Dynamic canvas with zoom and pan navigation",
      icon: Route,
      features: [
        "Infinite canvas with free positioning",
        "Zoom path animation",
        "3D transformations",
        "Interactive HTML export",
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose Presentation Mode</h2>
        <p className="mt-2 text-sm text-gray-600">
          Select the presentation style that best fits your needs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;

          return (
            <Card
              key={mode.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                isSelected && "ring-2 ring-blue-600"
              )}
              onClick={() => onModeSelect(mode.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{mode.title}</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {mode.description}
                      </CardDescription>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mode.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "mt-4 w-full",
                    isSelected ? "bg-blue-600" : "bg-gray-200 text-gray-700"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onModeSelect(mode.id);
                  }}
                >
                  {isSelected ? "Selected" : "Select this mode"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedMode && (
        <div className="rounded-lg border bg-blue-50 p-4 text-center">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> You cannot change the presentation mode after
            creation. Choose carefully!
          </p>
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
