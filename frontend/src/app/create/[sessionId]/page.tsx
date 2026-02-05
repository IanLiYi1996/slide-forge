"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Session routing page - automatically redirects to the appropriate mode page
 * based on the session's processing mode
 */
export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndRedirect() {
      try {
        const response = await fetch(`/api/smart-hub/session/${sessionId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Session not found");
            return;
          }
          throw new Error("Failed to load session");
        }

        const data = await response.json();
        const mode = data.session.mode;

        // Redirect to the appropriate mode page
        router.replace(`/create/${sessionId}/${mode}`);
      } catch (err) {
        console.error("Error loading session:", err);
        setError("Failed to load session");
      }
    }

    loadAndRedirect();
  }, [sessionId, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => router.push("/create")}
          className="text-sm text-muted-foreground hover:underline"
        >
          Return to Smart Document Hub
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    </div>
  );
}
