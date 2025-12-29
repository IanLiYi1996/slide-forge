"use client";

/**
 * Agent 对话组件
 * 处理用户与 Claude Agent 的实时对话
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentState } from "@/states/agent-state";
import { Send, Loader2, Upload, X, User, Sparkles, FileText, FileCode, File as FileIcon, Globe, Home, Trash2, MessageSquare, ArrowUp } from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import type { Message } from "@/lib/agent/types";
import { MarkdownMessage } from "./MarkdownMessage";
import { ExportToolbar } from "./ExportToolbar";
import { extractSlidesFromMessages, isPresentationComplete } from "@/lib/agent/utils/extract-slides";
import { parseFile } from "@/lib/file-parsers";
import { AgentWebSearchToggle } from "./AgentWebSearchToggle";
import { FilePreviewCard } from "./FilePreviewCard";
import { useRouter } from "next/navigation";

interface AgentChatProps {
  sessionId: string;
  initialMessages?: Message[];
}

export function AgentChat({ sessionId, initialMessages = [] }: AgentChatProps) {
  const router = useRouter();
  const {
    messages,
    setMessages,
    isGenerating,
    setGenerating,
    streamingMessage,
    appendToStreamingMessage,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevSessionIdRef = useRef<string>(sessionId);

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

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // 从消息中提取所有幻灯片
  const extractedSlides = useMemo(
    () => extractSlidesFromMessages(messages),
    [messages],
  );

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

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

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
              // 处理工具使用
              else if (parsed.type === "tool_use") {
                const toolMessage = `\n\n[Using tool: ${parsed.toolName}]\n\n`;
                appendToStreamingMessage(toolMessage);
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
              // 忽略解析错误
              console.warn("Failed to parse chunk:", data);
            }
          }
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
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 - 仅在有会话标题时显示 */}
      {currentSessionTitle && (
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
          <div className="flex items-center justify-between px-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-sm font-semibold line-clamp-1">
                    {currentSessionTitle}
                  </h1>
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
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
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
              <div className={`flex-1 ${message.role === "user" ? "ml-12" : "mr-12"}`}>
                <div
                  className={`rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md ${
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
      <div className="flex-shrink-0 border-t bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 py-4">

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
                onChange={(e) => {
                  setInputValue(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 384) + 'px';
                }}
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
