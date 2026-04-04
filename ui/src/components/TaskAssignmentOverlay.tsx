import { Swords, X, ArrowRight, User, Briefcase } from "lucide-react";
import { AGENT_ROLE_LABELS } from "@titanclip/shared";
import type { AgentRole } from "@titanclip/shared";
import { cn } from "../lib/utils";

interface TaskAssignmentOverlayProps {
  agent: { id: string; name: string; role: string; status: string; title?: string | null };
  issues: { id: string; identifier: string | null; title: string; status: string; priority?: string | null }[];
  onAssign: (issueId: string) => void;
  onClose: () => void;
  isPending: boolean;
}

export function TaskAssignmentOverlay({ agent, issues, onAssign, onClose, isPending }: TaskAssignmentOverlayProps) {
  const unassignedIssues = issues.filter((i) => i.status === "backlog" || i.status === "todo");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* RPG-style dialog */}
      <div className="relative w-[420px] max-h-[500px] flex flex-col bg-[#0f172a] border-2 border-[#fbbf24] rounded-lg shadow-2xl overflow-hidden"
        style={{
          boxShadow: "0 0 30px rgba(251, 191, 36, 0.2), inset 0 0 30px rgba(0,0,0,0.3)",
          imageRendering: "pixelated",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-[#334155]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#fbbf24]/20 flex items-center justify-center">
              <User className="h-4 w-4 text-[#fbbf24]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#f8fafc] font-mono">{agent.name}</div>
              <div className="text-[10px] text-[#94a3b8] font-mono">
                {AGENT_ROLE_LABELS[agent.role as AgentRole] ?? agent.role}
                {agent.title ? ` - ${agent.title}` : ""}
                <span className={cn(
                  "ml-2 px-1.5 py-0.5 rounded text-[9px]",
                  agent.status === "idle" || agent.status === "active" ? "bg-emerald-900/50 text-emerald-400" :
                  agent.status === "running" ? "bg-blue-900/50 text-blue-400" :
                  agent.status === "paused" ? "bg-yellow-900/50 text-yellow-400" :
                  "bg-red-900/50 text-red-400"
                )}>
                  {agent.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-[#e2e8f0] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quest list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="px-2 py-1.5 text-[10px] font-mono text-[#fbbf24] uppercase tracking-wider flex items-center gap-1.5">
            <Swords className="h-3 w-3" />
            Available Quests ({unassignedIssues.length})
          </div>

          {unassignedIssues.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[#64748b] font-mono">
              No quests available. Create an issue first.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {unassignedIssues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => onAssign(issue.id)}
                  disabled={isPending}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded text-left transition-all font-mono",
                    "bg-[#1e293b] hover:bg-[#334155] hover:border-[#fbbf24]/50 border border-[#1e293b]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "group",
                  )}
                >
                  <Briefcase className="h-3.5 w-3.5 text-[#64748b] group-hover:text-[#fbbf24] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#e2e8f0] truncate">{issue.title}</div>
                    <div className="text-[9px] text-[#64748b]">{issue.identifier}</div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-[#334155] group-hover:text-[#fbbf24] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0f172a] border-t border-[#1e293b] text-[9px] text-[#475569] font-mono text-center">
          Click a quest to assign it to {agent.name}
        </div>
      </div>
    </div>
  );
}
