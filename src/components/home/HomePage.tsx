"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function HomePage() {
  const router = useRouter();

  return (
    <div className="relative flex w-full min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* WebGL Background - positioned relative to main content area */}
      <div className="absolute inset-0 w-full h-full">
        <WebGLShader />
      </div>

      <div className="relative border border-[#27272a] p-2 w-full mx-auto max-w-5xl z-10 my-8">
        <main className="relative border border-[#27272a] py-16 overflow-hidden">
          {/* Hero Section */}
          <div className="text-center space-y-6 mb-12">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-2xl">
                <FileText className="h-10 w-10 text-white" />
              </div>
            </div>

            <h1 className="mb-3 text-white text-center text-7xl font-extrabold tracking-tighter md:text-[clamp(2rem,8vw,7rem)]">
              SlideForge
            </h1>

            <p className="text-white/80 px-6 text-center text-sm md:text-base lg:text-xl max-w-3xl mx-auto">
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
          <div className="grid md:grid-cols-2 gap-6 px-6 mb-12">
            {/* Image to Slides Option */}
            <div className="group relative p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm hover:bg-black/50 hover:border-orange-500/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 group-hover:scale-110 transition-transform">
                  <FileText className="h-6 w-6 text-orange-400" />
                </div>
                <span className="text-[10px] font-bold text-orange-400 px-2 py-1 rounded-full border border-orange-500/30 bg-orange-500/10">
                  FAST
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">Image to Slides</h3>
              <p className="text-white/60 text-sm mb-4">
                Direct creation from text input with automatic infographics
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Instant outline generation</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Smart chart integration</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-orange-500 mt-0.5">▸</span>
                  <span>Multiple export formats</span>
                </li>
              </ul>

              <LiquidButton
                className="w-full text-white border border-orange-500/30 hover:border-orange-500/60 bg-gradient-to-r from-orange-500/10 to-pink-500/10"
                size="lg"
                onClick={() => router.push("/presentation")}
              >
                Start Creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </LiquidButton>
            </div>

            {/* Chat to Slides Option */}
            <div className="group relative p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm hover:bg-black/50 hover:border-purple-500/50 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-purple-400" />
                </div>
                <span className="text-[10px] font-bold text-purple-400 px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10">
                  ✨ AI POWERED
                </span>
              </div>

              <h3 className="text-2xl font-bold text-white mb-2">Chat to Slides</h3>
              <p className="text-white/60 text-sm mb-4">
                Conversational AI agent powered by Claude for premium results
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Interactive AI dialogue</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Real-time preview & refinement</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-purple-500 mt-0.5">▸</span>
                  <span>Web search integration</span>
                </li>
              </ul>

              <LiquidButton
                className="w-full text-white border border-purple-500/30 hover:border-purple-500/60 bg-gradient-to-r from-purple-500/10 to-pink-500/10"
                size="lg"
                onClick={() => router.push("/presentation/agent")}
              >
                Start Conversation
                <Sparkles className="ml-2 h-4 w-4" />
              </LiquidButton>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="text-center px-6">
            <p className="text-xs text-white/50">
              Both methods support multiple languages and customizable themes
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
