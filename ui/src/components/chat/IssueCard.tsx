import { ClipboardList, ArrowRight } from "lucide-react";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

interface IssueCardProps {
  issue: {
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    priority?: string | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-400",
  in_progress: "text-amber-400",
  in_review: "text-purple-400",
  done: "text-green-400",
  cancelled: "text-red-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <Link
      to={`/issues/${issue.id}`}
      className="block rounded-lg border border-primary/20 bg-primary/5 p-4 max-w-sm hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-4 w-4 text-primary" />
        <span className="text-xs font-mono text-muted-foreground">{issue.identifier ?? ""}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded bg-muted/50", STATUS_COLORS[issue.status] ?? "text-muted-foreground")}>
          {issue.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div className="text-sm font-medium text-foreground">{issue.title}</div>
      {issue.priority && (
        <div className="text-xs text-muted-foreground mt-1">
          Priority: {PRIORITY_LABELS[issue.priority] ?? issue.priority}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        View Issue <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
