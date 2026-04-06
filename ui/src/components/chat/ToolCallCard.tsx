/**
 * ToolCallCard — CopilotKit-inspired tool execution card.
 * Shows running/completed/error states with collapsible input/result.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToolCall } from "../../hooks/useChatStream";

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    running: <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />,
    completed: <Check className="h-3 w-3 text-emerald-400" />,
    error: <X className="h-3 w-3 text-red-400" />,
  }[tool.status];

  const borderClass = {
    running: "border-indigo-500/30 bg-indigo-500/5",
    completed: "border-border/50 bg-muted/20",
    error: "border-red-500/20 bg-red-500/5",
  }[tool.status];

  return (
    <div className={cn("rounded-xl border text-xs overflow-hidden transition-colors", borderClass)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/20 transition-colors"
      >
        <span className="shrink-0">{statusIcon}</span>
        <span className="font-mono font-medium text-foreground/80">{tool.name}</span>
        <span className="ml-auto text-muted-foreground/60">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-border/30 space-y-2">
          {tool.args && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Input</span>
              <pre className="mt-0.5 text-[11px] text-foreground/70 font-mono whitespace-pre-wrap break-all bg-background/50 rounded-lg p-2">
                {tool.args.slice(0, 500)}
              </pre>
            </div>
          )}
          {tool.result && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Result</span>
              <pre className={cn(
                "mt-0.5 text-[11px] font-mono whitespace-pre-wrap break-all rounded-lg p-2",
                tool.isError ? "text-red-400 bg-red-500/5" : "text-foreground/70 bg-background/50"
              )}>
                {tool.result.slice(0, 800)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallGroup({ tools }: { tools: ToolCall[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {tools.map((tc) => (
        <ToolCallCard key={tc.id} tool={tc} />
      ))}
    </div>
  );
}
