import { CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalCardProps {
  approval: {
    id: string;
    type: string;
    status: string;
    payload?: Record<string, unknown>;
  };
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isPending?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "Business Unit Head Strategy",
};

export function ApprovalCard({ approval, onApprove, onReject, isPending }: ApprovalCardProps) {
  const payload = approval.payload ?? {};
  const agentName = (payload.name as string) ?? "Unknown";
  const roleName = (payload.role as string) ?? "";
  const isPendingStatus = approval.status === "pending";

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 max-w-sm shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
          {TYPE_LABELS[approval.type] ?? approval.type}
        </span>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full ml-auto font-medium",
          isPendingStatus ? "bg-amber-400/15 text-amber-300" :
          approval.status === "approved" ? "bg-emerald-400/15 text-emerald-300" :
          "bg-red-400/15 text-red-300",
        )}>
          {approval.status}
        </span>
      </div>

      {approval.type === "hire_agent" && (
        <p className="text-sm text-foreground">
          <strong>{agentName}</strong>
          {roleName && <span className="text-muted-foreground"> · {roleName}</span>}
        </p>
      )}

      {isPendingStatus && (onApprove || onReject) && (
        <div className="flex gap-2 mt-3">
          {onApprove && (
            <button
              onClick={() => onApprove(approval.id)}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </button>
          )}
          {onReject && (
            <button
              onClick={() => onReject(approval.id)}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
