/**
 * ApprovalCard — inline approval request rendered in chat.
 * Shows approve/reject buttons that call the approvals API.
 */

import { useState } from "react";
import { ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { approvalsApi } from "../../api/approvals";
import type { ApprovalRequest } from "../../hooks/useChatStream";

const TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "Strategy Approval",
  budget_override_required: "Budget Override",
};

export function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const [status, setStatus] = useState(approval.status);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    setStatus("approved");
    try {
      await approvalsApi.approve(approval.approvalId);
    } catch {
      setStatus("pending");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setStatus("rejected");
    try {
      await approvalsApi.reject(approval.approvalId);
    } catch {
      setStatus("pending");
    } finally {
      setLoading(false);
    }
  };

  const payload = approval.payload;
  const label = TYPE_LABELS[approval.approvalType] ?? approval.approvalType;

  return (
    <div className={cn(
      "rounded-xl border p-4 transition-colors",
      status === "pending" ? "border-amber-500/30 bg-amber-500/5" :
      status === "approved" ? "border-emerald-500/30 bg-emerald-500/5" :
      "border-red-500/20 bg-red-500/5"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className={cn("h-4 w-4", status === "pending" ? "text-amber-500" : status === "approved" ? "text-emerald-500" : "text-red-400")} />
        <span className="text-sm font-medium">{label}</span>
        {status !== "pending" && (
          <span className={cn(
            "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold",
            status === "approved" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-400"
          )}>
            {status}
          </span>
        )}
      </div>

      <div className="space-y-1 text-sm text-muted-foreground mb-3">
        {"name" in payload && payload.name ? <div><span className="text-foreground/60">Name:</span> {String(payload.name)}</div> : null}
        {"role" in payload && payload.role ? <div><span className="text-foreground/60">Role:</span> {String(payload.role)}</div> : null}
        {"reason" in payload && payload.reason ? <div><span className="text-foreground/60">Reason:</span> {String(payload.reason)}</div> : null}
        {"templateName" in payload && payload.templateName ? <div><span className="text-foreground/60">Template:</span> {String(payload.templateName)}</div> : null}
        {"requestedByAgentId" in payload ? <div><span className="text-foreground/60">Requested by:</span> Agent</div> : null}
      </div>

      {status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 disabled:opacity-50 transition-colors"
          >
            <X className="h-3 w-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
