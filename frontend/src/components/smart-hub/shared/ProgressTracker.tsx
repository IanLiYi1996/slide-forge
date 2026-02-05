"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type HubSessionStatus, type ProcessingMode } from "@/types/smart-hub";

interface Step {
  id: string;
  label: string;
  description?: string;
}

interface ProgressTrackerProps {
  mode: ProcessingMode;
  status: HubSessionStatus;
  currentPageIndex?: number;
  totalPages?: number;
  className?: string;
}

// Define steps for each mode
const GENERATE_STEPS: Step[] = [
  { id: "input", label: "Input", description: "Enter your content" },
  { id: "outline", label: "Outline", description: "Generate and refine outline" },
  { id: "slides", label: "Slides", description: "Generate slide images" },
  { id: "export", label: "Export", description: "Download your presentation" },
];

const PROCESS_STEPS: Step[] = [
  { id: "upload", label: "Upload", description: "Upload your document" },
  { id: "process", label: "Process", description: "Modify each page with AI" },
  { id: "export", label: "Export", description: "Download processed pages" },
];

const EXTRACT_STEPS: Step[] = [
  { id: "upload", label: "Upload", description: "Upload your document" },
  { id: "extract", label: "Extract", description: "Extract content from pages" },
  { id: "transform", label: "Transform", description: "Convert to new format" },
  { id: "export", label: "Export", description: "Download your content" },
];

function getStepsForMode(mode: ProcessingMode): Step[] {
  switch (mode) {
    case "generate":
      return GENERATE_STEPS;
    case "process":
      return PROCESS_STEPS;
    case "extract":
      return EXTRACT_STEPS;
  }
}

function getCurrentStepIndex(
  mode: ProcessingMode,
  status: HubSessionStatus
): number {
  switch (mode) {
    case "generate":
      switch (status) {
        case "idle":
          return 0;
        case "uploading":
        case "analyzing":
          return 0;
        case "outline_generation":
          return 1;
        case "slide_generation":
          return 2;
        case "completed":
          return 3;
        default:
          return 0;
      }
    case "process":
      switch (status) {
        case "idle":
        case "uploading":
          return 0;
        case "page_processing":
          return 1;
        case "completed":
          return 2;
        default:
          return 0;
      }
    case "extract":
      switch (status) {
        case "idle":
        case "uploading":
          return 0;
        case "extracting":
          return 1;
        case "analyzing":
          return 2;
        case "completed":
          return 3;
        default:
          return 0;
      }
  }
}

export function ProgressTracker({
  mode,
  status,
  currentPageIndex,
  totalPages,
  className,
}: ProgressTrackerProps) {
  const steps = getStepsForMode(mode);
  const currentStepIndex = getCurrentStepIndex(mode, status);
  const isError = status === "error";

  return (
    <div className={cn("w-full", className)}>
      {/* Steps indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent &&
                      !isError &&
                      "border-primary bg-primary/10 text-primary",
                    isCurrent && isError && "border-destructive bg-destructive/10 text-destructive",
                    isPending && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isCurrent && !isError ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-2 font-medium",
                    (isCompleted || isCurrent) && !isError && "text-primary",
                    isCurrent && isError && "text-destructive",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress details */}
      {totalPages !== undefined && totalPages > 0 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-muted-foreground">
            {status === "slide_generation" && (
              <span>
                Generating slide {(currentPageIndex ?? 0) + 1} of {totalPages}
              </span>
            )}
            {status === "page_processing" && (
              <span>
                Processing page {(currentPageIndex ?? 0) + 1} of {totalPages}
              </span>
            )}
            {status === "extracting" && (
              <span>
                Extracting content from page {(currentPageIndex ?? 0) + 1} of{" "}
                {totalPages}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {["slide_generation", "page_processing", "extracting"].includes(status) && (
            <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(((currentPageIndex ?? 0) + 1) / totalPages) * 100}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Compact inline progress indicator
interface CompactProgressProps {
  status: HubSessionStatus;
  message?: string;
  progress?: number; // 0-100
  className?: string;
}

export function CompactProgress({
  status,
  message,
  progress,
  className,
}: CompactProgressProps) {
  const isActive = [
    "uploading",
    "analyzing",
    "outline_generation",
    "slide_generation",
    "page_processing",
    "extracting",
  ].includes(status);

  const isError = status === "error";
  const isCompleted = status === "completed";

  if (!isActive && !isError && !isCompleted) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        isActive && "bg-primary/10 text-primary",
        isError && "bg-destructive/10 text-destructive",
        isCompleted && "bg-green-500/10 text-green-600",
        className
      )}
    >
      {isActive && <Loader2 className="w-4 h-4 animate-spin" />}
      {isError && <Circle className="w-4 h-4" />}
      {isCompleted && <Check className="w-4 h-4" />}
      <span className="flex-1">{message || getDefaultMessage(status)}</span>
      {progress !== undefined && isActive && (
        <span className="font-medium">{Math.round(progress)}%</span>
      )}
    </div>
  );
}

function getDefaultMessage(status: HubSessionStatus): string {
  switch (status) {
    case "uploading":
      return "Uploading file...";
    case "analyzing":
      return "Analyzing content...";
    case "outline_generation":
      return "Generating outline...";
    case "slide_generation":
      return "Generating slides...";
    case "page_processing":
      return "Processing pages...";
    case "extracting":
      return "Extracting content...";
    case "completed":
      return "Completed!";
    case "error":
      return "An error occurred";
    default:
      return "";
  }
}
