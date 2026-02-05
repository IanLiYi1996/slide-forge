"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, Image, Languages, Sparkles } from "lucide-react";
import {
  type GenerateConfig,
  type AspectRatio,
  type ImageSize,
  type PresentationStyle,
  type PresentationTheme,
  type ImageGenerationProvider,
} from "@/types/smart-hub";
import { DEFAULT_GENERATE_CONFIG } from "@/types/smart-hub";

interface GenerateConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GenerateConfig;
  onConfigChange: (config: GenerateConfig) => void;
}

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; description: string }[] = [
  { value: "16:9", label: "16:9", description: "Widescreen (Recommended)" },
  { value: "4:3", label: "4:3", description: "Standard" },
  { value: "1:1", label: "1:1", description: "Square" },
  { value: "9:16", label: "9:16", description: "Portrait/Mobile" },
  { value: "21:9", label: "21:9", description: "Ultra-wide" },
  { value: "3:2", label: "3:2", description: "Classic photo" },
  { value: "2:3", label: "2:3", description: "Portrait photo" },
  { value: "4:5", label: "4:5", description: "Instagram portrait" },
  { value: "5:4", label: "5:4", description: "Large format" },
  { value: "3:4", label: "3:4", description: "Traditional portrait" },
];

const IMAGE_SIZE_OPTIONS: { value: ImageSize; label: string; description: string }[] = [
  { value: "1K", label: "1K", description: "Fast generation, lower quality" },
  { value: "2K", label: "2K", description: "Balanced (Recommended)" },
  { value: "4K", label: "4K", description: "High quality, slower" },
];

const STYLE_OPTIONS: { value: PresentationStyle; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Clean, corporate look" },
  { value: "creative", label: "Creative", description: "Bold colors and layouts" },
  { value: "minimal", label: "Minimal", description: "Simple, focused design" },
  { value: "bold", label: "Bold", description: "Eye-catching and impactful" },
];

const THEME_OPTIONS: { value: PresentationTheme; label: string; description: string; colors: string[] }[] = [
  { value: "default", label: "Default", description: "Classic blue theme", colors: ["#3B82F6", "#1E40AF", "#DBEAFE"] },
  { value: "corporate", label: "Corporate", description: "Formal navy & gray", colors: ["#1E3A5F", "#64748B", "#F1F5F9"] },
  { value: "tech", label: "Tech", description: "Modern dark theme", colors: ["#0EA5E9", "#18181B", "#27272A"] },
  { value: "nature", label: "Nature", description: "Earthy green tones", colors: ["#22C55E", "#166534", "#F0FDF4"] },
  { value: "elegant", label: "Elegant", description: "Sophisticated purple", colors: ["#8B5CF6", "#4C1D95", "#F5F3FF"] },
  { value: "vibrant", label: "Vibrant", description: "Bold & colorful", colors: ["#F97316", "#EC4899", "#FEF3C7"] },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "creative", label: "Creative" },
  { value: "academic", label: "Academic" },
];

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
];

const PROVIDER_OPTIONS: { value: ImageGenerationProvider; label: string; description: string }[] = [
  { value: "yunwu", label: "Yunwu", description: "Default image generation" },
  { value: "z-image-turbo", label: "Z-Image Turbo", description: "Fast generation with prompt enhancement" },
];

export function GenerateConfigDialog({
  open,
  onOpenChange,
  config,
  onConfigChange,
}: GenerateConfigDialogProps) {
  const [localConfig, setLocalConfig] = useState<GenerateConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleSave = () => {
    onConfigChange(localConfig);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_GENERATE_CONFIG);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Generation Settings
          </DialogTitle>
          <DialogDescription>
            Configure how your presentation will be generated
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="language" className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Language
            </TabsTrigger>
          </TabsList>

          {/* Content Settings */}
          <TabsContent value="content" className="space-y-6 mt-4">
            {/* Number of Slides */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Number of Slides</Label>
                <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
                  {localConfig.numberOfSlides}
                </span>
              </div>
              <Slider
                value={[localConfig.numberOfSlides]}
                onValueChange={([value]) =>
                  setLocalConfig({ ...localConfig, numberOfSlides: value ?? localConfig.numberOfSlides })
                }
                min={3}
                max={30}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 5-15 slides for most presentations
              </p>
            </div>

            {/* Presentation Style */}
            <div className="space-y-2">
              <Label>Presentation Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setLocalConfig({ ...localConfig, style: option.value })
                    }
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      localConfig.style === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <Label>Color Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setLocalConfig({ ...localConfig, theme: option.value })
                    }
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      localConfig.theme === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      {option.colors.map((color, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label>Content Tone</Label>
              <Select
                value={localConfig.tone}
                onValueChange={(value) =>
                  setLocalConfig({
                    ...localConfig,
                    tone: value as GenerateConfig["tone"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Web Search */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Web Search</Label>
                <p className="text-xs text-muted-foreground">
                  Allow AI to search the web for additional context
                </p>
              </div>
              <Switch
                checked={localConfig.enableWebSearch}
                onCheckedChange={(checked) =>
                  setLocalConfig({ ...localConfig, enableWebSearch: checked })
                }
              />
            </div>
          </TabsContent>

          {/* Image Settings */}
          <TabsContent value="image" className="space-y-6 mt-4">
            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIO_OPTIONS.slice(0, 6).map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setLocalConfig({ ...localConfig, aspectRatio: option.value })
                    }
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      localConfig.aspectRatio === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
              <Select
                value={localConfig.aspectRatio}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, aspectRatio: value as AspectRatio })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="More aspect ratios..." />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Size/Resolution */}
            <div className="space-y-2">
              <Label>Image Resolution</Label>
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setLocalConfig({ ...localConfig, imageSize: option.value })
                    }
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      localConfig.imageSize === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <p className="font-bold text-lg">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Provider */}
            <div className="space-y-2">
              <Label>Image Generation Model</Label>
              <Select
                value={localConfig.imageProvider || "yunwu"}
                onValueChange={(value) =>
                  setLocalConfig({
                    ...localConfig,
                    imageProvider: value as ImageGenerationProvider,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prompt Extend (for z-image-turbo) */}
            {localConfig.imageProvider === "z-image-turbo" && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Smart Prompt Enhancement</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically enhance prompts for better results
                  </p>
                </div>
                <Switch
                  checked={localConfig.promptExtend ?? true}
                  onCheckedChange={(checked) =>
                    setLocalConfig({ ...localConfig, promptExtend: checked })
                  }
                />
              </div>
            )}
          </TabsContent>

          {/* Language Settings */}
          <TabsContent value="language" className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>Output Language</Label>
              <Select
                value={localConfig.language}
                onValueChange={(value) =>
                  setLocalConfig({ ...localConfig, language: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The AI will generate content in the selected language
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
