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
      <div className="flex h-screen w-screen flex-col supports-[(height:100dvh)]:h-[100dvh]">
        <main className="relative flex flex-1 overflow-hidden">
          <div className="sheet-container h-full flex-1 place-items-center overflow-y-auto overflow-x-clip">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
