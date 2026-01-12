/**
 * Presentation View Router
 *
 * Routes to the appropriate viewer based on presentation mode:
 * - TRADITIONAL: Image slides viewer
 * - PREZI: Prezi player
 */

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { redirect, notFound } from "next/navigation";
import PresentationPage from "@/components/presentation/presentation-page/Main";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Fetch presentation to check mode
  const presentation = await db.presentation.findUnique({
    where: { id: resolvedParams.id },
    select: {
      id: true,
      presentationMode: true,
      base: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!presentation) {
    notFound();
  }

  // Check ownership
  if (presentation.base.userId !== session.user.id) {
    notFound();
  }

  // ✨ Route based on presentation mode
  if (presentation.presentationMode === "PREZI") {
    redirect(`/presentation/prezi-play/${resolvedParams.id}`);
  }

  // Default: Traditional image slides viewer
  return <PresentationPage />;
}
