"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SessionErrorViewProps {
  error?: string;
  pageCount?: number;
  onRetry: () => void;
  onCancel: () => void;
}

export function SessionErrorView({ error, pageCount, onRetry, onCancel }: SessionErrorViewProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Session Creation Failed
          </CardTitle>
          <CardDescription>
            {error || "Unable to create processing session. Please try again."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageCount && pageCount > 0 && (
            <div className="text-sm text-muted-foreground">
              {pageCount} page{pageCount !== 1 ? 's' : ''} ready to process
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onRetry}
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
