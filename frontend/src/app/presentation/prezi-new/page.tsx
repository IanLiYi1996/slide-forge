/**
 * Create New Prezi Page
 *
 * Offers users two options:
 * 1. Create blank Prezi manually
 * 2. Generate Prezi with AI
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { PreziCreationChoice } from "@/components/presentation/prezi/PreziCreationChoice";

export const metadata = {
  title: "Create New Prezi | Slide Forge",
  description: "Create a new Prezi-style presentation - blank or AI-generated",
};

export default async function PreziNewPage() {
  // Verify authentication
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <PreziCreationChoice />
    </div>
  );
}
