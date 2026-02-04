"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// Dynamic import with SSR disabled to avoid pdf.js DOMMatrix issues
const SmartHubLanding = dynamic(
  () => import("@/components/smart-hub/SmartHubLanding").then((mod) => mod.SmartHubLanding),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

export default function CreatePage() {
  return <SmartHubLanding />;
}
