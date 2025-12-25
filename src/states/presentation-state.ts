import { type AspectRatio, type ImageSize } from "@/app/_actions/image/generate";
import { type PlateSlide } from "@/components/presentation/utils/parser";
import { type ThemeProperties, type Themes } from "@/lib/presentation/themes";
import { type TElement } from "platejs";
import { create } from "zustand";

// Type for image model configuration
export type ImageModelConfig = {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
};

interface PresentationState {
  currentPresentationId: string | null;
  currentPresentationTitle: string | null;
  isGridView: boolean;
  isSheetOpen: boolean;
  numSlides: number;

  theme: Themes | string;
  customThemeData: ThemeProperties | null;
  language: string;
  showTemplates: boolean;
  selectedTemplate: string; // Template ID for presentation style
  customThemePrompt: string; // Custom theme style description
  presentationInput: string;
  imageModel: ImageModelConfig;
  imageSource: "ai" | "stock";
  stockImageProvider: "unsplash";
  presentationStyle: string;
  modelProvider: "openai" | "lmstudio";
  modelId: string;
  modelName: string; // User-specified model name for OpenAI Compatible APIs
  savingStatus: "idle" | "saving" | "saved";
  isPresenting: boolean;
  currentSlideIndex: number;
  isThemeCreatorOpen: boolean;

  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
  // Generation states
  shouldStartOutlineGeneration: boolean;
  shouldStartPresentationGeneration: boolean;
  isGeneratingOutline: boolean;
  isGeneratingPresentation: boolean;
  outline: string[];
  searchResults: Array<{ query: string; results: unknown[] }>; // Store search results for context
  webSearchEnabled: boolean; // Toggle for web search in outline generation
  slides: PlateSlide[]; // This now holds the new object structure

  // Thinking content from AI responses
  outlineThinking: string; // Thinking content from outline generation
  presentationThinking: string; // Thinking content from presentation generation

  // Root image generation tracking by slideId
  rootImageGeneration: Record<
    string,
    {
      query: string;
      status: "pending" | "success" | "error";
      url?: string;
      error?: string;
    }
  >;

  // Full slide image generation tracking by slideId
  slideImageGeneration: Record<
    string,
    {
      status: "idle" | "generating" | "success" | "error";
      imageUrl?: string;
      error?: string;
      conversationHistory?: Array<{
        role: "user" | "assistant";
        parts: Array<{
          text?: string;
          inlineData?: { mimeType: string; data?: string; url?: string };
        }>;
      }>;
    }
  >;

  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (update: boolean) => void;
  isRightPanelCollapsed: boolean;
  setIsRightPanelCollapsed: (update: boolean) => void;
  setSlides: (slides: PlateSlide[]) => void;
  startRootImageGeneration: (slideId: string, query: string) => void;
  completeRootImageGeneration: (slideId: string, url: string) => void;
  failRootImageGeneration: (slideId: string, error: string) => void;
  clearRootImageGeneration: (slideId: string) => void;

  // Slide image generation actions
  startSlideImageGeneration: (slideId: string) => void;
  completeSlideImageGeneration: (
    slideId: string,
    imageUrl: string,
    conversationHistory: unknown[],
  ) => void;
  failSlideImageGeneration: (slideId: string, error: string) => void;
  clearSlideImageGeneration: (slideId: string) => void;
  setCurrentPresentation: (id: string | null, title: string | null) => void;
  setIsGridView: (isGrid: boolean) => void;
  setIsSheetOpen: (isOpen: boolean) => void;
  setNumSlides: (num: number) => void;
  setTheme: (
    theme: Themes | string,
    customData?: ThemeProperties | null,
  ) => void;
  shouldShowExitHeader: boolean;
  setShouldShowExitHeader: (udpdate: boolean) => void;
  thumbnailUrl?: string;
  setThumbnailUrl: (url: string | undefined) => void;
  setLanguage: (lang: string) => void;
  setShowTemplates: (show: boolean) => void;
  setSelectedTemplate: (templateId: string) => void;
  setCustomThemePrompt: (prompt: string) => void;
  setPresentationInput: (input: string) => void;
  setOutline: (topics: string[]) => void;
  setSearchResults: (
    results: Array<{ query: string; results: unknown[] }>,
  ) => void;
  setOutlineThinking: (thinking: string) => void;
  setPresentationThinking: (thinking: string) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  setImageModel: (model: ImageModelConfig) => void;
  setImageSource: (source: "ai" | "stock") => void;
  setStockImageProvider: (provider: "unsplash") => void;
  setPresentationStyle: (style: string) => void;
  setModelProvider: (provider: "openai" | "lmstudio") => void;
  setModelId: (id: string) => void;
  setModelName: (name: string) => void;
  setSavingStatus: (status: "idle" | "saving" | "saved") => void;
  setIsPresenting: (isPresenting: boolean) => void;
  setCurrentSlideIndex: (index: number) => void;
  nextSlide: () => void;
  previousSlide: () => void;

  setIsThemeCreatorOpen: (update: boolean) => void;
  // Generation actions
  setShouldStartOutlineGeneration: (shouldStart: boolean) => void;
  setShouldStartPresentationGeneration: (shouldStart: boolean) => void;
  setIsGeneratingOutline: (isGenerating: boolean) => void;
  setIsGeneratingPresentation: (isGenerating: boolean) => void;
  startOutlineGeneration: () => void;
  startPresentationGeneration: () => void;
  resetGeneration: () => void;
  resetForNewGeneration: () => void;

  // Selection state
  isSelecting: boolean;
  selectedPresentations: string[];
  toggleSelecting: () => void;
  selectAllPresentations: (ids: string[]) => void;
  deselectAllPresentations: () => void;
  togglePresentationSelection: (id: string) => void;

  // Palette → Editor communication
  pendingInsertNode: TElement | null;
  setPendingInsertNode: (node: TElement | null) => void;
}

export const usePresentationState = create<PresentationState>((set) => ({
  currentPresentationId: null,
  currentPresentationTitle: null,
  isGridView: true,
  isSheetOpen: false,
  shouldShowExitHeader: false,
  setShouldShowExitHeader: (update) => set({ shouldShowExitHeader: update }),
  thumbnailUrl: undefined,
  setThumbnailUrl: (url) => set({ thumbnailUrl: url }),
  numSlides: 5,
  language: "en-US",
  showTemplates: false,
  selectedTemplate: "corporate", // Default template
  customThemePrompt: "", // Custom theme style
  presentationInput: "",
  outline: [],
  searchResults: [],
  webSearchEnabled: false,
  theme: "mystique",
  customThemeData: null,
  imageModel: { aspectRatio: "16:9", imageSize: "1K" },
  imageSource: "ai", // 默认使用 AI 生成
  stockImageProvider: "unsplash",
  presentationStyle: "professional",
  modelProvider: "openai",
  modelId: "",
  modelName: "", // Will use env.LLM_MODEL_NAME
  slides: [], // Now holds the new slide object structure
  outlineThinking: "",
  presentationThinking: "",
  rootImageGeneration: {},
  slideImageGeneration: {},
  savingStatus: "idle",
  isPresenting: false,
  currentSlideIndex: 0,
  isThemeCreatorOpen: false,
  config: {},
  pendingInsertNode: null,

  // Sidebar states
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (update) => set({ isSidebarCollapsed: update }),
  isRightPanelCollapsed: false,
  setIsRightPanelCollapsed: (update) => set({ isRightPanelCollapsed: update }),

  // Generation states
  shouldStartOutlineGeneration: false,
  shouldStartPresentationGeneration: false,
  isGeneratingOutline: false,
  isGeneratingPresentation: false,

  setSlides: (slides) => {
    set({ slides });
  },
  setPendingInsertNode: (node) => set({ pendingInsertNode: node }),
  setConfig: (config) => set({ config }),
  startRootImageGeneration: (slideId, query) =>
    set((state) => ({
      rootImageGeneration: {
        ...state.rootImageGeneration,
        [slideId]: { query, status: "pending" },
      },
    })),
  completeRootImageGeneration: (slideId, url) =>
    set((state) => ({
      rootImageGeneration: {
        ...state.rootImageGeneration,
        [slideId]: {
          ...(state.rootImageGeneration[slideId] ?? { query: "" }),
          status: "success",
          url,
        },
      },
    })),
  failRootImageGeneration: (slideId, error) =>
    set((state) => ({
      rootImageGeneration: {
        ...state.rootImageGeneration,
        [slideId]: {
          ...(state.rootImageGeneration[slideId] ?? { query: "" }),
          status: "error",
          error,
        },
      },
    })),
  clearRootImageGeneration: (slideId) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [slideId]: _removed, ...rest } = state.rootImageGeneration;
      return { rootImageGeneration: rest } as Partial<PresentationState>;
    }),

  // Slide image generation actions
  startSlideImageGeneration: (slideId) =>
    set((state) => ({
      slideImageGeneration: {
        ...state.slideImageGeneration,
        [slideId]: {
          status: "generating",
          conversationHistory: state.slideImageGeneration[slideId]?.conversationHistory || [],
        },
      },
    })),
  completeSlideImageGeneration: (slideId, imageUrl, conversationHistory) =>
    set((state) => ({
      slideImageGeneration: {
        ...state.slideImageGeneration,
        [slideId]: {
          status: "success",
          imageUrl,
          conversationHistory: conversationHistory as Array<{
            role: "user" | "assistant";
            parts: Array<{
              text?: string;
              inlineData?: { mimeType: string; data: string };
            }>;
          }>,
        },
      },
    })),
  failSlideImageGeneration: (slideId, error) =>
    set((state) => ({
      slideImageGeneration: {
        ...state.slideImageGeneration,
        [slideId]: {
          ...state.slideImageGeneration[slideId],
          status: "error",
          error,
        },
      },
    })),
  clearSlideImageGeneration: (slideId) =>
    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [slideId]: _removed, ...rest } = state.slideImageGeneration;
      return { slideImageGeneration: rest } as Partial<PresentationState>;
    }),
  setCurrentPresentation: (id, title) =>
    set({ currentPresentationId: id, currentPresentationTitle: title }),
  setIsGridView: (isGrid) => set({ isGridView: isGrid }),
  setIsSheetOpen: (isOpen) => set({ isSheetOpen: isOpen }),
  setNumSlides: (num) => set({ numSlides: num }),
  setLanguage: (lang) => set({ language: lang }),
  setTheme: (theme, customData = null) =>
    set({
      theme: theme,
      customThemeData: customData,
    }),
  setShowTemplates: (show) => set({ showTemplates: show }),
  setSelectedTemplate: (templateId) => set({ selectedTemplate: templateId }),
  setCustomThemePrompt: (prompt) => set({ customThemePrompt: prompt }),
  setPresentationInput: (input) => set({ presentationInput: input }),
  setOutline: (topics) => set({ outline: topics }),
  setSearchResults: (results) => set({ searchResults: results }),
  setOutlineThinking: (thinking) => set({ outlineThinking: thinking }),
  setPresentationThinking: (thinking) =>
    set({ presentationThinking: thinking }),
  setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
  setImageModel: (model) => set({ imageModel: model }),
  setImageSource: (source) => set({ imageSource: source }),
  setStockImageProvider: (provider) => set({ stockImageProvider: provider }),
  setPresentationStyle: (style) => set({ presentationStyle: style }),
  setModelProvider: (provider) => set({ modelProvider: provider }),
  setModelId: (id) => set({ modelId: id }),
  setModelName: (name) => set({ modelName: name }),
  setSavingStatus: (status) => set({ savingStatus: status }),
  setIsPresenting: (isPresenting) => set({ isPresenting }),
  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),
  nextSlide: () =>
    set((state) => ({
      currentSlideIndex: Math.min(
        state.currentSlideIndex + 1,
        state.slides.length - 1,
      ),
    })),
  previousSlide: () =>
    set((state) => ({
      currentSlideIndex: Math.max(state.currentSlideIndex - 1, 0),
    })),

  // Generation actions
  setShouldStartOutlineGeneration: (shouldStart) =>
    set({ shouldStartOutlineGeneration: shouldStart }),
  setShouldStartPresentationGeneration: (shouldStart) =>
    set({ shouldStartPresentationGeneration: shouldStart }),
  setIsGeneratingOutline: (isGenerating) =>
    set({ isGeneratingOutline: isGenerating }),
  setIsGeneratingPresentation: (isGenerating) =>
    set({ isGeneratingPresentation: isGenerating }),
  startOutlineGeneration: () =>
    set({
      shouldStartOutlineGeneration: true,
      isGeneratingOutline: true,
      shouldStartPresentationGeneration: false,
      isGeneratingPresentation: false,
      outline: [],
    }),
  startPresentationGeneration: () =>
    set({
      shouldStartPresentationGeneration: true,
      isGeneratingPresentation: true,
    }),
  resetGeneration: () =>
    set({
      shouldStartOutlineGeneration: false,
      shouldStartPresentationGeneration: false,
      isGeneratingOutline: false,
      isGeneratingPresentation: false,
      searchResults: [],
    }),

  // Reset everything except ID and current input when starting new outline generation
  resetForNewGeneration: () =>
    set(() => ({
      thumbnailUrl: undefined,
      outline: [],
      searchResults: [],
      slides: [],
      outlineThinking: "",
      presentationThinking: "",
      rootImageGeneration: {},
      config: {},
    })),

  setIsThemeCreatorOpen: (update) => set({ isThemeCreatorOpen: update }),
  // Selection state
  isSelecting: false,
  selectedPresentations: [],
  toggleSelecting: () =>
    set((state) => ({
      isSelecting: !state.isSelecting,
      selectedPresentations: [],
    })),
  selectAllPresentations: (ids) => set({ selectedPresentations: ids }),
  deselectAllPresentations: () => set({ selectedPresentations: [] }),
  togglePresentationSelection: (id) =>
    set((state) => ({
      selectedPresentations: state.selectedPresentations.includes(id)
        ? state.selectedPresentations.filter((p) => p !== id)
        : [...state.selectedPresentations, id],
    })),
}));
