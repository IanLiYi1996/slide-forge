/**
 * Agent 状态管理
 * 使用 Zustand 管理 Claude Agent 的前端状态
 */

import { create } from "zustand";
import type { Message, UploadedFile } from "@/lib/agent/types";
import type {
  WorkflowStage,
  WorkflowState,
  SlideData,
} from "@/lib/agent/types/workflow";
import { TypewriterManager } from "@/lib/agent/typewriter-manager";

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

  // 工作流状态
  workflowStage: WorkflowStage;
  workflowState: WorkflowState | null;

  // 快捷访问工作流数据
  outline: string[];
  outlineTitle: string | null;
  slides: SlideData[];
  currentSlideIndex: number;

  // Actions - 会话管理
  setCurrentSession: (sessionId: string, title: string) => void;
  clearCurrentSession: () => void;

  // Actions - 消息管理
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  appendToStreamingMessage: (content: string) => void;
  appendToStreamingMessageInstant: (content: string) => void; // 立即显示（用于特殊内容）
  skipTypingAnimation: () => void; // 跳过打字动画
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

  // Actions - 工作流管理
  setWorkflowStage: (stage: WorkflowStage) => void;
  setWorkflowState: (state: WorkflowState) => void;
  updateSlide: (index: number, data: Partial<SlideData>) => void;
  addSlide: (slide: SlideData) => void;
  setOutline: (outline: string[], title: string | null) => void;
  setCurrentSlideIndex: (index: number) => void;
  incrementSlideIndex: () => void;

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

  // 工作流状态
  workflowStage: "IDLE" as WorkflowStage,
  workflowState: null as WorkflowState | null,
  outline: [] as string[],
  outlineTitle: null as string | null,
  slides: [] as SlideData[],
  currentSlideIndex: 0,
};

// ✅ 全局打字机实例（所有会话共享）
const globalTypewriter = new TypewriterManager(25); // 25ms/字符

export const useAgentState = create<AgentState>((set) => {
  // ✅ 在 store 创建时立即设置打字机回调
  globalTypewriter.setCallback((char) => {
    set((state) => ({
      streamingMessage: state.streamingMessage + char,
    }));
  });

  return {
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

  // ✅ 使用打字机队列（流式效果）
  appendToStreamingMessage: (content) => {
    globalTypewriter.enqueue(content);
  },

  // ✅ 立即追加（绕过动画，用于工具调用通知等）
  appendToStreamingMessageInstant: (content) =>
    set((state) => ({
      streamingMessage: state.streamingMessage + content,
    })),

  // ✅ 跳过打字动画
  skipTypingAnimation: () => {
    globalTypewriter.skipAnimation();
  },

  finalizeStreamingMessage: () =>
    set((state) => {
      // 先清空打字机队列
      globalTypewriter.clear();

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

  // 工作流管理
  setWorkflowStage: (stage) => set({ workflowStage: stage }),

  setWorkflowState: (state) =>
    set({
      workflowState: state,
      workflowStage: state.stage,
      outline: state.outline,
      outlineTitle: state.outlineTitle,
      slides: state.slides,
      currentSlideIndex: state.currentSlideIndex,
    }),

  updateSlide: (index, data) =>
    set((state) => {
      const updatedSlides = [...state.slides];
      if (updatedSlides[index]) {
        updatedSlides[index] = { ...updatedSlides[index], ...data } as SlideData;
      }
      return { slides: updatedSlides };
    }),

  addSlide: (slide) =>
    set((state) => ({
      slides: [...state.slides, slide],
    })),

  setOutline: (outline, title) =>
    set({
      outline,
      outlineTitle: title,
    }),

  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),

  incrementSlideIndex: () =>
    set((state) => ({
      currentSlideIndex: state.currentSlideIndex + 1,
    })),

  // 重置
  reset: () => set(initialState),
  };
});
