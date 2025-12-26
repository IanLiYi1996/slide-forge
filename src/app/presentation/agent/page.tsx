"use client";

/**
 * Agent 主页面
 * 显示用户的所有 Agent 会话列表，支持快速创建
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MessageSquare, Clock, ChevronRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AgentSessionData } from "@/lib/agent/types";
import { formatDistanceToNow } from "date-fns";

export default function AgentPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AgentSessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // 加载会话列表
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch("/api/agent/session");
      if (!response.ok) throw new Error("Failed to load sessions");

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
      toast.error("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  // 创建新会话并跳转
  const createNewSession = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Agent Session",
        }),
      });

      if (!response.ok) throw new Error("Failed to create session");

      const data = await response.json();
      const newSession = data.session;

      // 跳转到新会话
      router.push(`/presentation/agent/${newSession.sessionId}`);
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create session");
    } finally {
      setIsCreating(false);
    }
  };

  // 打开会话
  const openSession = (sessionId: string) => {
    router.push(`/presentation/agent/${sessionId}`);
  };

  return (
    <div className="notebook-section relative h-full w-full overflow-auto">
      <div className="container mx-auto max-w-3xl py-4 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              Claude Agent
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI-powered conversations
            </p>
          </div>

          <Button
            onClick={createNewSession}
            disabled={isCreating}
            size="sm"
            className="gap-1.5 h-8"
          >
            <Plus className="h-3 w-3" />
            {isCreating ? "..." : "New"}
          </Button>
        </div>

        {/* 快速开始卡片 */}
        <Card className="mb-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-background rounded-md flex-shrink-0">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold mb-1">Start a conversation</h3>
                <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
                  Create presentations through dialogue. Search web, analyze files, refine slides.
                </p>
                <Button
                  onClick={createNewSession}
                  disabled={isCreating}
                  size="sm"
                  className="gap-1.5 h-7"
                >
                  <Plus className="h-3 w-3" />
                  <span className="text-xs">Start Conversation</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 会话列表 */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground text-center">
                No previous sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground mb-2">
              Recent Sessions
            </h2>
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="hover:shadow-sm transition-shadow cursor-pointer group hover:border-primary/50"
                onClick={() => openSession(session.sessionId)}
              >
                <CardContent className="p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="text-xs font-medium truncate">
                          {session.title}
                        </h3>
                        {session.status !== "active" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {session.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {Array.isArray(session.messages)
                            ? session.messages.length
                            : 0}
                        </span>
                        {session.generatedOutline &&
                          session.generatedOutline.length > 0 && (
                            <span>
                              {session.generatedOutline.length} slides
                            </span>
                          )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(session.lastActivityAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
