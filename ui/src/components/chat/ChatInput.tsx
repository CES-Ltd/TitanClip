/**
 * ChatInput — modern input bar with #/@ trigger detection and typeahead.
 *
 * Triggers:
 * - `/` at position 0 → slash command menu
 * - `#` → issue mention typeahead
 * - `@` → agent mention typeahead
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Send, StopCircle, FolderOpen, ChevronDown,
  CircleDot, Bot, Hash,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { issuesApi } from "../../api/issues";
import { agentsApi } from "../../api/agents";
import { projectsApi } from "../../api/projects";

// ── Slash Commands ────────────────────────────────────────────────────
const SLASH_COMMANDS = [
  { name: "/help", description: "Show available commands" },
  { name: "/status ", description: "Team status summary or ask a question" },
  { name: "/create-issue ", description: "Create an issue from description" },
  { name: "/agents", description: "List all agents" },
  { name: "/review ", description: "Review recent activity and progress" },
  { name: "/plan ", description: "Break down a task into actionable steps" },
];

// ── Issue Status Colors ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-400",
  in_progress: "text-amber-400",
  in_review: "text-purple-400",
  done: "text-emerald-400",
  blocked: "text-red-400",
  cancelled: "text-muted-foreground/50",
};

interface Mention {
  type: "issue" | "agent";
  id: string;
  display: string;
}

interface ChatInputProps {
  companyId: string;
  disabled?: boolean;
  isStreaming: boolean;
  onSend: (message: string, mentions: { issues: string[]; agents: string[] }) => void;
  onStop: () => void;
  selectedProjectId: string | null;
  onProjectChange: (id: string | null) => void;
}

type DropdownMode = "none" | "slash" | "issue" | "agent" | "project";

export function ChatInput({
  companyId,
  disabled,
  isStreaming,
  onSend,
  onStop,
  selectedProjectId,
  onProjectChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Data queries ────────────────────────────────────────────────────
  const { data: issueResults = [] } = useQuery({
    queryKey: ["issues-search", companyId, searchQuery],
    queryFn: () => issuesApi.list(companyId, { q: searchQuery, limit: 8 } as any),
    enabled: dropdownMode === "issue" && searchQuery.length > 0,
  });

  const { data: agentsList = [] } = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", companyId],
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);

  // ── Filtered data for dropdowns ──────────────────────────────────
  const filteredAgents = agentsList.filter((a: any) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.role.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  const filteredSlashCmds = SLASH_COMMANDS.filter((c) =>
    c.name.startsWith(input.toLowerCase())
  );

  // ── Determine dropdown items ────────────────────────────────────
  const dropdownItems: { id: string; label: string; sub: string; icon?: React.ReactNode }[] = (() => {
    if (dropdownMode === "slash") {
      return filteredSlashCmds.map((c) => ({
        id: c.name,
        label: c.name.trim(),
        sub: c.description,
      }));
    }
    if (dropdownMode === "issue") {
      return issueResults.map((i: any) => ({
        id: i.identifier ?? i.id,
        label: i.identifier ?? i.id.slice(0, 8),
        sub: i.title,
        icon: <CircleDot className={cn("h-3 w-3", STATUS_COLORS[i.status] ?? "text-muted-foreground")} />,
      }));
    }
    if (dropdownMode === "agent") {
      return filteredAgents.map((a: any) => ({
        id: a.id,
        label: a.name,
        sub: a.role,
        icon: <Bot className="h-3 w-3 text-indigo-400" />,
      }));
    }
    return [];
  })();

  // ── Input change handler ───────────────────────────────────────
  const handleChange = useCallback((value: string) => {
    setInput(value);
    setSelectedIdx(0);

    // Detect triggers
    if (value.startsWith("/") && !value.includes(" ")) {
      setDropdownMode("slash");
      setSearchQuery("");
      return;
    }

    // Find the last trigger character
    const lastHash = value.lastIndexOf("#");
    const lastAt = value.lastIndexOf("@");

    if (lastHash >= 0 && lastHash >= lastAt) {
      const query = value.slice(lastHash + 1);
      if (!query.includes(" ") || query.length < 20) {
        setDropdownMode("issue");
        setSearchQuery(query);
        return;
      }
    }

    if (lastAt >= 0 && lastAt > lastHash) {
      const query = value.slice(lastAt + 1);
      if (!query.includes(" ") || query.length < 20) {
        setDropdownMode("agent");
        setSearchQuery(query);
        return;
      }
    }

    setDropdownMode("none");
  }, []);

  // ── Select item from dropdown ──────────────────────────────────
  const selectItem = useCallback((item: typeof dropdownItems[0]) => {
    if (!item) return;

    if (dropdownMode === "slash") {
      setInput(item.id);
      setDropdownMode("none");
      inputRef.current?.focus();
      return;
    }

    if (dropdownMode === "issue") {
      const lastHash = input.lastIndexOf("#");
      const before = input.slice(0, lastHash);
      setInput(`${before}#${item.id} `);
      setMentions((prev) => [...prev, { type: "issue", id: item.id, display: `#${item.id}` }]);
      setDropdownMode("none");
      inputRef.current?.focus();
      return;
    }

    if (dropdownMode === "agent") {
      const lastAt = input.lastIndexOf("@");
      const before = input.slice(0, lastAt);
      setInput(`${before}@${item.label} `);
      setMentions((prev) => [...prev, { type: "agent", id: item.id, display: `@${item.label}` }]);
      setDropdownMode("none");
      inputRef.current?.focus();
      return;
    }
  }, [dropdownMode, input]);

  // ── Send handler ────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const issueMentions = mentions.filter((m) => m.type === "issue").map((m) => m.id);
    const agentMentions = mentions.filter((m) => m.type === "agent").map((m) => m.id);
    onSend(text, { issues: issueMentions, agents: agentMentions });
    setInput("");
    setMentions([]);
    setDropdownMode("none");
  }, [input, mentions, onSend]);

  // ── Keyboard navigation ────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (dropdownMode !== "none" && dropdownItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, dropdownItems.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectItem(dropdownItems[selectedIdx]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDropdownMode("none");
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey && dropdownMode === "none") {
      e.preventDefault();
      handleSend();
    }
  }, [dropdownMode, dropdownItems, selectedIdx, selectItem, handleSend]);

  // ── Auto-resize textarea ───────────────────────────────────────
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  return (
    <div className="border-t border-border/50 p-3 relative">
      {/* Typeahead dropdown */}
      {dropdownMode !== "none" && dropdownMode !== "project" && dropdownItems.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-border bg-popover shadow-xl overflow-hidden max-h-64 overflow-y-auto backdrop-blur-sm">
          {dropdownItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => selectItem(item)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors",
                idx === selectedIdx ? "bg-accent/60" : "hover:bg-accent/30"
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="font-medium text-foreground/90">{item.label}</span>
              <span className="text-muted-foreground text-xs truncate">{item.sub}</span>
            </button>
          ))}
        </div>
      )}

      {/* Project picker dropdown */}
      {dropdownMode === "project" && projects.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 rounded-xl border border-border bg-popover shadow-xl overflow-hidden w-56 backdrop-blur-sm">
          <button
            onClick={() => { onProjectChange(null); setDropdownMode("none"); }}
            className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/30", !selectedProjectId && "bg-accent/40")}
          >
            <span className="text-muted-foreground">No project</span>
          </button>
          {projects.map((p: any) => (
            <button
              key={p.id}
              onClick={() => { onProjectChange(p.id); setDropdownMode("none"); }}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-accent/30 flex items-center gap-2", p.id === selectedProjectId && "bg-accent/40")}
            >
              {p.color && <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mention pills */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {mentions.map((m, i) => (
            <span key={i} className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              m.type === "issue" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            )}>
              {m.type === "issue" ? <Hash className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
              {m.display}
              <button onClick={() => setMentions((prev) => prev.filter((_, j) => j !== i))} className="ml-0.5 hover:text-foreground">&times;</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Project picker pill */}
        <button
          onClick={() => setDropdownMode(dropdownMode === "project" ? "none" : "project")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs shrink-0 transition-all",
            selectedProject
              ? "border-indigo-500/20 bg-indigo-500/5 text-foreground"
              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          {selectedProject?.color ? (
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: selectedProject.color }} />
          ) : (
            <FolderOpen className="h-3 w-3" />
          )}
          <span className="max-w-[80px] truncate">{selectedProject?.name ?? "Project"}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-40" />
        </button>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input.startsWith("/") && !input.includes(" ")) setDropdownMode("slash");
          }}
          placeholder={disabled ? "No agent available" : "Message, /command, #issue, or @agent..."}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-border/50 bg-background px-4 py-2 text-sm outline-none transition-colors",
            "focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20",
            "placeholder:text-muted-foreground/50"
          )}
          disabled={disabled || isStreaming}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button onClick={onStop} className="p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0">
            <StopCircle className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
