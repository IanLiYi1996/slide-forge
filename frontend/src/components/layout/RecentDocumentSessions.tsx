"use client";

/**
 * Recent Document Processor Sessions Sidebar Component
 * Shows the most recent 5 sessions with quick access and delete functionality
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
import { Image, Clock, Trash2, FileCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface DocumentSession {
  id: string;
  sessionId: string;
  title: string;
  fileName: string | null;
  fileType: string | null;
  totalPages: number;
  processedPages: number;
  status: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export function RecentDocumentSessions() {
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
    queryKey: ["document-sessions-recent"],
    queryFn: async () => {
      const response = await fetch("/api/document-processor/session");
      if (!response.ok) throw new Error("Failed to load sessions");
      const data = await response.json();
      return (data.sessions || []) as DocumentSession[];
    },
  });

  const recentSessions = sessions?.slice(0, 5) || [];

  // Handle delete click
  const handleDeleteClick = (
    e: React.MouseEvent,
    sessionId: string,
    id: string,
    title: string,
  ) => {
    e.stopPropagation(); // Prevent navigation
    setDeletingSession({ id, sessionId, title });
    setDeleteDialogOpen(true);
  };

  // Execute delete
  const handleDelete = async () => {
    if (!deletingSession) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/document-processor/session/${deletingSession.sessionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      toast({
        title: "Deleted",
        description: "Document session deleted successfully",
      });

      // Refresh list
      await queryClient.invalidateQueries({
        queryKey: ["document-sessions-recent"],
      });
    } catch (error) {
      console.error("Error deleting session:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingSession(null);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <Separator className="mb-4" />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
            Recent Documents
          </p>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (recentSessions.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-3">
      <Separator className="mb-4" />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
          Recent Documents
        </p>

        {recentSessions.map((session) => (
          <div key={session.id} className="relative group">
            <button
              onClick={() =>
                router.push(`/document-processor/${session.sessionId}`)
              }
              className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-12 h-9 rounded border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 flex items-center justify-center border-blue-200 dark:border-blue-800">
                    <Image className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileCheck className="h-3 w-3" />
                      {session.processedPages}/{session.totalPages}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(session.lastActivityAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Delete Button - shows on hover */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) =>
                handleDeleteClick(e, session.sessionId, session.id, session.title)
              }
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {/* View All Button */}
        {recentSessions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/document-processor")}
            className="w-full justify-start gap-2 h-9 text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            View all documents
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSession?.title}"? This
              action cannot be undone. All processed images and history will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
