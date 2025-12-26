/**
 * Agent 状态管理
 * 使用 Zustand 管理 Claude Agent 的前端状态
 */

import { create } from "zustand";
import type { Message, UploadedFile } from "@/lib/agent/types";

interface AgentState {
  // 当前会话信息
  currentSessionId: string | null;
  currentSessionTitle: string | null;

  // 消息和对话
  messages: Message[];
  isGenerating: boolean;
  streamingMessage: string; // 当前正在流式生成的消息

  // 阶段控制
  currentStage: "idle" | "chat" | "outline" | "slides";

  // 生成的内容
  generatedTitle: string | null;
  generatedOutline: string[];
  generatedSlides: string | null;

  // 配置选项
  enableWebSearch: boolean;
  numberOfSlides: number;
  language: string;
  tone: string;

  // 文件上传
  uploadedFiles: UploadedFile[];

  // Actions - 会话管理
  setCurrentSession: (sessionId: string, title: string) => void;
  clearCurrentSession: () => void;

  // Actions - 消息管理
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  appendToStreamingMessage: (content: string) => void;
  finalizeStreamingMessage: () => void;
  clearMessages: () => void;

  // Actions - 生成状态
  setGenerating: (isGenerating: boolean) => void;
  setCurrentStage: (
    stage: "idle" | "chat" | "outline" | "slides",
  ) => void;

  // Actions - 生成内容
  setGeneratedTitle: (title: string) => void;
  setGeneratedOutline: (outline: string[]) => void;
  setGeneratedSlides: (slides: string) => void;
  clearGeneratedContent: () => void;

  // Actions - 配置
  setEnableWebSearch: (enabled: boolean) => void;
  setNumberOfSlides: (num: number) => void;
  setLanguage: (language: string) => void;
  setTone: (tone: string) => void;

  // Actions - 文件上传
  addFile: (file: UploadedFile) => void;
  removeFile: (fileName: string) => void;
  clearFiles: () => void;

  // Actions - 重置
  reset: () => void;
}

const initialState = {
  currentSessionId: null,
  currentSessionTitle: null,
  messages: [],
  isGenerating: false,
  streamingMessage: "",
  currentStage: "idle" as const,
  generatedTitle: null,
  generatedOutline: [],
  generatedSlides: null,
  enableWebSearch: true,
  numberOfSlides: 10,
  language: "en-US",
  tone: "professional",
  uploadedFiles: [],
};

export const useAgentState = create<AgentState>((set) => ({
  ...initialState,

  // 会话管理
  setCurrentSession: (sessionId, title) =>
    set({ currentSessionId: sessionId, currentSessionTitle: title }),

  clearCurrentSession: () =>
    set({ currentSessionId: null, currentSessionTitle: null }),

  // 消息管理
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) => set({ messages }),

  appendToStreamingMessage: (content) =>
    set((state) => ({
      streamingMessage: state.streamingMessage + content,
    })),

  finalizeStreamingMessage: () =>
    set((state) => {
      if (state.streamingMessage) {
        return {
          messages: [
            ...state.messages,
            {
              role: "assistant" as const,
              content: state.streamingMessage,
              timestamp: new Date(),
            },
          ],
          streamingMessage: "",
        };
      }
      return state;
    }),

  clearMessages: () => set({ messages: [], streamingMessage: "" }),

  // 生成状态
  setGenerating: (isGenerating) => set({ isGenerating }),

  setCurrentStage: (stage) => set({ currentStage: stage }),

  // 生成内容
  setGeneratedTitle: (title) => set({ generatedTitle: title }),

  setGeneratedOutline: (outline) => set({ generatedOutline: outline }),

  setGeneratedSlides: (slides) => set({ generatedSlides: slides }),

  clearGeneratedContent: () =>
    set({
      generatedTitle: null,
      generatedOutline: [],
      generatedSlides: null,
    }),

  // 配置
  setEnableWebSearch: (enabled) => set({ enableWebSearch: enabled }),

  setNumberOfSlides: (num) => set({ numberOfSlides: num }),

  setLanguage: (language) => set({ language }),

  setTone: (tone) => set({ tone }),

  // 文件上传
  addFile: (file) =>
    set((state) => ({
      uploadedFiles: [...state.uploadedFiles, file],
    })),

  removeFile: (fileName) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((f) => f.name !== fileName),
    })),

  clearFiles: () => set({ uploadedFiles: [] }),

  // 重置
  reset: () => set(initialState),
}));
