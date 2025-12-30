"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAgentState } from "@/states/agent-state";
import { Globe } from "lucide-react";

export function AgentWebSearchToggle() {
  const { enableWebSearch, setEnableWebSearch, isGenerating } = useAgentState();

  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs border border-border/50">
      <div className="flex items-center gap-1.5">
        <Globe
          className={`h-3.5 w-3.5 transition-colors ${
            enableWebSearch ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <Label
          htmlFor="agent-web-search-toggle"
          className="text-xs font-medium cursor-pointer select-none"
        >
          Web Search
        </Label>
      </div>
      <Switch
        id="agent-web-search-toggle"
        checked={enableWebSearch}
        onCheckedChange={setEnableWebSearch}
        disabled={isGenerating}
        className="scale-75"
      />
    </div>
  );
}
