"use client";

import { type AspectRatio, type ImageSize } from "@/app/_actions/image/generate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePresentationState } from "@/states/presentation-state";
import { Image } from "lucide-react";

const ASPECT_RATIOS: { value: AspectRatio; label: string; description: string }[] = [
  { value: "16:9", label: "16:9", description: "Widescreen (Recommended)" },
  { value: "4:3", label: "4:3", description: "Standard" },
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "9:16", label: "9:16", description: "Portrait" },
  { value: "21:9", label: "21:9", description: "Ultra-wide" },
  { value: "3:2", label: "3:2", description: "Classic" },
  { value: "2:3", label: "2:3", description: "Portrait 2:3" },
  { value: "3:4", label: "3:4", description: "Portrait 3:4" },
  { value: "4:5", label: "4:5", description: "Portrait 4:5" },
  { value: "5:4", label: "5:4", description: "Nearly Square" },
];

const IMAGE_SIZES: { value: ImageSize; label: string; description: string }[] = [
  { value: "1K", label: "1K", description: "Fast generation, lower quality" },
  { value: "2K", label: "2K", description: "Balanced (Recommended)" },
  { value: "4K", label: "4K", description: "High quality, slower" },
];

export function ImageConfigDialog() {
  const { imageModel, setImageModel } = usePresentationState();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 shrink-0">
          <Image className="h-4 w-4" />
          图片设置
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>图片生成设置</DialogTitle>
          <DialogDescription>
            配置AI生成幻灯片图片的宽高比和分辨率
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Aspect Ratio */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">宽高比 (Aspect Ratio)</Label>
            <Select
              value={imageModel.aspectRatio}
              onValueChange={(value) =>
                setImageModel({
                  ...imageModel,
                  aspectRatio: value as AspectRatio,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{ratio.label}</span>
                      <span className="text-xs text-muted-foreground ml-3">
                        {ratio.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              当前选择: <span className="font-medium">{imageModel.aspectRatio}</span>
              {" - "}
              {ASPECT_RATIOS.find((r) => r.value === imageModel.aspectRatio)?.description}
            </p>
          </div>

          {/* Image Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">分辨率 (Resolution)</Label>
            <Select
              value={imageModel.imageSize}
              onValueChange={(value) =>
                setImageModel({
                  ...imageModel,
                  imageSize: value as ImageSize,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{size.label}</span>
                      <span className="text-xs text-muted-foreground ml-3">
                        {size.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              当前选择: <span className="font-medium">{imageModel.imageSize}</span>
              {" - "}
              {IMAGE_SIZES.find((s) => s.value === imageModel.imageSize)?.description}
            </p>
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">提示：</span>
              这些设置将应用于所有AI生成的幻灯片图片。2K分辨率和16:9宽高比适合大多数演示场景。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
