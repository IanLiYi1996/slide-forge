"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRESENTATION_TEMPLATES,
  type PresentationTemplate,
} from "@/lib/presentation/templates";
import { usePresentationState } from "@/states/presentation-state";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";

export function TemplateSelector() {
  const {
    showTemplates,
    setShowTemplates,
    selectedTemplate,
    setSelectedTemplate,
    customThemePrompt,
    setCustomThemePrompt,
  } = usePresentationState();

  const [localCustomPrompt, setLocalCustomPrompt] = useState(customThemePrompt);

  // Group templates by category
  const categories = {
    professional: [] as PresentationTemplate[],
    creative: [] as PresentationTemplate[],
    technical: [] as PresentationTemplate[],
    minimal: [] as PresentationTemplate[],
  };

  Object.values(PRESENTATION_TEMPLATES).forEach((template) => {
    categories[template.category].push(template);
  });

  const categoryLabels = {
    professional: "Professional",
    creative: "Creative",
    technical: "Technical",
    minimal: "Minimal",
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId !== "custom") {
      setCustomThemePrompt(""); // Clear custom prompt when selecting preset
    }
    setShowTemplates(false);
  };

  const handleCustomThemeSelect = () => {
    setSelectedTemplate("custom");
    setCustomThemePrompt(localCustomPrompt);
    setShowTemplates(false);
  };

  return (
    <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">选择演示主题风格</DialogTitle>
          <DialogDescription>
            选择预设风格模板，或输入自定义主题描述让 AI 为你定制独特风格
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Custom Theme Input */}
          <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">自定义主题风格</h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="custom-theme" className="text-sm font-medium">
                  主题风格描述
                </Label>
                <Textarea
                  id="custom-theme"
                  value={localCustomPrompt}
                  onChange={(e) => setLocalCustomPrompt(e.target.value)}
                  placeholder="例如：温暖的水彩画风格，柔和的配色，手绘插图元素..."
                  className="mt-2 min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  描述你想要的视觉风格、配色、字体、插图风格等，AI 会根据你的描述生成独特的幻灯片
                </p>
              </div>
              <button
                onClick={handleCustomThemeSelect}
                disabled={!localCustomPrompt.trim()}
                className={`
                  w-full p-3 rounded-lg transition-all font-medium
                  ${
                    localCustomPrompt.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }
                `}
              >
                使用自定义主题
              </button>
            </div>
          </div>
          {Object.entries(categories).map(([category, templates]) => {
            if (templates.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  预设模板 - {categoryLabels[category as keyof typeof categoryLabels]}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map((template) => {
                    const isSelected = selectedTemplate === template.id;

                    return (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className={`
                          group relative flex flex-col p-4 rounded-lg border-2 transition-all text-left
                          ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border hover:border-primary/50 hover:bg-accent/50"
                          }
                        `}
                      >
                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}

                        {/* Template header */}
                        <div className="flex items-start gap-3 mb-2">
                          <div
                            className="text-3xl p-2 rounded-lg"
                            style={{
                              backgroundColor: template.colors.background,
                              color: template.colors.primary,
                            }}
                          >
                            {template.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-base text-foreground mb-1">
                              {template.name}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                          </div>
                        </div>

                        {/* Color palette preview */}
                        <div className="flex gap-1.5 mt-2">
                          {Object.entries(template.colors).map(([key, color]) => (
                            <div
                              key={key}
                              className="h-6 flex-1 rounded border border-gray-200 dark:border-gray-700"
                              style={{ backgroundColor: color }}
                              title={`${key}: ${color}`}
                            />
                          ))}
                        </div>

                        {/* Hover effect */}
                        <div
                          className={`
                            absolute inset-0 rounded-lg pointer-events-none
                            ${isSelected ? "ring-2 ring-primary" : ""}
                          `}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current selection info */}
        {selectedTemplate && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            {selectedTemplate === "custom" && customThemePrompt ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">
                    当前：自定义主题
                  </span>
                </div>
                <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                  {customThemePrompt}
                </p>
              </div>
            ) : PRESENTATION_TEMPLATES[selectedTemplate] ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">
                    {PRESENTATION_TEMPLATES[selectedTemplate]!.icon}
                  </span>
                  <span className="font-semibold text-sm">
                    当前：{PRESENTATION_TEMPLATES[selectedTemplate]!.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  演示文稿将使用此模板的风格和视觉指南生成
                </p>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
