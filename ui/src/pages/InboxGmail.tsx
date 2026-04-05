/**
 * Gmail-style Inbox — 2-pane layout with tabs, search, and detail preview.
 * Replaces the original flat-list inbox with a clean, minimalist design.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@/lib/router";
import {
  Inbox as InboxIcon, Shield, Zap, LayoutList,
  Search, X, Mail, MailOpen, Archive, ExternalLink,
  CheckCircle, XCircle, Clock,
} from "lucide-react";
import type { Approval, HeartbeatRun, Issue } from "@titanclip/shared";
import { INBOX_MINE_ISSUE_STATUS_FILTER } from "@titanclip/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { issuesApi } from "../api/issues";
import { approvalsApi } from "../api/approvals";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "../context/ToastContext";
import {
  ACTIONABLE_APPROVAL_STATUSES,
  FAILED_RUN_STATUSES,
  loadDismissedInboxItems,
  saveDismissedInboxItems,
} from "../lib/inbox";

type TabId = "primary" | "approvals" | "runs" | "all";
type SelectedItem =
  | { kind: "issue"; id: string }
  | { kind: "approval"; id: string }
  | { kind: "run"; id: string }
  | null;

function timeAgoShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const PRIORITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-400",
  medium: "border-l-blue-400",
  low: "border-l-zinc-500",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
  in_review: "In Review", done: "Done", blocked: "Blocked", cancelled: "Cancelled",
};

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "Business Unit Head Strategy",
};

export function InboxGmail() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const cid = selectedCompanyId!;

  const [activeTab, setActiveTab] = useState<TabId>("primary");
  const [selected, setSelected] = useState<SelectedItem>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dismissed] = useState(() => loadDismissedInboxItems());

  useEffect(() => { setBreadcrumbs([{ label: "Inbox" }]); }, [setBreadcrumbs]);

  // Data queries
  const { data: myIssues = [], isLoading: loadingIssues } = useQuery({
    queryKey: queryKeys.issues.listTouchedByMe(cid),
    queryFn: () => issuesApi.list(cid, { touchedByUserId: "me", status: INBOX_MINE_ISSUE_STATUS_FILTER }),
    enabled: !!cid,
    refetchInterval: 15_000,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(cid),
    queryFn: () => agentsApi.list(cid),
    enabled: !!cid,
  });

  const { data: approvals = [] } = useQuery({
    queryKey: queryKeys.approvals.list(cid),
    queryFn: () => approvalsApi.list(cid),
    enabled: !!cid,
    refetchInterval: 15_000,
  });

  const { data: runs = [] } = useQuery({
    queryKey: queryKeys.heartbeats(cid),
    queryFn: () => heartbeatsApi.list(cid),
    enabled: !!cid,
  });

  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const agentName = (id: string | null) => id ? (agentMap.get(id)?.name ?? "Agent") : "";

  // Filtered data per tab
  const actionableApprovals = useMemo(
    () => approvals.filter((a) => ACTIONABLE_APPROVAL_STATUSES.has(a.status) && !dismissed.has(`approval:${a.id}`)),
    [approvals, dismissed],
  );
  const failedRuns = useMemo(
    () => {
      const latestPerAgent = new Map<string, HeartbeatRun>();
      for (const r of runs) {
        if (!FAILED_RUN_STATUSES.has(r.status)) continue;
        if (dismissed.has(`run:${r.id}`)) continue;
        const existing = latestPerAgent.get(r.agentId);
        if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
          latestPerAgent.set(r.agentId, r);
        }
      }
      return [...latestPerAgent.values()];
    },
    [runs, dismissed],
  );

  // Search filter
  const filteredIssues = useMemo(
    () => searchQuery
      ? myIssues.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : myIssues,
    [myIssues, searchQuery],
  );

  // Badge counts
  const unreadCount = myIssues.filter((i) => i.isUnreadForMe).length;
  const approvalCount = actionableApprovals.length;
  const runCount = failedRuns.length;

  // Mutations
  const markReadMut = useMutation({
    mutationFn: (id: string) => issuesApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.listTouchedByMe(cid) }),
  });
  const archiveMut = useMutation({
    mutationFn: (id: string) => issuesApi.archiveFromInbox(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listTouchedByMe(cid) });
      pushToast({ title: "Archived", tone: "success", ttlMs: 2000 });
      setSelected(null);
    },
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => approvalsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(cid) });
      pushToast({ title: "Approved", tone: "success", ttlMs: 3000 });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => approvalsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(cid) });
      pushToast({ title: "Rejected", tone: "warn", ttlMs: 3000 });
    },
  });

  const handleSelectIssue = useCallback((issue: Issue) => {
    setSelected({ kind: "issue", id: issue.id });
    if (issue.isUnreadForMe) markReadMut.mutate(issue.id);
  }, [markReadMut]);

  // Selected item data
  const selectedIssue = selected?.kind === "issue" ? myIssues.find((i) => i.id === selected.id) : null;
  const selectedApproval = selected?.kind === "approval" ? approvals.find((a) => a.id === selected.id) : null;
  const selectedRun = selected?.kind === "run" ? failedRuns.find((r) => r.id === selected.id) : null;

  // Fetch comments for selected issue
  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.issues.comments(selected?.kind === "issue" ? selected.id : ""),
    queryFn: () => issuesApi.listComments(selected!.id),
    enabled: selected?.kind === "issue",
  });

  if (!selectedCompanyId) return <div className="p-8 text-sm text-muted-foreground">Select a team first.</div>;

  const tabs: { id: TabId; label: string; icon: typeof InboxIcon; count: number }[] = [
    { id: "primary", label: "Primary", icon: InboxIcon, count: unreadCount },
    { id: "approvals", label: "Approvals", icon: Shield, count: approvalCount },
    { id: "runs", label: "Runs", icon: Zap, count: runCount },
    { id: "all", label: "All", icon: LayoutList, count: unreadCount + approvalCount + runCount },
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-background">
      {/* Left Pane: Tabs + List */}
      <div className="w-[400px] border-r border-border flex flex-col shrink-0">
        {/* Tab Bar */}
        <div className="flex items-center border-b border-border px-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelected(null); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] rounded-full font-medium",
                    isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}>{tab.count}</span>
                )}
                {isActive && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inbox..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-muted/30 rounded-xl border-none focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto">
          {/* Primary tab: Issues */}
          {(activeTab === "primary" || activeTab === "all") && filteredIssues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => handleSelectIssue(issue)}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border/30 transition-colors border-l-[3px]",
                selected?.kind === "issue" && selected.id === issue.id
                  ? "bg-primary/5 border-l-primary"
                  : "hover:bg-muted/30 border-l-transparent",
                PRIORITY_BORDER[issue.priority ?? ""] && !(selected?.kind === "issue" && selected.id === issue.id)
                  ? PRIORITY_BORDER[issue.priority ?? ""]
                  : "",
              )}
            >
              <div className="flex items-center gap-2">
                {issue.isUnreadForMe ? (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                ) : (
                  <div className="w-2 h-2 shrink-0" />
                )}
                <span className="text-[11px] font-mono text-muted-foreground">{issue.identifier ?? ""}</span>
                <span className={cn("text-sm truncate flex-1", issue.isUnreadForMe && "font-semibold")}>{issue.title}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgoShort(issue.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-4">
                <span className="text-[11px] text-muted-foreground truncate">
                  {agentName(issue.assigneeAgentId)} · {STATUS_LABELS[issue.status] ?? issue.status}
                </span>
              </div>
            </button>
          ))}

          {/* Approvals tab */}
          {(activeTab === "approvals" || activeTab === "all") && actionableApprovals.map((a) => (
            <button
              key={`approval-${a.id}`}
              onClick={() => setSelected({ kind: "approval", id: a.id })}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border/30 transition-colors border-l-[3px]",
                selected?.kind === "approval" && selected.id === a.id
                  ? "bg-primary/5 border-l-primary"
                  : "hover:bg-muted/30 border-l-amber-400",
              )}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-sm font-medium truncate flex-1">{APPROVAL_TYPE_LABELS[a.type] ?? a.type}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", a.status === "pending" ? "bg-amber-400/15 text-amber-400" : "bg-muted text-muted-foreground")}>{a.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-6">
                <span className="text-[11px] text-muted-foreground truncate">
                  {(a.payload as any)?.name ?? "Request"} · {timeAgoShort(a.createdAt)}
                </span>
              </div>
            </button>
          ))}

          {/* Runs tab */}
          {(activeTab === "runs" || activeTab === "all") && failedRuns.map((r) => (
            <button
              key={`run-${r.id}`}
              onClick={() => setSelected({ kind: "run", id: r.id })}
              className={cn(
                "w-full text-left px-3 py-3 border-b border-border/30 transition-colors border-l-[3px]",
                selected?.kind === "run" && selected.id === r.id
                  ? "bg-primary/5 border-l-primary"
                  : "hover:bg-muted/30 border-l-red-500",
              )}
            >
              <div className="flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <span className="text-sm font-medium truncate flex-1">{agentName(r.agentId)} run {r.status}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgoShort(r.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-6">
                <span className="text-[11px] text-red-400/70 truncate">{r.error ? r.error.slice(0, 60) : "No error details"}</span>
              </div>
            </button>
          ))}

          {/* Empty states */}
          {activeTab === "primary" && filteredIssues.length === 0 && !loadingIssues && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MailOpen className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No items in your inbox</p>
            </div>
          )}
          {activeTab === "approvals" && actionableApprovals.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No pending approvals</p>
            </div>
          )}
          {activeTab === "runs" && failedRuns.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No failed runs</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Detail */}
      <div className="flex-1 overflow-y-auto">
        {/* Empty state */}
        {!selected && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Mail className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">Select an item to view details</p>
          </div>
        )}

        {/* Issue Detail */}
        {selectedIssue && (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                  selectedIssue.status === "done" ? "bg-emerald-500/10 text-emerald-400" :
                  selectedIssue.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                  selectedIssue.status === "todo" ? "bg-blue-500/10 text-blue-400" :
                  "bg-muted text-muted-foreground"
                )}>{STATUS_LABELS[selectedIssue.status] ?? selectedIssue.status}</span>
                <span className="text-xs font-mono text-muted-foreground">{selectedIssue.identifier}</span>
              </div>
              <h1 className="text-xl font-semibold">{selectedIssue.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {agentName(selectedIssue.assigneeAgentId) && `Assigned to ${agentName(selectedIssue.assigneeAgentId)}`}
                {selectedIssue.project && ` · ${(selectedIssue.project as any).name}`}
                {` · ${timeAgoShort(selectedIssue.updatedAt)} ago`}
              </p>
            </div>

            {/* Properties */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/20 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Priority</p>
                <p className="text-sm font-medium capitalize">{selectedIssue.priority ?? "None"}</p>
              </div>
              <div className="rounded-xl bg-muted/20 px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm font-medium">{STATUS_LABELS[selectedIssue.status] ?? selectedIssue.status}</p>
              </div>
            </div>

            {/* Description */}
            {selectedIssue.description && (
              <div className="rounded-xl border border-border/50 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{selectedIssue.description}</p>
              </div>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Comments ({comments.length})</p>
                <div className="space-y-3">
                  {comments.slice(0, 10).map((c: any) => (
                    <div key={c.id} className="rounded-xl bg-muted/10 border border-border/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{c.authorAgentId ? agentName(c.authorAgentId) : "You"}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgoShort(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground/70 whitespace-pre-wrap">{c.body?.slice(0, 500)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button size="sm" variant="outline" onClick={() => archiveMut.mutate(selectedIssue.id)} className="gap-1.5">
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button size="sm" variant="outline" asChild className="gap-1.5">
                <Link to={`/issues/${selectedIssue.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open Full
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Approval Detail */}
        {selectedApproval && (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                  {selectedApproval.status}
                </span>
              </div>
              <h1 className="text-xl font-semibold">{APPROVAL_TYPE_LABELS[selectedApproval.type] ?? selectedApproval.type}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {(selectedApproval.payload as any)?.name ?? "Request"} · {timeAgoShort(selectedApproval.createdAt)} ago
              </p>
            </div>

            {/* Payload */}
            <div className="rounded-xl border border-border/50 p-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Details</p>
              {Object.entries((selectedApproval.payload ?? {}) as Record<string, unknown>).slice(0, 8).map(([k, v]) => {
                if (!v || typeof v === "object") return null;
                return (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            {ACTIONABLE_APPROVAL_STATUSES.has(selectedApproval.status) && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <Button size="sm" onClick={() => approveMut.mutate(selectedApproval.id)}
                  disabled={approveMut.isPending}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => rejectMut.mutate(selectedApproval.id)}
                  disabled={rejectMut.isPending}
                  className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Failed Run Detail */}
        {selectedRun && (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">{selectedRun.status}</span>
              </div>
              <h1 className="text-xl font-semibold">{agentName(selectedRun.agentId)} run failed</h1>
              <p className="text-sm text-muted-foreground mt-1">{timeAgoShort(selectedRun.createdAt)} ago</p>
            </div>

            {selectedRun.error && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2">Error</p>
                <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap">{selectedRun.error}</pre>
              </div>
            )}

            {selectedRun.stderrExcerpt && (
              <div className="rounded-xl bg-muted/20 border border-border/50 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Log Excerpt</p>
                <pre className="text-xs text-foreground/60 font-mono whitespace-pre-wrap overflow-x-auto">{selectedRun.stderrExcerpt}</pre>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-border/30">
              <Button size="sm" variant="outline" asChild className="gap-1.5">
                <Link to={`/agents/${selectedRun.agentId}/runs/${selectedRun.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" /> View Full Run
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
