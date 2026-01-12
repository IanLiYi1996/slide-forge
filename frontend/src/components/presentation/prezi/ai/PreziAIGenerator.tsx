"use client";

/**
 * Prezi AI Generator Component
 *
 * Allows users to generate complete Prezi presentations from a topic and outline.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { createPresentation, updatePresentation } from "@/app/_actions/presentation/presentationActions";
import type { PreziCanvasData } from "@/types/prezi-types";

interface GeneratedData {
  elements: any[];
  keyframes: any[];
}

export const PreziAIGenerator: React.FC = () => {
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState("");
  const [numberOfSlides, setNumberOfSlides] = useState(10);
  const [style, setStyle] = useState("professional");
  const [language, setLanguage] = useState("en-US");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const router = useRouter();
  const { toast } = useToast();

  // ✨ Generate outline from topic
  const handleGenerateOutline = async () => {
    if (!topic.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Topic",
        description: "Please enter a presentation topic first.",
      });
      return;
    }

    setIsGeneratingOutline(true);

    try {
      const response = await fetch("/api/prezi/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          numberOfSlides,
          style,
          language,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate outline");
      }

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let generatedOutline = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: false });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line && line.startsWith("0:")) {
            // Extract text from data stream
            const textMatch = line.match(/0:"(.+)"/);
            if (textMatch && textMatch[1]) {
              generatedOutline += textMatch[1].replace(/\\n/g, "\n");
            }
          }
        }
      }

      // Clean up the outline
      const cleanedOutline = generatedOutline
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.match(/^\d+\./)) // Remove numbering if present
        .join("\n");

      setOutline(cleanedOutline);

      toast({
        title: "Outline Generated",
        description: "AI has generated an outline for your presentation.",
      });
    } catch (error) {
      console.error("Outline generation error:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate outline. Please try again or enter manually.",
      });
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() || !outline.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both a topic and an outline.",
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStatusMessage("Creating presentation...");

    try {
      // Step 1: Create empty Prezi presentation
      setProgress(10);
      const createResult = await createPresentation({
        title: topic,
        mode: "PREZI",
        content: createInitialCanvasData() as any,
        theme: "mystique",
        language: language,
      });

      if (!createResult.success || !createResult.presentation) {
        throw new Error("Failed to create presentation");
      }

      const presentationId = createResult.presentation.id;
      setProgress(20);
      setStatusMessage("Generating content with AI...");

      // Step 2: Call AI generation API
      const response = await fetch("/api/prezi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          outline: outline.split("\n").filter((line) => line.trim()),
          language,
          numberOfSlides,
          style,
          enableWebSearch: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      setProgress(40);
      setStatusMessage("Processing AI response...");

      // Step 3: Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let progressIncrement = 40;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Increment progress gradually
        progressIncrement = Math.min(progressIncrement + 5, 85);
        setProgress(progressIncrement);
      }

      setProgress(90);
      setStatusMessage("Transforming to Prezi format...");

      // Step 4: Parse JSON result
      let generatedData: GeneratedData;
      try {
        // Extract JSON from streamed data
        const lines = buffer.split("\n");
        let jsonContent = "";

        for (const line of lines) {
          if (line.startsWith("0:")) {
            // Extract the JSON string from the data stream
            const jsonMatch = line.match(/0:"(.+)"/);
            if (jsonMatch && jsonMatch[1]) {
              jsonContent += jsonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "");
            }
          }
        }

        if (!jsonContent) {
          // Try parsing the entire buffer as JSON
          jsonContent = buffer;
        }

        // ✨ Remove markdown code block wrapper if present
        // AI might return: ```json\n{...}\n```
        const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonContent = codeBlockMatch[1];
        }

        // Clean up any remaining escape sequences
        jsonContent = jsonContent.trim();

        generatedData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        console.log("Buffer content:", buffer.substring(0, 500));
        throw new Error("Failed to parse AI-generated content. Please try again.");
      }

      setProgress(95);
      setStatusMessage("Saving presentation...");

      // Step 5: Transform to PreziCanvasData format
      const canvasData = transformToPreziCanvasData(generatedData);

      // Step 6: Save the generated presentation
      const updateResult = await updatePresentation({
        id: presentationId,
        content: canvasData as any,
      });

      if (!updateResult.success) {
        throw new Error("Failed to save presentation");
      }

      setProgress(100);
      setStatusMessage("Complete!");

      toast({
        title: "Success!",
        description: "Your Prezi presentation has been generated successfully.",
      });

      // Redirect to editor after a short delay
      setTimeout(() => {
        router.push(`/presentation/prezi-edit/${presentationId}`);
      }, 500);
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
      });
      setIsGenerating(false);
      setProgress(0);
      setStatusMessage("");
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Create Prezi with AI
        </CardTitle>
        <CardDescription>
          Generate a complete presentation from your topic and outline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Banner */}
        {!isGenerating && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 text-sm border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  How it works:
                </p>
                <ol className="text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Enter your presentation topic</li>
                  <li>Click "Generate Outline" to get AI suggestions (or type manually)</li>
                  <li>Adjust settings and generate your complete Prezi</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Topic Input */}
        <div className="space-y-2">
          <Label htmlFor="topic">Presentation Topic *</Label>
          <Textarea
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., The Benefits of Cloud Computing"
            className="min-h-[60px]"
            disabled={isGenerating}
          />
        </div>

        {/* Outline Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="outline">
              Outline * <span className="text-sm text-muted-foreground">(one point per line)</span>
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateOutline}
              disabled={isGeneratingOutline || isGenerating || !topic.trim()}
              className="h-7"
            >
              {isGeneratingOutline ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-3 w-3" />
                  Generate Outline
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="outline"
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="Click 'Generate Outline' or type manually&#10;Introduction&#10;Cost Savings&#10;Scalability&#10;Security Features&#10;Use Cases&#10;Conclusion"
            className="min-h-[150px] font-mono text-sm"
            disabled={isGenerating || isGeneratingOutline}
          />
        </div>

        {/* Number of Slides */}
        <div className="space-y-2">
          <Label htmlFor="slides">
            Number of Slides: <span className="font-semibold">{numberOfSlides}</span>
          </Label>
          <Slider
            id="slides"
            value={[numberOfSlides]}
            onValueChange={([value]) => setNumberOfSlides(value!)}
            min={5}
            max={20}
            step={1}
            disabled={isGenerating}
            className="mt-2"
          />
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <Label htmlFor="style">Presentation Style</Label>
          <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
            <SelectTrigger id="style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="creative">Creative</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language Selection */}
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select value={language} onValueChange={setLanguage} disabled={isGenerating}>
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">English</SelectItem>
              <SelectItem value="zh-CN">中文</SelectItem>
              <SelectItem value="es-ES">Español</SelectItem>
              <SelectItem value="fr-FR">Français</SelectItem>
              <SelectItem value="de-DE">Deutsch</SelectItem>
              <SelectItem value="ja-JP">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{statusMessage}</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || isGeneratingOutline || !topic.trim() || !outline.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Prezi...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Complete Prezi
            </>
          )}
        </Button>

        {/* Helper Text */}
        {!isGenerating && !isGeneratingOutline && (
          <div className="space-y-2">
            {!outline.trim() && topic.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                💡 Tip: Click "Generate Outline" to get AI suggestions based on your topic
              </p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Powered by AI. Complete generation takes 30-60 seconds.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Helper: Create initial empty canvas data
 */
function createInitialCanvasData(): PreziCanvasData {
  return {
    version: "1.0",
    canvas: {
      backgroundColor: "#ffffff",
      gridEnabled: true,
      gridSize: 50,
    },
    elements: {},
    paths: [],
    activePath: "",
    camera: {
      defaultPosition: { x: 0, y: 0, z: 1000 },
      defaultZoom: 1,
    },
  };
}

/**
 * Helper: Transform AI-generated data to PreziCanvasData format
 */
function transformToPreziCanvasData(generatedData: GeneratedData): PreziCanvasData {
  const elements: Record<string, any> = {};

  // Convert elements array to dictionary
  for (const element of generatedData.elements) {
    elements[element.id] = element;
  }

  // Create the main path from keyframes
  const mainPath = {
    id: "ai-generated-path",
    name: "Main Path",
    keyframes: generatedData.keyframes,
    loop: false,
  };

  return {
    version: "1.0",
    canvas: {
      backgroundColor: "#ffffff",
      gridEnabled: true,
      gridSize: 50,
    },
    elements,
    paths: [mainPath],
    activePath: "ai-generated-path",
    camera: {
      defaultPosition: { x: 0, y: 0, z: 1000 },
      defaultZoom: 1,
    },
  };
}
