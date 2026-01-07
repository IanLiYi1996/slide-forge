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
import { useAgentState } from "@/states/agent-state";

export default function AgentSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { setCurrentSession, clearCurrentSession } = useAgentState();
  const [session, setSession] = useState<AgentSessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载会话数据
  useEffect(() => {
    loadSession();
    // 设置当前 session
    return () => {
      // 清理：离开页面时清除当前 session
      clearCurrentSession();
    };
  }, [sessionId, clearCurrentSession]);

  const loadSession = async () => {
    try {
      const response = await fetch(`/api/agent/session/${sessionId}`);
      if (!response.ok) {
        throw new Error("Failed to load session");
      }

      const data = await response.json();
      setSession(data.session);

      // 设置当前 session 到全局状态
      if (data.session) {
        setCurrentSession(data.session.sessionId, data.session.title);
      }
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
    <div className="h-screen flex flex-col overflow-x-hidden">
      {/* Main Content - Full Height */}
      <AgentChat
        sessionId={sessionId}
        initialMessages={
          Array.isArray(session.messages) ? session.messages : []
        }
      />
    </div>
  );
}
