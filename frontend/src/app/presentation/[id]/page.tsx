/**
 * Presentation View Page
 */

import { auth } from "@/server/auth";
import { getPresentation } from "@/services/s3";
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

  // Fetch presentation to check ownership
  const presentation = await getPresentation(resolvedParams.id);

  if (!presentation) {
    notFound();
  }

  // Check ownership
  if (presentation.base.userId !== session.user.id) {
    notFound();
  }

  return <PresentationPage />;
}
