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
import { Settings2, Image, Languages, Sparkles, Palette } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  type GenerateConfig,
  type AspectRatio,
  type ImageSize,
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

// Preset style templates from old version
const STYLE_PRESETS: { id: string; name: string; icon: string; description: string; colors: string[]; prompt: string }[] = [
  {
    id: "hand-drawn",
    name: "Hand-Drawn Sketchbook",
    icon: "✏️",
    description: "Warm, hand-drawn illustration style",
    colors: ["#3E3C38", "#FF7F7F", "#8FA87A"],
    prompt: `Design Aesthetic: Warm hand-drawn illustration style, simulating an artist's sketchbook. Overall atmosphere is relaxed, friendly, and creative. Lines should have natural hand-drawn waves and imperfections, avoiding rigid geometric lines.

Background Color: Soft off-white with subtle watercolor paper texture, hex code #F9F7F2

Primary Font: Similar to handwritten round style. Titles should appear casual but clear, like marker writing

Color Palette:
- Primary Text Color: Warm charcoal gray #3E3C38 (simulating pencil or ink)
- Primary Accent Color: Soft coral red #FF7F7F and sage green #8FA87A for highlights

Visual Elements: All charts, arrows, and borders should look hand-drawn with pencil or marker. Use simple stick figures, lightbulbs, stars, and wavy connectors. Shadows should use rough hatching rather than gradients.`,
  },
  {
    id: "blueprint",
    name: "Modern Blueprint",
    icon: "📐",
    description: "Technical architectural style with precise lines",
    colors: ["#0F172A", "#3B82F6", "#06B6D4"],
    prompt: `Design Aesthetic: Technical blueprint-style presentations with architectural precision.

**STYLE:**
- Clean, precise lines and geometric shapes
- Technical diagrams with architectural precision
- Grid-based layouts with exact measurements
- Professional sans-serif fonts (similar to DIN or Helvetica)
- Monochromatic blue color scheme with cyan accents
- All elements aligned to strict grid system
- Technical annotations and dimension lines where appropriate

Color Palette:
- Primary: Dark slate #0F172A
- Secondary: Blueprint blue #3B82F6
- Accent: Cyan #06B6D4
- Background: Light slate #F8FAFC`,
  },
  {
    id: "minimal",
    name: "Minimal Modern",
    icon: "▫️",
    description: "Clean design with bold typography",
    colors: ["#1A1A1A", "#666666", "#FFFFFF"],
    prompt: `Design Aesthetic: Minimalist design focused on clarity through simplicity.

**STYLE:**
- Maximum white space for breathing room
- Bold, oversized typography
- Monochromatic color scheme
- Simple geometric shapes only
- No decorative elements
- High contrast for impact
- Modern sans-serif fonts (similar to Helvetica Neue or Inter)
- Single focal point per slide

Color Palette:
- Primary: Almost black #1A1A1A
- Secondary: Medium gray #666666
- Background: Pure white #FFFFFF`,
  },
  {
    id: "corporate",
    name: "Corporate Professional",
    icon: "💼",
    description: "Traditional business presentation style",
    colors: ["#1E3A8A", "#64748B", "#3B82F6"],
    prompt: `Design Aesthetic: Corporate presentation designer creating formal business presentations.

**STYLE:**
- Professional and conservative design
- Traditional layouts with clear hierarchy
- Corporate color scheme (navy, gray, blue)
- Formal serif or sans-serif fonts
- Charts and graphs with business styling
- Bullet points and numbered lists
- Company-presentation aesthetic

Color Palette:
- Primary: Navy blue #1E3A8A
- Secondary: Slate gray #64748B
- Accent: Business blue #3B82F6
- Background: Light gray #F1F5F9`,
  },
  {
    id: "creative",
    name: "Vibrant Creative",
    icon: "🎨",
    description: "Colorful, energetic, dynamic layouts",
    colors: ["#EC4899", "#8B5CF6", "#F59E0B"],
    prompt: `Design Aesthetic: Bold, colorful, energetic presentations.

**STYLE:**
- Vibrant, saturated colors
- Asymmetric, dynamic layouts
- Playful typography with varied sizes
- Gradient backgrounds
- Organic shapes and flowing lines
- Mixed media aesthetic
- Fun icons and illustrations
- Energetic composition

Color Palette:
- Primary: Hot pink #EC4899
- Secondary: Purple #8B5CF6
- Accent: Amber #F59E0B
- Background: Light yellow #FEFCE8`,
  },
  {
    id: "tech-dark",
    name: "Tech Dark Mode",
    icon: "🌙",
    description: "Modern dark theme with neon accents",
    colors: ["#18181B", "#0EA5E9", "#22D3EE"],
    prompt: `Design Aesthetic: Modern dark theme suitable for tech and startup presentations.

**STYLE:**
- Dark backgrounds with high contrast elements
- Neon/cyan accent colors for highlights
- Sleek, futuristic typography
- Glowing effects and subtle gradients
- Clean geometric shapes
- Code-like or monospace elements where appropriate
- Minimal but impactful visual elements

Color Palette:
- Background: Near black #18181B
- Primary accent: Cyan #0EA5E9
- Secondary accent: Light cyan #22D3EE
- Text: White/light gray for contrast`,
  },
  {
    id: "custom",
    name: "Custom Style",
    icon: "✨",
    description: "Write your own style description",
    colors: ["#6366F1", "#8B5CF6", "#A78BFA"],
    prompt: "",
  },
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Style
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

          {/* Style Settings */}
          <TabsContent value="style" className="space-y-6 mt-4">
            {/* Style Presets */}
            <div className="space-y-2">
              <Label>Select a Style Template</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {STYLE_PRESETS.map((preset) => {
                  const isSelected = preset.id === "custom"
                    ? !STYLE_PRESETS.slice(0, -1).some(p => localConfig.customStylePrompt === p.prompt)
                    : localConfig.customStylePrompt === preset.prompt;
                  return (
                    <button
                      key={preset.id}
                      onClick={() =>
                        setLocalConfig({ ...localConfig, customStylePrompt: preset.prompt })
                      }
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{preset.icon}</span>
                        <p className="font-medium text-sm">{preset.name}</p>
                      </div>
                      <div className="flex gap-1 mb-1">
                        {preset.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Style Prompt Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Style Prompt</Label>
                {localConfig.customStylePrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setLocalConfig({ ...localConfig, customStylePrompt: "" })}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <Textarea
                value={localConfig.customStylePrompt || ""}
                onChange={(e) =>
                  setLocalConfig({ ...localConfig, customStylePrompt: e.target.value })
                }
                placeholder="Select a preset above or write your own style description...

Example: 'Use a futuristic cyberpunk theme with neon colors, dark backgrounds, and holographic effects. Typography should be bold and angular.'"
                className="min-h-[150px] font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                The AI will follow this style description for all generated slides. You can select a preset and customize it.
              </p>
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
