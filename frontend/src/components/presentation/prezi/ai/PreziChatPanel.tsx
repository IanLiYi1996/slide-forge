"use client";

/**
 * Prezi Chat Panel Component
 *
 * Integrates AI chat for conversational editing of Prezi presentations.
 * Uses natural language to modify elements, styles, animations, and paths.
 */

import { useState, useRef, useEffect } from "react";
import { usePreziEditorStore } from "@/states/prezi-editor-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Sparkles, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { PreziCommandExecutor, type PreziCommand } from "@/lib/prezi-command-executor";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export const PreziChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `prezi-${Date.now()}`);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canvasData = usePreziEditorStore((state) => state.canvasData);
  const selectedElements = usePreziEditorStore((state) => state.selectedElements);
  const currentKeyframeIndex = usePreziEditorStore(
    (state) => state.currentKeyframeIndex
  );

  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ✨ Initialize session on first mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await fetch("/api/agent/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Prezi Edit - ${new Date().toLocaleString()}`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Use the database session ID returned from the server
          if (data.session?.id) {
            // Note: We keep using our client-side sessionId for now
            // The server will create a DB session on first message if needed
            setSessionInitialized(true);
          }
        } else {
          console.warn("Failed to initialize session, will create on first message");
          setSessionInitialized(true); // Allow messaging anyway
        }
      } catch (error) {
        console.warn("Session initialization error:", error);
        setSessionInitialized(true); // Allow messaging anyway
      }
    };

    initSession();
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Add context information to help AI understand the current state
      const contextInfo = {
        totalElements: Object.keys(canvasData?.elements || {}).length,
        selectedElements: selectedElements.length,
        selectedElementIds: selectedElements,
        currentKeyframe: currentKeyframeIndex,
        hasActivePath: !!canvasData?.activePath,
      };

      const enrichedMessage = `${input}\n\n[Context: ${JSON.stringify(contextInfo)}]`;

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: enrichedMessage,
          enableWebSearch: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      // Parse streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = "";

      // Add a placeholder message that will be updated
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: false });
        const lines = buffer.split("\n");

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line && line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "assistant_message" || parsed.type === "text-delta") {
                const content = parsed.content || parsed.textDelta || "";
                assistantMessage += content;

                // Update the last message (assistant's message)
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (updated[lastIndex]?.role === "assistant") {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: assistantMessage,
                    };
                  }
                  return updated;
                });
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1] || "";
      }

      // ✨ Try to parse and execute commands from AI response
      try {
        // Check if the response contains a JSON command
        const jsonMatch = assistantMessage.match(/\{[\s\S]*"action"[\s\S]*\}/);
        if (jsonMatch) {
          const command: PreziCommand = JSON.parse(jsonMatch[0]);

          // Execute the command
          const success = PreziCommandExecutor.execute(command);

          if (success) {
            const confirmation = PreziCommandExecutor.getConfirmation(command);
            toast({
              title: "Command Executed",
              description: confirmation,
            });
          } else {
            toast({
              variant: "destructive",
              title: "Command Failed",
              description: "Failed to execute the command. Check console for details.",
            });
          }
        }
      } catch (e) {
        // Not a command, just text response - this is fine
        console.log("Response is not a command, displaying as text");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
        },
      ]);

      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to communicate with AI assistant.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Assistant
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ask me to edit your Prezi presentation
        </p>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Welcome to AI Assist</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Try these commands:
                </p>
                <ul className="text-sm text-left space-y-2 max-w-md mx-auto">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">
                      "Move the title to position x=100, y=200"
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">
                      "Add a text element saying 'Hello World' at (300, 300)"
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">
                      "Change background color to light blue"
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">
                      "Add a zoom-in animation to the first element"
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span className="text-muted-foreground">
                      "Create a keyframe focusing on the selected element"
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content || (
                    <span className="text-muted-foreground italic">Thinking...</span>
                  )}
                </p>
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a command... (Shift+Enter for new line)"
            className="flex-1 resize-none min-h-[60px] max-h-[120px]"
            disabled={isLoading}
            rows={2}
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Tips */}
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            Tip: Select elements first to perform actions on them. Use natural language to
            describe what you want to do.
          </p>
        </div>
      </div>
    </div>
  );
};
