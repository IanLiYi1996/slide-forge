"use client";

/**
 * 最近的 Agent 会话侧边栏组件
 * 显示最近的 5 个会话，支持快速恢复和删除
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
import { MessageSquare, Clock, Trash2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { AgentSessionData } from "@/lib/agent/types";

export function RecentAgentSessions() {
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

  // 获取最近的会话
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["agent-sessions-recent"],
    queryFn: async () => {
      const response = await fetch("/api/agent/session");
      if (!response.ok) throw new Error("Failed to load sessions");
      const data = await response.json();
      return (data.sessions || []) as AgentSessionData[];
    },
  });

  const recentSessions = sessions?.slice(0, 5) || [];

  // 处理删除点击
  const handleDeleteClick = (
    e: React.MouseEvent,
    sessionId: string,
    id: string,
    title: string,
  ) => {
    e.stopPropagation(); // 阻止导航
    setDeletingSession({ id, sessionId, title });
    setDeleteDialogOpen(true);
  };

  // 执行删除
  const handleDelete = async () => {
    if (!deletingSession) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/agent/session/${deletingSession.sessionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      toast({
        title: "Deleted",
        description: "Agent session deleted successfully",
      });

      // 刷新列表
      await queryClient.invalidateQueries({
        queryKey: ["agent-sessions-recent"],
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
            Agent Sessions
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
          Agent Sessions
        </p>

        {recentSessions.map((session) => (
          <div key={session.id} className="relative group">
            <button
              onClick={() =>
                router.push(`/presentation/agent/${session.sessionId}`)
              }
              className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-12 h-9 rounded border bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 flex items-center justify-center border-purple-200 dark:border-purple-800">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {Array.isArray(session.messages)
                        ? session.messages.length
                        : 0}
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

            {/* Delete Button - 悬停时显示 */}
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
            onClick={() => router.push("/presentation/agent")}
            className="w-full justify-start gap-2 h-9 text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            View all sessions
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSession?.title}"? This
              action cannot be undone. All conversation history will be
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
