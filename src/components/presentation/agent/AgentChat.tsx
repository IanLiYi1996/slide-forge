"use client";

/**
 * Agent 对话组件
 * 处理用户与 Claude Agent 的实时对话
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentState } from "@/states/agent-state";
import { Send, Loader2, Upload, X, User, Sparkles } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Message } from "@/lib/agent/types";
import { MarkdownMessage } from "./MarkdownMessage";

interface AgentChatProps {
  sessionId: string;
  initialMessages?: Message[];
}

export function AgentChat({ sessionId, initialMessages = [] }: AgentChatProps) {
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
  } = useAgentState();

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化消息
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

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

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        addFile({
          name: file.name,
          content: event.target?.result as string,
          type: file.type,
          size: file.size,
        });
      };
      reader.readAsText(file);
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streamingMessage && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="mb-4 p-4 rounded-full bg-muted">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-2">
                Start a conversation with Claude
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask Claude to create presentations, analyze documents, or help refine your slides.
                I can search the web and provide detailed insights.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-4 shadow-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      message.role === "user"
                        ? "bg-primary-foreground/20"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {message.role === "assistant" ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 流式消息 */}
          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl p-4 shadow-sm bg-card border">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <MarkdownMessage content={streamingMessage} />
                    <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域容器 */}
      <div className="flex-shrink-0 border-t bg-background">
        <div className="max-w-4xl mx-auto">
          {/* 文件上传预览 */}
          {uploadedFiles.length > 0 && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs border"
                  >
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => removeFile(file.name)}
                      className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 输入框 */}
          <div className="px-4 py-3">
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".txt,.md,.json"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="h-10 w-10 flex-shrink-0"
              >
                <Upload className="h-4 w-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude anything..."
                className="resize-none min-h-[40px] max-h-32 text-sm"
                rows={1}
                disabled={isGenerating}
              />

              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isGenerating}
                className="gap-2 h-10 px-4 flex-shrink-0"
                size="sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span className="text-sm">Send</span>
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
