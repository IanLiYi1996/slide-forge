import {
  generateImageAction,
  type AspectRatio,
  type ImageSize,
} from "@/app/_actions/image/generate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlugin } from "@platejs/media/react";
import { useEditorRef } from "platejs/react";
import { useState } from "react";
import { toast } from "sonner";

// 宽高比选项
const ASPECT_RATIO_OPTIONS: Array<{ label: string; value: AspectRatio }> = [
  { label: "Square (1:1)", value: "1:1" },
  { label: "Portrait (9:16)", value: "9:16" },
  { label: "Landscape (16:9)", value: "16:9" },
  { label: "Portrait (2:3)", value: "2:3" },
  { label: "Landscape (3:2)", value: "3:2" },
  { label: "Portrait (3:4)", value: "3:4" },
  { label: "Landscape (4:3)", value: "4:3" },
  { label: "Portrait (4:5)", value: "4:5" },
  { label: "Landscape (5:4)", value: "5:4" },
  { label: "Ultrawide (21:9)", value: "21:9" },
];

// 分辨率选项
const IMAGE_SIZE_OPTIONS: Array<{ label: string; value: ImageSize }> = [
  { label: "Standard (1K)", value: "1K" },
  { label: "High (2K)", value: "2K" },
  { label: "Ultra (4K)", value: "4K" },
];

export function GenerateImageDialogContent({
  setOpen,
  isGenerating,
  setIsGenerating,
}: {
  setOpen: (value: boolean) => void;
  isGenerating: boolean;
  setIsGenerating: (value: boolean) => void;
}) {
  const editor = useEditorRef();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateImageAction(prompt, {
        aspectRatio,
        imageSize,
      });

      if (!result.success || !result.image?.url) {
        throw new Error(result.error ?? "Failed to generate image");
      }

      editor.tf.insertNodes({
        children: [{ text: "" }],
        type: ImagePlugin.key,
        url: result.image.url,
        query: prompt,
      });

      setOpen(false);
      toast.success("Image generated successfully!");

      // 可选：显示模型生成的文本描述
      if (result.generatedText) {
        console.log("Model description:", result.generatedText);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate image",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Generate Image with AI</AlertDialogTitle>
        <AlertDialogDescription>
          Powered by Gemini 3 Pro Image via yunwu API. Enter a detailed
          description of the image you want to generate.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-4">
        {/* Prompt 输入 */}
        <div className="relative w-full">
          <Label htmlFor="prompt">Prompt</Label>
          <Input
            id="prompt"
            className="w-full"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isGenerating) void generateImage();
            }}
            type="text"
            placeholder="A vibrant sunset over mountains..."
            autoFocus
            disabled={isGenerating}
          />
        </div>

        {/* 宽高比选择 */}
        <div className="relative w-full">
          <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
          <Select
            value={aspectRatio}
            onValueChange={(value) => setAspectRatio(value as AspectRatio)}
            disabled={isGenerating}
          >
            <SelectTrigger id="aspect-ratio" className="w-full">
              <SelectValue placeholder="Select aspect ratio" />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 分辨率选择 */}
        <div className="relative w-full">
          <Label htmlFor="image-size">Resolution</Label>
          <Select
            value={imageSize}
            onValueChange={(value) => setImageSize(value as ImageSize)}
            disabled={isGenerating}
          >
            <SelectTrigger id="image-size" className="w-full">
              <SelectValue placeholder="Select resolution" />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 生成中的加载动画 */}
        {isGenerating && (
          <div className="mt-4 space-y-3">
            <div className="h-64 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="text-center text-sm text-gray-500">
              Generating your image with Gemini 3 Pro...
            </div>
          </div>
        )}
      </div>

      <AlertDialogFooter>
        <div className="flex w-full gap-2">
          <AlertDialogCancel disabled={isGenerating} className="flex-1">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void generateImage();
            }}
            disabled={isGenerating}
            className="flex-1"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </AlertDialogAction>
        </div>
      </AlertDialogFooter>
    </>
  );
}

export default function ImageGenerationModel() {
  const [isGenerating, setIsGenerating] = useState(false);
  return (
    <AlertDialog
      open={isGenerating}
      onOpenChange={(value) => {
        setIsGenerating(value);
        setIsGenerating(false);
      }}
    >
      <AlertDialogContent className="gap-6">
        <GenerateImageDialogContent
          setOpen={setIsGenerating}
          isGenerating={isGenerating}
          setIsGenerating={setIsGenerating}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
