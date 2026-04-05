import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApprovalCard } from "./ApprovalCard";
import { IssueCard } from "./IssueCard";
import type { ChatAction } from "../../api/chat";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  actions?: ChatAction[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  approvalPending?: boolean;
}

export function ChatMessageComponent({ role, content, actions, onApprove, onReject, approvalPending }: ChatMessageProps) {
  return (
    <div className={cn(
      "flex gap-3 px-4 py-3",
      role === "user" ? "flex-row-reverse" : "flex-row",
    )}>
      {/* Avatar */}
      <div className={cn(
        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        role === "user" ? "bg-primary/20 text-primary" :
        role === "assistant" ? "bg-indigo-500/20 text-indigo-400" :
        "bg-muted text-muted-foreground",
      )}>
        {role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message body */}
      <div className={cn(
        "flex-1 max-w-[80%] space-y-2",
        role === "user" ? "text-right" : "text-left",
      )}>
        {/* Text content */}
        {content && (
          <div className={cn(
            "inline-block rounded-lg px-4 py-2.5 text-sm",
            role === "user"
              ? "bg-primary text-primary-foreground"
              : role === "system"
                ? "bg-muted/50 text-muted-foreground italic"
                : "bg-muted/30 text-foreground",
          )}>
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        )}

        {/* Action cards */}
        {actions?.map((action, idx) => (
          <div key={idx} className={cn(role === "user" ? "flex justify-end" : "")}>
            {action.type === "approval_pending" && action.approval && (
              <ApprovalCard
                approval={action.approval as any}
                onApprove={onApprove}
                onReject={onReject}
                isPending={approvalPending}
              />
            )}
            {action.type === "issue_created" && action.issue && (
              <IssueCard issue={action.issue as any} />
            )}
            {action.type === "plan_created" && action.issues && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Created {action.issues.length} issues:</p>
                {action.issues.map((issue: any) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            )}
            {action.type === "info" && action.text && (
              <div className="text-xs text-muted-foreground bg-muted/20 rounded px-3 py-2">
                {action.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
