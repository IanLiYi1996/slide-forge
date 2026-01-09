/**
 * Prezi Edit Page
 *
 * Edit page for Prezi-mode presentations.
 * Loads presentation data and renders PreziEditor.
 */

import React from "react";
import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import PreziEditor from "@/components/presentation/prezi/editor/PreziEditor";
import { type PreziCanvasData } from "@/types/prezi-types";

interface PreziEditPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Prezi edit page component
 */
export default async function PreziEditPage({ params }: PreziEditPageProps) {
  const resolvedParams = await params;
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
    // Redirect to traditional editor if not Prezi mode
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">Wrong Editor</h1>
          <p className="mt-2 text-gray-600">
            This presentation is in Traditional mode.
          </p>
          <a
            href={`/presentation/edit/${resolvedParams.id}`}
            className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Traditional Editor
          </a>
        </div>
      </div>
    );
  }

  // Parse canvas data
  const canvasData = presentation.content as unknown as PreziCanvasData;

  return (
    <PreziEditor
      presentationId={resolvedParams.id}
      initialData={canvasData}
    />
  );
}
