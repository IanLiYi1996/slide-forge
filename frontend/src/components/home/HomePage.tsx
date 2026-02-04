"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";
import { Button } from "@/components/ui/button";
import { FileText, Zap, Image, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="relative flex w-full min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* WebGL Background */}
      <div className="absolute inset-0 w-full h-full">
        <WebGLShader />
      </div>

      <div className="relative w-full mx-auto max-w-[1200px] z-10 my-8 px-4">
        <main className="relative py-16 overflow-hidden">
          {/* Hero Section */}
          <div className="text-center space-y-6 mb-12">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-2xl">
                <FileText className="h-10 w-10 text-white" />
              </div>
            </div>

            <h1 className={cn(
              "mb-3 text-center text-7xl font-extrabold tracking-tighter md:text-[clamp(2rem,8vw,7rem)]",
              isDark ? "text-white" : "text-foreground"
            )}>
              SlideForge
            </h1>

            <p className={cn(
              "px-6 text-center text-sm md:text-base lg:text-xl max-w-3xl mx-auto",
              isDark ? "text-white/80" : "text-foreground/80"
            )}>
              Unleashing creativity through AI-powered document creation and processing.
            </p>

            <div className="my-8 flex items-center justify-center gap-1">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <p className="text-xs text-green-500">Ready to Create</p>
            </div>
          </div>

          {/* Smart Document Hub - Main CTA */}
          <div className="flex justify-center mb-12 px-6">
            <div className={cn(
              "group relative p-8 rounded-2xl border backdrop-blur-sm transition-all duration-300 w-full max-w-2xl",
              isDark ? "bg-gradient-to-r from-emerald-950/50 to-teal-950/50 border-emerald-500/30" : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-500/30",
              "hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10"
            )}>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg group-hover:scale-110 transition-transform">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className={cn("text-3xl font-bold", isDark ? "text-white" : "text-foreground")}>
                    Smart Document Hub
                  </h2>
                  <p className={cn("text-sm", isDark ? "text-white/60" : "text-foreground/70")}>
                    All-in-one document creation and processing
                  </p>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className={cn(
                  "p-4 rounded-xl",
                  isDark ? "bg-white/5" : "bg-white/50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-orange-500" />
                    <span className={cn("font-semibold", isDark ? "text-white" : "text-foreground")}>Generate</span>
                  </div>
                  <p className={cn("text-xs", isDark ? "text-white/60" : "text-foreground/60")}>
                    Create presentations from text with AI-powered slide generation
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-xl",
                  isDark ? "bg-white/5" : "bg-white/50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Image className="h-5 w-5 text-blue-500" />
                    <span className={cn("font-semibold", isDark ? "text-white" : "text-foreground")}>Process</span>
                  </div>
                  <p className={cn("text-xs", isDark ? "text-white/60" : "text-foreground/60")}>
                    Process documents and images with AI instructions
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-xl",
                  isDark ? "bg-white/5" : "bg-white/50"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <span className={cn("font-semibold", isDark ? "text-white" : "text-foreground")}>Extract</span>
                  </div>
                  <p className={cn("text-xs", isDark ? "text-white/60" : "text-foreground/60")}>
                    Extract content from documents and convert to slides
                  </p>
                </div>
              </div>

              <Button
                className="w-full h-14 text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium"
                onClick={() => router.push("/create")}
              >
                Get Started
                <Zap className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Chat to Slides - AI Agent */}
          <div className="flex justify-center px-6">
            <div className={cn(
              "group relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 w-full max-w-2xl",
              isDark ? "bg-gradient-to-r from-purple-950/50 to-pink-950/50 border-purple-500/30" : "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-500/30",
              "hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
            )}>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg group-hover:scale-110 transition-transform">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-foreground")}>Chat to Slides</h3>
                    <span className="text-[10px] font-bold text-purple-400 px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10">
                      AI POWERED
                    </span>
                  </div>
                  <p className={cn("text-sm", isDark ? "text-white/60" : "text-foreground/70")}>
                    Conversational AI agent powered by Claude
                  </p>
                </div>
              </div>

              <p className={cn("text-sm mb-4", isDark ? "text-white/70" : "text-foreground/70")}>
                Create stunning presentations through natural conversation. Interactive AI dialogue with real-time preview and web search integration.
              </p>

              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 border-purple-500/30 hover:bg-purple-500/10",
                  isDark ? "text-white" : "text-foreground"
                )}
                onClick={() => router.push("/presentation/agent")}
              >
                Start Conversation
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
