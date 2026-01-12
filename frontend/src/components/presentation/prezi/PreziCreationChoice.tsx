"use client";

/**
 * Prezi Creation Choice Component
 *
 * Offers two options for creating a new Prezi:
 * 1. Create blank Prezi
 * 2. Generate with AI
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, PenTool, ArrowRight } from "lucide-react";
import { CreatePreziDialog } from "./CreatePreziDialog";
import { createPresentation } from "@/app/_actions/presentation/presentationActions";
import { createInitialCanvasData } from "@/states/prezi-editor-state";
import { useToast } from "@/components/ui/use-toast";

export function PreziCreationChoice() {
  const router = useRouter();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Handle blank Prezi creation
  const handleCreateBlank = async (data: { title: string; description?: string }) => {
    setIsCreating(true);
    try {
      const result = await createPresentation({
        title: data.title,
        mode: "PREZI",
        content: createInitialCanvasData() as any,
        theme: "mystique",
        language: "en-US",
      });

      if (result.success && result.presentation) {
        toast({
          title: "Success",
          description: "Blank Prezi created successfully!",
        });
        router.push(`/presentation/prezi-edit/${result.presentation.id}`);
      } else {
        throw new Error("Failed to create presentation");
      }
    } catch (error) {
      console.error("Create error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create Prezi. Please try again.",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-12 text-center space-y-4">
          <h1 className="text-4xl font-bold">Create New Prezi</h1>
          <p className="text-muted-foreground text-lg">
            Choose how you want to start your presentation
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Option 1: Blank Prezi */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all hover:shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4">
                <PenTool className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Start from Blank</CardTitle>
              <CardDescription className="text-base">
                Create an empty canvas and build your presentation manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Full creative control from scratch</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Drag & drop elements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>3D positioning and zoom paths</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Perfect for custom layouts</span>
                </li>
              </ul>

              <Button
                size="lg"
                className="w-full"
                onClick={() => setShowCreateDialog(true)}
              >
                Create Blank Prezi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: AI Generated */}
          <Card className="relative overflow-hidden border-2 border-primary/30 hover:border-primary/60 transition-all hover:shadow-xl shadow-primary/20">
            {/* "Recommended" Badge */}
            <div className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
              RECOMMENDED
            </div>

            <CardHeader>
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Generate with AI</CardTitle>
              <CardDescription className="text-base">
                Let AI create a complete presentation from your topic and outline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Instant professional layouts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Auto-generated content & images</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Optimized camera paths</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Element animations included</span>
                </li>
              </ul>

              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={() => router.push("/presentation/prezi-create-ai")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back to Home
          </Button>
        </div>
      </div>

      {/* Create Blank Dialog */}
      <CreatePreziDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onConfirm={handleCreateBlank}
      />
    </>
  );
}
