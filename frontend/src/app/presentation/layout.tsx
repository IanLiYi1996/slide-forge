import { PresentationGenerationManager } from "@/components/presentation/dashboard/PresentationGenerationManager";
import type React from "react";

export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PresentationGenerationManager />
      <div className="flex h-full w-full flex-col">
        <main className="relative flex flex-1 overflow-hidden">
          <div className="sheet-container h-full w-full flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
