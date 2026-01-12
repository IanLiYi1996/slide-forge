"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight, Image, Presentation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function HomePage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="relative flex w-full min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* WebGL Background - positioned relative to main content area */}
      <div className="absolute inset-0 w-full h-full">
        <WebGLShader />
      </div>

      <div className="relative w-full mx-auto max-w-[1600px] z-10 my-8 px-4">
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
              Unleashing creativity through AI-powered presentation creation. Choose your path to stunning slides.
            </p>

            <div className="my-8 flex items-center justify-center gap-1">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <p className="text-xs text-green-500">Ready to Create Amazing Presentations</p>
            </div>
          </div>

          {/* Feature Options */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 mb-12 auto-rows-fr">
            {/* Image to Slides Option */}
            <div className={cn(
              "group relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 flex flex-col h-full",
              isDark ? "bg-black/40 hover:bg-black/50 border-white/10" : "bg-white/40 hover:bg-white/50 border-black/10",
              "hover:border-orange-500/50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 group-hover:scale-110 transition-transform">
                  <FileText className="h-6 w-6 text-orange-400" />
                </div>
                <span className="text-[10px] font-bold text-orange-400 px-2 py-1 rounded-full border border-orange-500/30 bg-orange-500/10">
                  FAST
                </span>
              </div>

              <h3 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-foreground")}>Image to Slides</h3>
              <p className={cn("text-sm mb-4", isDark ? "text-white/60" : "text-foreground/70")}>
                Direct creation from text input with automatic infographics
              </p>

              <ul className="space-y-2 mb-6 flex-1">
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Instant outline generation</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Smart chart integration</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Multiple export formats</span>
                </li>
              </ul>

              <Button
                variant="ghost"
                className={cn(
                  "w-full h-11 bg-gradient-to-r from-orange-500/10 to-pink-500/10 hover:from-orange-500/20 hover:to-pink-500/20 hover:bg-transparent transition-all border-0",
                  isDark ? "text-white" : "text-foreground"
                )}
                onClick={() => router.push("/presentation")}
              >
                Start Creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Chat to Slides Option */}
            <div className={cn(
              "group relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 flex flex-col h-full",
              isDark ? "bg-black/40 hover:bg-black/50 border-white/10" : "bg-white/40 hover:bg-white/50 border-black/10",
              "hover:border-purple-500/50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </div>
                <span className="text-[10px] font-bold text-purple-400 px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10">
                  ✨ AI POWERED
                </span>
              </div>

              <h3 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-foreground")}>Chat to Slides</h3>
              <p className={cn("text-sm mb-4", isDark ? "text-white/60" : "text-foreground/70")}>
                Conversational AI agent powered by Claude for premium results
              </p>

              <ul className="space-y-2 mb-6 flex-1">
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Interactive AI dialogue</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Real-time preview & refinement</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Web search integration</span>
                </li>
              </ul>

              <Button
                variant="ghost"
                className={cn(
                  "w-full h-11 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 hover:bg-transparent transition-all border-0",
                  isDark ? "text-white" : "text-foreground"
                )}
                onClick={() => router.push("/presentation/agent")}
              >
                Start Conversation
                <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Document Processor Option */}
            <div className={cn(
              "group relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 flex flex-col h-full",
              isDark ? "bg-black/40 hover:bg-black/50 border-white/10" : "bg-white/40 hover:bg-white/50 border-black/10",
              "hover:border-blue-500/50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 group-hover:scale-110 transition-transform">
                  <Image className="h-6 w-6 text-blue-400" />
                </div>
                <span className="text-[10px] font-bold text-blue-400 px-2 py-1 rounded-full border border-blue-500/30 bg-blue-500/10">
                  SMART
                </span>
              </div>

              <h3 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-foreground")}>Document Processor</h3>
              <p className={cn("text-sm mb-4", isDark ? "text-white/60" : "text-foreground/70")}>
                Process PDF and images page by page with AI-powered instructions
              </p>

              <ul className="space-y-2 mb-6 flex-1">
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-blue-500 mt-0.5">▸</span>
                  <span>PDF to image conversion</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-blue-500 mt-0.5">▸</span>
                  <span>Step-by-step processing</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-blue-500 mt-0.5">▸</span>
                  <span>Batch export functionality</span>
                </li>
              </ul>

              <Button
                variant="ghost"
                className={cn(
                  "w-full h-11 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 hover:bg-transparent transition-all border-0",
                  isDark ? "text-white" : "text-foreground"
                )}
                onClick={() => router.push("/document-processor")}
              >
                Start Processing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Create Prezi Option */}
            <div className={cn(
              "group relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 flex flex-col h-full",
              isDark ? "bg-black/40 hover:bg-black/50 border-white/10" : "bg-white/40 hover:bg-white/50 border-black/10",
              "hover:border-green-500/50"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 group-hover:scale-110 transition-transform">
                  <Presentation className="h-6 w-6 text-green-400" />
                </div>
                <span className="text-[10px] font-bold text-green-400 px-2 py-1 rounded-full border border-green-500/30 bg-green-500/10">
                  INTERACTIVE
                </span>
              </div>

              <h3 className={cn("text-2xl font-bold mb-2", isDark ? "text-white" : "text-foreground")}>Create Prezi</h3>
              <p className={cn("text-sm mb-4", isDark ? "text-white/60" : "text-foreground/70")}>
                Interactive canvas-based presentations with zoom and pan effects
              </p>

              <ul className="space-y-2 mb-6 flex-1">
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-green-500 mt-0.5">▸</span>
                  <span>Non-linear storytelling</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-green-500 mt-0.5">▸</span>
                  <span>Infinite canvas workspace</span>
                </li>
                <li className={cn("flex items-start gap-2 text-xs", isDark ? "text-white/70" : "text-foreground/80")}>
                  <span className="text-green-500 mt-0.5">▸</span>
                  <span>Zoom & pan animations</span>
                </li>
              </ul>

              <Button
                variant="ghost"
                className={cn(
                  "w-full h-11 bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 hover:bg-transparent transition-all border-0",
                  isDark ? "text-white" : "text-foreground"
                )}
                onClick={() => router.push("/presentation/prezi-new")}
              >
                Create Prezi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
