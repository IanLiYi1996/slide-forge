import { createOpenAI } from "@ai-sdk/openai";
import { type LanguageModelV1 } from "ai";
import { env } from "@/env";

/**
 * Centralized model picker function for all presentation generation routes
 * Supports OpenAI Compatible APIs (OpenAI, LM Studio, or any OpenAI-compatible service)
 */
export function modelPicker(
  modelProvider: string,
  modelId?: string,
  modelName?: string, // Accept user-specified model name
): LanguageModelV1 {
  // LM Studio: Use local LM Studio with OpenAI compatible provider
  if (modelProvider === "lmstudio" && modelId) {
    const lmstudio = createOpenAI({
      name: "lmstudio",
      baseURL: "http://localhost:1234/v1",
      apiKey: "lmstudio",
    });
    return lmstudio(modelId) as unknown as LanguageModelV1;
  }

  // Custom OpenAI Compatible API: Use custom base URL if configured
  if (env.LLM_BASE_URL && env.LLM_API_KEY) {
    const customLLM = createOpenAI({
      name: "custom-llm",
      baseURL: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
    });
    // Priority: user-specified modelName > env modelName > default
    const finalModelName = modelName || env.LLM_MODEL_NAME || "gpt-4o-mini";
    return customLLM(finalModelName) as unknown as LanguageModelV1;
  }

  // Default to OpenAI
  const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
  // Priority: user-specified modelName > env modelName > default
  const finalModelName = modelName || env.LLM_MODEL_NAME || "gpt-4o-mini";
  return openai(finalModelName) as unknown as LanguageModelV1;
}
