"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SessionCreatingLoaderProps {
  fileName?: string;
  pageCount?: number;
}

export function SessionCreatingLoader({ fileName, pageCount }: SessionCreatingLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Creating session...</p>
              {fileName && (
                <p className="text-sm text-muted-foreground">
                  {fileName} ({pageCount} page{pageCount !== 1 ? 's' : ''})
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Please wait while we prepare your document
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
