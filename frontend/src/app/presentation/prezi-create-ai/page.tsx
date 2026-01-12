/**
 * Prezi AI Generator Page
 *
 * Allows users to create new Prezi presentations using AI from a topic and outline.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { PreziAIGenerator } from "@/components/presentation/prezi/ai/PreziAIGenerator";

export const metadata = {
  title: "Create Prezi with AI | Slide Forge",
  description: "Generate a complete Prezi-style presentation from your topic and outline using AI",
};

export default async function PreziCreateAIPage() {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-4xl font-bold">Create Prezi with AI</h1>
          <p className="text-muted-foreground text-lg">
            Generate a complete Prezi-style presentation from your topic and outline
          </p>
        </div>

        <PreziAIGenerator />
      </div>
    </div>
  );
}
