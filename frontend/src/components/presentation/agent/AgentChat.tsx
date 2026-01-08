"use client";

/**
 * Agent 对话组件
 * 处理用户与 Claude Agent 的实时对话
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentState } from "@/states/agent-state";
import { Send, Loader2, Upload, X, User, Sparkles, FileText, FileCode, File as FileIcon, Globe, Home, Trash2, MessageSquare, ArrowUp, Edit2, Check } from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import type { Message } from "@/lib/agent/types";
import type { SlideData } from "@/lib/agent/types/workflow";
import { MarkdownMessage } from "./MarkdownMessage";
import { ExportToolbar } from "./ExportToolbar";
import { extractSlidesFromMessages, isPresentationComplete } from "@/lib/agent/utils/extract-slides";
import { parseFile } from "@/lib/file-parsers";
import { AgentWebSearchToggle } from "./AgentWebSearchToggle";
import { FilePreviewCard } from "./FilePreviewCard";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

interface AgentChatProps {
  sessionId: string;
  initialMessages?: Message[];
}

export function AgentChat({ sessionId, initialMessages = [] }: AgentChatProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    messages,
    setMessages,
    isGenerating,
    setGenerating,
    streamingMessage,
    appendToStreamingMessage,
    appendToStreamingMessageInstant,
    finalizeStreamingMessage,
    uploadedFiles,
    addFile,
    removeFile,
    clearMessages,
    clearFiles,
    reset,
    enableWebSearch,
    currentSessionTitle,
  } = useAgentState();

  const [inputValue, setInputValue] = useState("");
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, string>>(new Map());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [dbSlides, setDbSlides] = useState<SlideData[] | null>(null);
  const [isLoadingDbSlides, setIsLoadingDbSlides] = useState(false);
  const [streamedSlides, setStreamedSlides] = useState<Map<number, SlideData>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const prevSessionIdRef = useRef<string>(sessionId);

  // 开始编辑标题
  const handleStartEdit = () => {
    setEditedTitle(currentSessionTitle || "");
    setIsEditingTitle(true);
    // Focus input after state update
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  // 保存标题
  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === currentSessionTitle) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      const response = await fetch(`/api/agent/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title");
      }

      // Update local state via agent state
      useAgentState.setState({ currentSessionTitle: editedTitle.trim() });

      // Refresh sidebar sessions list
      await queryClient.invalidateQueries({ queryKey: ["agent-sessions-recent"] });

      toast.success("Session name updated");
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error("Failed to update session name");
    } finally {
      setIsSavingTitle(false);
    }
  };

  // 删除会话
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
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

  // 当 sessionId 改变时，重置状态
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      // sessionId 改变了，重置所有状态
      reset();
      setStreamedSlides(new Map()); // ✅ 清空流式缓存
      setDbSlides(null); // ✅ 清空数据库缓存
      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId, reset]);

  // 初始化消息
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      // 如果没有初始消息，确保消息列表为空
      clearMessages();
    }
  }, [initialMessages, setMessages, clearMessages, sessionId]);

  // ✅ 从数据库加载幻灯片（优先数据源）- 添加防抖
  useEffect(() => {
    const loadDbSlides = async () => {
      if (!sessionId) return;

      // ✅ 如果正在生成中，延迟加载（等待流式完成）
      if (isGenerating) {
        console.log("[AgentChat] Skipping db load - generation in progress");
        return;
      }

      setIsLoadingDbSlides(true);
      try {
        // ✅ 添加小延迟，确保后台数据库同步已完成
        await new Promise((resolve) => setTimeout(resolve, 500));

        const response = await fetch(`/api/agent/session/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          const slidesFromDb = data.session?.slides;

          if (slidesFromDb && Array.isArray(slidesFromDb) && slidesFromDb.length > 0) {
            setDbSlides(slidesFromDb as SlideData[]);

            // ✅ 同时初始化 streamedSlides（页面刷新后需要）
            const slidesMap = new Map<number, SlideData>();
            slidesFromDb.forEach((slide: SlideData) => {
              slidesMap.set(slide.index, slide);
            });
            setStreamedSlides(slidesMap);

            console.log(
              `[AgentChat] Loaded ${slidesFromDb.length} slides from database and initialized cache for session ${sessionId}`
            );
          }
        }
      } catch (error) {
        console.error("Failed to load slides from database:", error);
      } finally {
        setIsLoadingDbSlides(false);
      }
    };

    loadDbSlides();
  }, [sessionId, isGenerating]); // ✅ 添加 isGenerating 依赖

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // 自动调整 textarea 高度（仅在客户端执行，避免 SSR hydration 错误）
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto';
    // 设置新高度，最大 384px
    textarea.style.height = Math.min(textarea.scrollHeight, 384) + 'px';
  }, [inputValue]);

  // 从消息或数据库中提取所有幻灯片（优先使用流式缓存）
  const extractedSlides = useMemo(() => {
    // ✅ 优先级1: 流式缓存（最新，来自 SSE 事件）
    if (streamedSlides.size > 0) {
      const slides = Array.from(streamedSlides.values()).sort((a, b) => a.index - b.index);
      console.log(
        `[AgentChat] Using ${slides.length} slides from streamed cache`
      );
      return slides;
    }

    // ✅ 优先级2: 数据库幻灯片（刷新后可用）
    if (dbSlides && dbSlides.length > 0) {
      console.log(
        `[AgentChat] Using ${dbSlides.length} slides from database`
      );
      return dbSlides;
    }

    // ✅ 优先级3: 从消息提取（回退方案）
    const slidesFromMessages = extractSlidesFromMessages(messages);
    if (slidesFromMessages.length > 0) {
      console.log(
        `[AgentChat] Using ${slidesFromMessages.length} slides extracted from messages`
      );
    }

    return slidesFromMessages;
  }, [streamedSlides, dbSlides, messages]);

  // 检查演示文稿是否完成
  const presentationComplete = useMemo(
    () => isPresentationComplete(messages) && extractedSlides.length > 0,
    [messages, extractedSlides],
  );

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return;

    const userMessage = inputValue;
    setInputValue("");

    // 添加用户消息到状态
    const newMessage: Message = {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages([...messages, newMessage]);
    setGenerating(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          files: uploadedFiles,
          enableWebSearch,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = ""; // 添加缓冲区处理跨包的不完整行

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用 stream: true 进行增量解码（处理多字节 UTF-8）
        buffer += decoder.decode(value, { stream: true });

        // 按换行符分割，保留最后一个不完整的行在缓冲区
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留不完整的行

        // 只处理完整的行
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              finalizeStreamingMessage();
              break;
            }

            try {
              const parsed = JSON.parse(data);

              // 处理助手消息
              if (parsed.type === "assistant_message") {
                appendToStreamingMessage(parsed.content);
              }
              // 🎯 处理流式幻灯片完成
              else if (parsed.type === "slide_complete") {
                const { slideIndex, html, timestamp } = parsed;

                // ✅ 立即保存幻灯片数据到流式缓存
                setStreamedSlides((prev) => {
                  const updated = new Map(prev);
                  updated.set(slideIndex, {
                    id: `slide-${slideIndex}`,
                    index: slideIndex,
                    html,
                    status: "ready",
                    outlineContent: `Slide ${slideIndex}`,
                    modificationCount: 0,
                    conversationHistory: [],
                  });
                  console.log(`[AgentChat] Saved slide ${slideIndex} to streamed cache (${updated.size} total)`);
                  return updated;
                });

                // 显示成功通知
                toast.success(`Slide ${slideIndex} generated!`, {
                  description: "Your slide is ready to view",
                  duration: 2000,
                });

                // 在消息中添加提示（不显示完整HTML，避免界面混乱）
                // ✅ 使用立即显示，元信息不需要打字机效果
                appendToStreamingMessageInstant(
                  `\n\n✅ **Slide ${slideIndex} completed** - View it in the preview below.\n\n`
                );

                console.log(`[AgentChat] Received slide ${slideIndex} with ${html.length} chars`);
              }
              // 处理工具使用
              else if (parsed.type === "tool_use") {
                const toolMessage = `\n\n[Using tool: ${parsed.toolName}]\n\n`;
                // ✅ 使用立即显示，元信息不需要打字机效果
                appendToStreamingMessageInstant(toolMessage);
              }
              // 处理结果
              else if (parsed.type === "result") {
                if (parsed.success) {
                  finalizeStreamingMessage();
                } else {
                  toast.error("Agent query failed");
                }
              }
              // 处理错误
              else if (parsed.type === "error") {
                toast.error(parsed.content || "An error occurred");
              }
            } catch (e) {
              // 只记录真正无法解析的数据（不是部分数据）
              console.warn("Failed to parse SSE data:", data.substring(0, 100) + "...");
            }
          }
        }
      }

      // 处理最后的缓冲区（如果包含完整数据）
      if (buffer.trim() && buffer.startsWith("data: ")) {
        try {
          const data = buffer.slice(6);
          const parsed = JSON.parse(data);
          if (parsed.type === "assistant_message") {
            appendToStreamingMessage(parsed.content);
          }
        } catch (e) {
          console.warn("Failed to parse final buffer:", e);
        }
      }

      // 清理文件
      uploadedFiles.forEach((file) => removeFile(file.name));
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setGenerating(false);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理文件上传 - 使用 parseFile 进行健壮解析
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 验证总文件数
    const totalFiles = uploadedFiles.length + files.length;
    if (totalFiles > 10) {
      toast.error("Maximum 10 files allowed at once");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploadingFiles(true);

    for (const file of files) {
      // 检查是否已上传
      const isDuplicate = uploadedFiles.some(f => f.name === file.name);
      if (isDuplicate) {
        toast.warning(`${file.name} already uploaded`);
        continue;
      }

      try {
        // 更新进度
        setUploadProgress(prev => new Map(prev).set(file.name, "parsing"));

        // 使用 parseFile 进行健壮解析
        const content = await parseFile(file);

        // 添加解析后的文件到状态
        addFile({
          name: file.name,
          content: content,
          type: file.type,
          size: file.size,
        });

        // 更新进度
        setUploadProgress(prev => {
          const next = new Map(prev);
          next.set(file.name, "success");
          return next;
        });

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error(`Error parsing ${file.name}:`, error);

        // 更新进度
        setUploadProgress(prev => {
          const next = new Map(prev);
          next.set(file.name, "error");
          return next;
        });

        toast.error(
          `Failed to parse ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    // 2秒后清除进度
    setTimeout(() => {
      setUploadProgress(new Map());
      setIsUploadingFiles(false);
    }, 2000);

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-x-hidden">
      {/* 顶部标题栏 - 仅在有会话标题时显示 */}
      {currentSessionTitle && (
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-4 py-2 max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1 group">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        className="text-sm font-semibold bg-transparent border-b border-primary focus:outline-none w-full max-w-md"
                        disabled={isSavingTitle}
                        placeholder="Enter session name"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveTitle}
                        disabled={isSavingTitle || !editedTitle.trim()}
                        className="h-6 w-6 p-0"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={isSavingTitle}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-sm font-semibold line-clamp-1">
                        {currentSessionTitle}
                      </h1>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStartEdit}
                        className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100 transition-opacity"
                        title="Edit session name"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {!isEditingTitle && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {messages.length} messages
                      </span>
                      {extractedSlides.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{extractedSlides.length} slides</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="gap-1.5 h-8 text-xs"
              >
                <Home className="h-3.5 w-3.5" />
                Home
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isDeleting ? "..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
        <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
              <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-light text-foreground mb-2">
                Start a conversation
              </h1>
              <p className="text-sm text-muted-foreground max-w-md text-center mb-8">
                Ask Claude to create presentations, analyze documents, or help refine your slides.
                {enableWebSearch && " I can search the web for current information."}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs border border-border">
                  <Upload className="h-3 w-3" />
                  <span>Upload TXT, MD, DOCX, PDF, CSV</span>
                </div>
                {enableWebSearch && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs border border-border">
                    <Globe className="h-3 w-3" />
                    <span>Web search enabled</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-4 ${
                message.role === "user" ? "justify-end" : ""
              }`}
            >
              {/* 助手消息 - 头像在左 */}
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}

              {/* 消息内容 */}
              <div className={`flex-1 min-w-0 ${message.role === "user" ? "ml-12" : "mr-12"}`}>
                <div
                  className={`rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md break-words ${
                    message.role === "user"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-card border border-border"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <MarkdownMessage content={message.content} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>

              {/* 用户消息 - 头像在右 */}
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* 等待动画 - Agent 思考中 */}
          {isGenerating && !streamingMessage && (
            <div className="flex items-start gap-4 animate-fade-in">
              {/* 助手头像 */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>

              {/* 思考中动画 */}
              <div className="flex-1 mr-12">
                <div className="rounded-2xl p-4 shadow-sm bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">Thinking</span>
                    <span className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 流式消息 */}
          {streamingMessage && (
            <div className="flex items-start gap-4 animate-fade-in">
              {/* 助手头像 */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>

              {/* 消息内容 */}
              <div className="flex-1 mr-12">
                <div className="rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md bg-card border border-border">
                  <MarkdownMessage content={streamingMessage} />
                  <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                </div>
              </div>
            </div>
          )}

          {/* 导出工具栏 - 当幻灯片完成时显示 */}
          {presentationComplete && (
            <div className="mt-6">
              <ExportToolbar slides={extractedSlides} sessionId={sessionId} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域容器 */}
      <div className="flex-shrink-0 border-t bg-muted/30 w-full">
        <div className="w-full max-w-3xl mx-auto px-4 py-4">

          {/* Web Search Toggle - 在输入框外上方 */}
          <div className="mb-3 flex items-center gap-2">
            <AgentWebSearchToggle />
            <span className="text-xs text-muted-foreground">
              {enableWebSearch
                ? "Agent can search the web for current information"
                : "Agent will use only its training data"}
            </span>
          </div>

          {/* 精美输入框容器 */}
          <div className={`
            rounded-2xl border border-border bg-background
            shadow-[0_0_15px_rgba(0,0,0,0.08)]
            hover:shadow-[0_0_20px_rgba(0,0,0,0.12)]
            focus-within:shadow-[0_0_25px_rgba(0,0,0,0.15)]
            transition-all duration-200
          `}>

            {/* 文件上传进度 */}
            {isUploadingFiles && (
              <div className="px-4 pt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing files...</span>
                </div>
              </div>
            )}

            {/* 文件预览 - 横向滚动，在输入框内部上方 */}
            {uploadedFiles.length > 0 && (
              <div className="px-3 pt-3">
                <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                  {uploadedFiles.map((file) => (
                    <FilePreviewCard
                      key={file.name}
                      file={file}
                      progress={uploadProgress.get(file.name)}
                      onRemove={() => removeFile(file.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Textarea 输入区 */}
            <div className="px-4 py-3">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="How can I help you today?"
                disabled={isGenerating}
                className="w-full bg-transparent border-0 outline-none resize-none text-base placeholder:text-muted-foreground leading-relaxed focus:ring-0"
                rows={1}
              />
            </div>

            {/* Action Bar */}
            <div className="px-3 pb-3 flex items-center justify-between gap-2">
              {/* 左侧工具 */}
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".txt,.md,.json,.docx,.pdf,.csv"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating || isUploadingFiles}
                  className="h-8 w-8 rounded-lg hover:bg-muted"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>

              {/* 右侧：发送按钮 */}
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isGenerating}
                size="icon"
                className={`h-8 w-8 rounded-xl transition-all ${
                  inputValue.trim() && !isGenerating
                    ? 'bg-primary hover:bg-primary/90 shadow-md'
                    : 'bg-primary/30 cursor-default'
                }`}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 提示文本 */}
          <p className="text-xs text-muted-foreground text-center mt-3">
            AI can make mistakes. Please check important information.
          </p>
        </div>
      </div>
    </div>
  );
}
