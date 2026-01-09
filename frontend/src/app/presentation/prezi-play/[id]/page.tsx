/**
 * Prezi Play Page
 *
 * Full-screen playback page for Prezi-mode presentations.
 */

import React from "react";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import PreziPlayerComponent from "@/components/presentation/prezi/player/PreziPlayer";
import { type PreziCanvasData } from "@/types/prezi-types";

interface PreziPlayPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoplay?: string }>;
}

/**
 * Prezi play page component
 */
export default async function PreziPlayPage({
  params,
  searchParams,
}: PreziPlayPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  // Fetch presentation
  const presentation = await db.presentation.findUnique({
    where: { id: resolvedParams.id },
    include: {
      base: true,
    },
  });

  if (!presentation) {
    notFound();
  }

  // Check if user owns this presentation
  if (presentation.base.userId !== session.user.id) {
    notFound();
  }

  // Check if this is a Prezi presentation
  if (presentation.presentationMode !== "PREZI") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Wrong Player</h1>
          <p className="mt-2 text-gray-400">
            This presentation is in Traditional mode.
          </p>
          <a
            href={`/presentation/present/${resolvedParams.id}`}
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Traditional Player
          </a>
        </div>
      </div>
    );
  }

  // Parse canvas data
  const canvasData = presentation.content as unknown as PreziCanvasData;

  // Check for autoplay parameter
  const autoPlay = resolvedSearchParams.autoplay === "true";

  return (
    <PreziPlayerComponent
      presentationId={resolvedParams.id}
      initialData={canvasData}
      autoPlay={autoPlay}
    />
  );
}
