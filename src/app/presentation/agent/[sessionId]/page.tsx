"use client";

/**
 * Agent 会话详情页
 * 用户与 Claude Agent 对话的主界面
 */

import { Button } from "@/components/ui/button";
import { AgentChat } from "@/components/presentation/agent/AgentChat";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgentSessionData } from "@/lib/agent/types";
import { use } from "react";

export default function AgentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<AgentSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载会话数据
  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const response = await fetch(`/api/agent/session/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to load session");
      }

      const data = await response.json();
      setSession(data.session);
    } catch (error) {
      console.error("Error loading session:", error);
      toast.error("Failed to load session");
      router.push("/presentation/agent");
    } finally {
      setIsLoading(false);
    }
  };

  // 返回列表
  const handleBack = () => {
    router.push("/presentation/agent");
  };

  // 删除会话
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/agent/session/${sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      toast.success("Session deleted successfully");
      router.push("/presentation/agent");
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-lg font-bold mb-2">Session not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The session you're looking for doesn't exist.
          </p>
          <Button onClick={handleBack} size="sm">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5 h-8"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-xs">Back</span>
            </Button>
            <div className="border-l h-5" />
            <div>
              <h1 className="text-sm font-semibold line-clamp-1">
                {session.title}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {Array.isArray(session.messages)
                  ? session.messages.length
                  : 0}{" "}
                messages
                {session.generatedOutline &&
                session.generatedOutline.length > 0
                  ? ` • ${session.generatedOutline.length} slides`
                  : ""}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs">{isDeleting ? "..." : "Delete"}</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <AgentChat
          sessionId={sessionId}
          initialMessages={
            Array.isArray(session.messages) ? session.messages : []
          }
        />
      </div>
    </div>
  );
}
