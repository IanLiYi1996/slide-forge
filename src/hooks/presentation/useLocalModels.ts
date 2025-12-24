import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

interface ModelInfo {
  id: string;
  name: string;
  provider: "lmstudio";
}

interface LMStudioResponse {
  data?: Array<{ id: string }>;
}

// Fetch models from LM Studio
async function fetchLMStudioModels(): Promise<ModelInfo[]> {
  try {
    const response = await fetch("http://localhost:1234/v1/models");

    const data = (await response.json()) as LMStudioResponse;

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }
    console.log("lmstudio models", data);

    return data.data.map((model) => ({
      id: `lmstudio-${model.id}`,
      name: model.id,
      provider: "lmstudio" as const,
    }));
  } catch (error) {
    console.log("LM Studio not available:", error);
    return [];
  }
}

// Fetch all local models (only LM Studio now)
async function fetchLocalModels(): Promise<ModelInfo[]> {
  return await fetchLMStudioModels();
}

// localStorage keys
const MODELS_CACHE_KEY = "presentation-models-cache";
const SELECTED_MODEL_KEY = "presentation-selected-model";
const CACHE_EXPIRY_KEY = "presentation-models-cache-expiry";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// localStorage utilities
function getCachedModels(): ModelInfo[] | null {
  try {
    const cached = localStorage.getItem(MODELS_CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);

    if (cached && expiry && Date.now() < parseInt(expiry)) {
      return JSON.parse(cached);
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedModels(models: ModelInfo[]): void {
  try {
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(models));
    localStorage.setItem(
      CACHE_EXPIRY_KEY,
      (Date.now() + CACHE_DURATION).toString(),
    );
  } catch {
    // Ignore localStorage errors
  }
}

export function getSelectedModel(): {
  modelProvider: string;
  modelId: string;
} | null {
  try {
    const selected = localStorage.getItem(SELECTED_MODEL_KEY);
    console.log("Getting selected model from localStorage:", selected);
    return selected ? JSON.parse(selected) : null;
  } catch (error) {
    console.error("Error getting selected model from localStorage:", error);
    return null;
  }
}

export function setSelectedModel(modelProvider: string, modelId: string): void {
  try {
    const data = { modelProvider, modelId };
    localStorage.setItem(SELECTED_MODEL_KEY, JSON.stringify(data));
    console.log("Saved model to localStorage:", data);
  } catch (error) {
    console.error("Error saving model to localStorage:", error);
  }
}

export function useLocalModels() {
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Get cached models for initial load
  const cachedModels = getCachedModels();

  const query = useQuery({
    queryKey: ["local-models"],
    queryFn: async () => {
      const freshModels = await fetchLocalModels();
      setCachedModels(freshModels);
      return freshModels;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 1000,
    initialData: cachedModels || undefined,
    select: (data) => {
      return {
        localModels: data,
        hasLocalModels: data.length > 0,
      };
    },
  });

  // Mark initial load as complete after first render
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  return {
    ...query,
    isInitialLoad,
  };
}
