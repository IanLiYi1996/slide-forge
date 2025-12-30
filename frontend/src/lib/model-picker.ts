import { createOpenAI } from "@ai-sdk/openai";
import { type LanguageModelV1 } from "ai";
import { env } from "@/env";

/**
 * Centralized model picker function for all presentation generation routes
 * Supports OpenAI Compatible APIs (OpenAI, LM Studio, or any OpenAI-compatible service)
 *
 * Configuration:
 * - LLM_API_KEY: Required API key (for OpenAI or compatible service)
 * - LLM_BASE_URL: Optional base URL (defaults to OpenAI if not set)
 * - LLM_MODEL_NAME: Optional model name (defaults to gpt-4o-mini)
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

  // Unified OpenAI Compatible API
  // If LLM_BASE_URL is set, use custom endpoint; otherwise default to OpenAI
  const llmClient = createOpenAI({
    name: env.LLM_BASE_URL ? "custom-llm" : "openai",
    ...(env.LLM_BASE_URL && { baseURL: env.LLM_BASE_URL }),
    apiKey: env.LLM_API_KEY,
  });

  // Priority: user-specified modelName > env modelName > default
  const finalModelName = modelName || env.LLM_MODEL_NAME || "gpt-4o-mini";
  return llmClient(finalModelName) as unknown as LanguageModelV1;
}
