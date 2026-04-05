import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Plus, X, ArrowRight, ArrowLeft, Link2 } from "lucide-react";
import { dependencyApi } from "../api/dependencies";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Link } from "@/lib/router";
import type { IssueDependency } from "@titanclip/shared";

const DEP_ICONS: Record<string, typeof ArrowRight> = {
  blocks: ArrowRight,
  depends_on: ArrowLeft,
  relates_to: Link2,
};

const DEP_LABELS: Record<string, string> = {
  blocks: "blocks",
  depends_on: "depends on",
  relates_to: "related to",
};

const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-400",
  in_progress: "bg-amber-400",
  blocked: "bg-red-400",
  backlog: "bg-zinc-400",
  todo: "bg-blue-400",
};

export function IssueDependencies({ issueId }: { issueId: string }) {
  const { selectedCompanyId: cid } = useCompany();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [depType, setDepType] = useState<string>("blocks");

  const { data: deps = [] } = useQuery({
    queryKey: queryKeys.dependencies.forIssue(cid!, issueId),
    queryFn: () => dependencyApi.listForIssue(cid!, issueId),
    enabled: !!cid,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["issues", cid, "dep-search", searchQuery],
    queryFn: () => issuesApi.list(cid!, { q: searchQuery }),
    enabled: !!cid && searchQuery.length >= 2,
  });

  const addMut = useMutation({
    mutationFn: (targetId: string) => {
      if (depType === "depends_on") {
        return dependencyApi.add(cid!, targetId, issueId, "blocks");
      }
      return dependencyApi.add(cid!, issueId, targetId, depType);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dependencies.forIssue(cid!, issueId) });
      setShowAdd(false);
      setSearchQuery("");
    },
  });

  const removeMut = useMutation({
    mutationFn: (depId: string) => dependencyApi.remove(cid!, depId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dependencies.forIssue(cid!, issueId) }),
  });

  // Categorize deps
  const blocking = deps.filter(d => d.sourceIssueId === issueId && d.dependencyType === "blocks");
  const blockedBy = deps.filter(d => d.targetIssueId === issueId && d.dependencyType === "blocks");
  const related = deps.filter(d => d.dependencyType === "relates_to");

  if (deps.length === 0 && !showAdd) {
    return (
      <div className="mt-4">
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <GitBranch className="h-3.5 w-3.5" /> Add dependency
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" /> Dependencies ({deps.length})
        </h4>
        <button onClick={() => setShowAdd(!showAdd)} className="text-muted-foreground hover:text-foreground">
          {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex gap-2">
            <select value={depType} onChange={e => setDepType(e.target.value)}
              className="px-2 py-1 text-xs bg-background border border-border rounded-lg">
              <option value="blocks">This blocks...</option>
              <option value="depends_on">This depends on...</option>
              <option value="relates_to">Related to...</option>
            </select>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search issues..."
              className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {searchResults.filter((r: any) => r.id !== issueId).slice(0, 8).map((issue: any) => (
                <button key={issue.id} onClick={() => addMut.mutate(issue.id)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/30 flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{issue.identifier}</span>
                  <span className="truncate">{issue.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocked by */}
      {blockedBy.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-red-400 font-medium">Blocked by</span>
          {blockedBy.map(d => (
            <DepRow key={d.id} dep={d} issueId={issueId} dir="blocked_by" onRemove={() => removeMut.mutate(d.id)} />
          ))}
        </div>
      )}

      {/* Blocks */}
      {blocking.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-amber-400 font-medium">Blocks</span>
          {blocking.map(d => (
            <DepRow key={d.id} dep={d} issueId={issueId} dir="blocks" onRemove={() => removeMut.mutate(d.id)} />
          ))}
        </div>
      )}

      {/* Related */}
      {related.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-blue-400 font-medium">Related</span>
          {related.map(d => (
            <DepRow key={d.id} dep={d} issueId={issueId} dir="related" onRemove={() => removeMut.mutate(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DepRow({ dep, issueId, dir, onRemove }: {
  dep: IssueDependency; issueId: string; dir: string; onRemove: () => void;
}) {
  const isSource = dep.sourceIssueId === issueId;
  const otherId = isSource ? dep.targetIssueId : dep.sourceIssueId;
  const otherTitle = isSource ? dep.targetIssueTitle : dep.sourceIssueTitle;
  const otherIdentifier = isSource ? dep.targetIssueIdentifier : dep.sourceIssueIdentifier;
  const otherStatus = isSource ? dep.targetIssueStatus : dep.sourceIssueStatus;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/50 hover:border-border transition-colors group">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[otherStatus ?? ""] ?? "bg-zinc-400")} />
      <Link to={`/issues/${otherId}`} className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-muted-foreground">{otherIdentifier}</span>
        <span className="text-xs truncate">{otherTitle}</span>
      </Link>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
