"use client";

/**
 * Recent Smart Hub Sessions Sidebar Component
 * Shows the most recent sessions with quick access and delete functionality
 */

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image, Zap, Clock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { HubSession, ProcessingMode } from "@/types/smart-hub";

const MODE_ICONS: Record<ProcessingMode, typeof Zap> = {
  generate: FileText,
  process: Image,
  extract: Zap,
};

const MODE_LABELS: Record<ProcessingMode, string> = {
  generate: "Generate",
  process: "Process",
  extract: "Extract",
};

export function RecentHubSessions() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<{
    id: string;
    sessionId: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch recent sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["hub-sessions-recent"],
    queryFn: async () => {
      const response = await fetch("/api/smart-hub/session");
      if (!response.ok) throw new Error("Failed to load sessions");
      const data = await response.json();
      return (data.sessions || []) as HubSession[];
    },
  });

  const recentSessions = sessions?.slice(0, 5) || [];

  const handleDeleteClick = (
    e: React.MouseEvent,
    session: HubSession
  ) => {
    e.stopPropagation();
    setDeletingSession({
      id: session.id,
      sessionId: session.sessionId,
      title: session.title,
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSession) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/smart-hub/session/${deletingSession.sessionId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Delete failed");

      toast({
        title: "Session deleted",
        description: `"${deletingSession.title}" has been deleted.`,
      });

      queryClient.invalidateQueries({ queryKey: ["hub-sessions-recent"] });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not delete the session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingSession(null);
    }
  };

  const handleSessionClick = (session: HubSession) => {
    router.push(`/create/${session.sessionId}/${session.mode}`);
  };

  if (isLoading) {
    return (
      <div className="px-4 pb-4">
        <Separator className="mb-4" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Recent Sessions
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!recentSessions.length) {
    return null;
  }

  return (
    <div className="px-4 pb-4">
      <Separator className="mb-4" />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
        Recent Sessions
      </p>
      <div className="space-y-1">
        {recentSessions.map((session) => {
          const Icon = MODE_ICONS[session.mode];
          const modeLabel = MODE_LABELS[session.mode];

          return (
            <div
              key={session.sessionId}
              className="group relative"
            >
              <Button
                variant="ghost"
                className="w-full h-auto py-2 px-3 justify-start hover:bg-accent/50"
                onClick={() => handleSessionClick(session)}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {session.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                        {modeLabel}
                      </span>
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(session.updatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </Button>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => handleDeleteClick(e, session)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSession?.title}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
