"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type HubPage } from "@/types/smart-hub";

interface PageNavigatorProps {
  pages: HubPage[];
  currentIndex: number;
  onPageChange: (index: number) => void;
  showStatus?: boolean;
  showThumbnails?: boolean;
  className?: string;
}

export function PageNavigator({
  pages,
  currentIndex,
  onPageChange,
  showStatus = true,
  showThumbnails = false,
  className,
}: PageNavigatorProps) {
  const totalPages = pages.length;
  const isFirstPage = currentIndex === 0;
  const isLastPage = currentIndex === totalPages - 1;

  // Calculate visible page numbers for pagination
  const getVisiblePages = () => {
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const half = Math.floor(maxVisible / 2);
    let start = Math.max(0, currentIndex - half);
    const end = Math.min(totalPages - 1, start + maxVisible - 1);

    // Adjust start if we're near the end
    if (end === totalPages - 1) {
      start = Math.max(0, end - maxVisible + 1);
    }

    const visible: (number | "ellipsis")[] = [];

    // Add first page if not visible
    if (start > 0) {
      visible.push(0);
      if (start > 1) {
        visible.push("ellipsis");
      }
    }

    // Add visible pages
    for (let i = start; i <= end; i++) {
      if (i !== 0 && i !== totalPages - 1) {
        visible.push(i);
      } else if (i === 0 && start === 0) {
        visible.push(i);
      } else if (i === totalPages - 1 && end === totalPages - 1) {
        visible.push(i);
      }
    }

    // Add last page if not visible
    if (end < totalPages - 1) {
      if (end < totalPages - 2) {
        visible.push("ellipsis");
      }
      visible.push(totalPages - 1);
    }

    return visible;
  };

  const getStatusColor = (status: HubPage["status"]) => {
    switch (status) {
      case "ready":
        return "bg-green-500";
      case "processing":
        return "bg-blue-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  if (totalPages === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {/* Previous button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentIndex - 1)}
        disabled={isFirstPage}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {getVisiblePages().map((page, idx) => {
          if (page === "ellipsis") {
            return (
              <DropdownMenu key={`ellipsis-${idx}`}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="max-h-60 overflow-auto">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={() => onPageChange(i)}
                      className={cn(
                        "cursor-pointer",
                        i === currentIndex && "bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {showStatus && pages[i] && (
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              getStatusColor(pages[i].status)
                            )}
                          />
                        )}
                        <span>Page {i + 1}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          const pageData = pages[page];
          const isActive = page === currentIndex;

          return (
            <Button
              key={page}
              variant={isActive ? "default" : "outline"}
              size="icon"
              className={cn("w-8 h-8 relative", isActive && "pointer-events-none")}
              onClick={() => onPageChange(page)}
            >
              {page + 1}
              {showStatus && pageData && (
                <div
                  className={cn(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full border border-background",
                    getStatusColor(pageData.status)
                  )}
                />
              )}
            </Button>
          );
        })}
      </div>

      {/* Next button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentIndex + 1)}
        disabled={isLastPage}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Page count */}
      <span className="text-sm text-muted-foreground ml-2">
        {currentIndex + 1} of {totalPages}
      </span>
    </div>
  );
}

// Thumbnail variant for visual navigation
interface PageThumbnailsProps {
  pages: HubPage[];
  currentIndex: number;
  onPageChange: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  thumbnailSize?: "sm" | "md" | "lg";
  className?: string;
}

export function PageThumbnails({
  pages,
  currentIndex,
  onPageChange,
  orientation = "horizontal",
  thumbnailSize = "md",
  className,
}: PageThumbnailsProps) {
  const sizeClasses = {
    sm: "w-12 h-16",
    md: "w-16 h-20",
    lg: "w-24 h-32",
  };

  const getStatusColor = (status: HubPage["status"]) => {
    switch (status) {
      case "ready":
        return "ring-green-500";
      case "processing":
        return "ring-blue-500 animate-pulse";
      case "error":
        return "ring-red-500";
      default:
        return "ring-gray-300";
    }
  };

  if (pages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex gap-2 p-2 overflow-auto",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className
      )}
    >
      {pages.map((page, index) => {
        const isActive = index === currentIndex;
        const thumbnailUrl = page.outputImageUrl || page.imageDataUrl;

        return (
          <button
            key={page.id}
            onClick={() => onPageChange(index)}
            className={cn(
              "relative flex-shrink-0 rounded-md overflow-hidden border-2 transition-all",
              sizeClasses[thumbnailSize],
              isActive
                ? "border-primary ring-2 ring-primary/50"
                : "border-muted hover:border-primary/50",
              getStatusColor(page.status)
            )}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Page ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">{index + 1}</span>
              </div>
            )}

            {/* Page number badge */}
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
              {index + 1}
            </div>
          </button>
        );
      })}
    </div>
  );
}
