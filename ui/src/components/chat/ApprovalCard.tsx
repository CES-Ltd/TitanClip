import { CheckCircle, XCircle, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ApprovalCardProps {
  approval: {
    id: string;
    type: string;
    status: string;
    payload?: Record<string, unknown>;
    createdAt?: string;
  };
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isPending?: boolean;
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "Business Unit Head Strategy",
};

export function ApprovalCard({ approval, onApprove, onReject, isPending }: ApprovalCardProps) {
  const payload = approval.payload ?? {};
  const agentName = (payload.name as string) ?? "Unknown";
  const roleName = (payload.role as string) ?? "";
  const isPendingStatus = approval.status === "pending";

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-500 uppercase tracking-wider">
          {APPROVAL_TYPE_LABELS[approval.type] ?? approval.type}
        </span>
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded ml-auto",
          isPendingStatus ? "bg-amber-500/20 text-amber-400" :
          approval.status === "approved" ? "bg-green-500/20 text-green-400" :
          "bg-red-500/20 text-red-400",
        )}>
          {approval.status.toUpperCase()}
        </span>
      </div>

      <div className="text-sm text-foreground mb-1">
        {approval.type === "hire_agent" ? (
          <span>Agent: <strong>{agentName}</strong> {roleName && <span className="text-muted-foreground">({roleName})</span>}</span>
        ) : (
          <span>{JSON.stringify(payload).slice(0, 100)}</span>
        )}
      </div>

      {isPendingStatus && (onApprove || onReject) && (
        <div className="flex gap-2 mt-3">
          {onApprove && (
            <Button size="sm" variant="outline" onClick={() => onApprove(approval.id)} disabled={isPending}
              className="gap-1 text-green-500 border-green-500/30 hover:bg-green-500/10">
              <CheckCircle className="h-3 w-3" /> Approve
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="outline" onClick={() => onReject(approval.id)} disabled={isPending}
              className="gap-1 text-red-500 border-red-500/30 hover:bg-red-500/10">
              <XCircle className="h-3 w-3" /> Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
