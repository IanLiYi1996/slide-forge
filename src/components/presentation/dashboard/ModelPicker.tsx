"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSelectedModel,
  setSelectedModel,
  useLocalModels,
} from "@/hooks/presentation/useLocalModels";
import { usePresentationState } from "@/states/presentation-state";
import { Loader2, Monitor } from "lucide-react";
import { useEffect, useRef } from "react";

export function ModelPicker({
  shouldShowLabel = true,
}: {
  shouldShowLabel?: boolean;
}) {
  const {
    modelProvider,
    setModelProvider,
    modelId,
    setModelId,
    modelName,
    setModelName,
  } = usePresentationState();

  const { data: modelsData, isLoading, isInitialLoad } = useLocalModels();
  const hasRestoredFromStorage = useRef(false);

  // Load saved model selection from localStorage on mount
  useEffect(() => {
    if (!hasRestoredFromStorage.current) {
      const savedModel = getSelectedModel();
      if (savedModel) {
        console.log("Restoring model from localStorage:", savedModel);
        setModelProvider(savedModel.modelProvider as "openai" | "lmstudio");
        setModelId(savedModel.modelId);
      }
      hasRestoredFromStorage.current = true;
    }
  }, [setModelProvider, setModelId]);

  const { localModels = [], hasLocalModels = false } = modelsData || {};

  // Filter LM Studio models
  const lmStudioModels = localModels.filter(
    (model) => model.provider === "lmstudio",
  );

  // Handle quick select from dropdown (for LM Studio models)
  const handleQuickSelect = (value: string) => {
    if (value.startsWith("lmstudio-")) {
      const model = value.replace("lmstudio-", "");
      setModelProvider("lmstudio");
      setModelId(model);
      setSelectedModel("lmstudio", model);
      console.log("Selected LM Studio model:", model);
    }
  };

  // Determine if currently using a local model
  const isUsingLocalModel = modelProvider === "lmstudio";

  return (
    <div>
      {shouldShowLabel && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Model Name
        </label>
      )}

      {/* Model Name Input or Quick Select */}
      {hasLocalModels && !isUsingLocalModel ? (
        // Show dropdown for quick select when local models available
        <Select
          value={isUsingLocalModel ? `lmstudio-${modelId}` : "custom"}
          onValueChange={(value) => {
            if (value === "custom") {
              setModelProvider("openai");
              setModelId("");
              setSelectedModel("openai", "");
            } else if (value.startsWith("lmstudio-")) {
              handleQuickSelect(value);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {isUsingLocalModel ? `lmstudio: ${modelId}` : modelName || "Enter model name..."}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Custom Model</SelectLabel>
              <SelectItem value="custom">
                <div className="flex items-center gap-2">
                  <Input
                    value={modelName}
                    onChange={(e) => {
                      e.stopPropagation();
                      setModelName(e.target.value);
                      setModelProvider("openai");
                      setModelId("");
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter model name"
                    className="h-6 text-xs"
                  />
                </div>
              </SelectItem>
            </SelectGroup>

            {/* Loading indicator */}
            {isLoading && !isInitialLoad && (
              <SelectGroup>
                <SelectLabel>Loading</SelectLabel>
                <SelectItem value="loading" disabled>
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                    <span className="text-sm">Refreshing...</span>
                  </div>
                </SelectItem>
              </SelectGroup>
            )}

            {/* LM Studio Models */}
            {lmStudioModels.length > 0 && (
              <SelectGroup>
                <SelectLabel>Local Models</SelectLabel>
                {lmStudioModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">{model.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      ) : (
        // Simple input when no local models
        <Input
          value={isUsingLocalModel ? `lmstudio: ${modelId}` : modelName}
          onChange={(e) => {
            if (isUsingLocalModel) {
              setModelProvider("openai");
              setModelId("");
              setSelectedModel("openai", "");
            }
            setModelName(e.target.value);
          }}
          placeholder="e.g., mimo-v2-flash, gpt-4o"
          disabled={isUsingLocalModel}
        />
      )}
    </div>
  );
}
