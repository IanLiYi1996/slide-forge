"use client";

import { type ImageModelConfig } from "@/states/presentation-state";
import { type AspectRatio, type ImageSize } from "@/app/_actions/image/generate";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image, Wand2 } from "lucide-react";

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "4:3", label: "4:3 (Standard)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "9:16", label: "9:16 (Portrait)" },
];

const IMAGE_SIZES: { value: ImageSize; label: string }[] = [
  { value: "1K", label: "1K (Fast)" },
  { value: "2K", label: "2K (Balanced)" },
  { value: "4K", label: "4K (High Quality)" },
];

interface ImageSourceSelectorProps {
  imageSource: "ai" | "stock";
  imageModel: ImageModelConfig;
  stockImageProvider: "unsplash";
  onImageSourceChange: (source: "ai" | "stock") => void;
  onImageModelChange: (model: ImageModelConfig) => void;
  onStockImageProviderChange: (provider: "unsplash") => void;
  className?: string;
  showLabel?: boolean;
}

export function ImageSourceSelector({
  imageSource,
  imageModel,
  stockImageProvider,
  onImageSourceChange,
  onImageModelChange,
  onStockImageProviderChange,
  className,
  showLabel = true,
}: ImageSourceSelectorProps) {
  return (
    <div className={className}>
      {showLabel && (
        <Label className="text-sm font-medium mb-2 block">Image Source</Label>
      )}

      {/* Image Source Type */}
      <Select
        value={imageSource === "ai" ? "ai" : `stock-${stockImageProvider}`}
        onValueChange={(value) => {
          if (value === "ai") {
            onImageSourceChange("ai");
          } else if (value.startsWith("stock-")) {
            const provider = value.replace("stock-", "") as "unsplash";
            onImageSourceChange("stock");
            onStockImageProviderChange(provider);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select image source" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-primary/80 flex items-center gap-1">
              <Wand2 size={10} />
              AI Generation
            </SelectLabel>
            <SelectItem value="ai">yunwu API (Gemini 3 Pro)</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-primary/80 flex items-center gap-1">
              <Image size={10} />
              Stock Images
            </SelectLabel>
            <SelectItem value="stock-unsplash">Unsplash (Free)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* AI Configuration - Only show if AI is selected */}
      {imageSource === "ai" && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
              <Select
                value={imageModel.aspectRatio}
                onValueChange={(value) =>
                  onImageModelChange({
                    ...imageModel,
                    aspectRatio: value as AspectRatio,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Resolution</Label>
              <Select
                value={imageModel.imageSize}
                onValueChange={(value) =>
                  onImageModelChange({
                    ...imageModel,
                    imageSize: value as ImageSize,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
