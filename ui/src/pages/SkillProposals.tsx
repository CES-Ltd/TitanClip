import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check, X, Code, TrendingUp } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { skillProposalsApi, type SkillProposal } from "../api/skillProposals";

export function SkillProposals() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: proposals = [] } = useQuery({
    queryKey: ["skill-proposals", companyId],
    queryFn: () => skillProposalsApi.list(companyId!),
    enabled: !!companyId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => skillProposalsApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skill-proposals"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => skillProposalsApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["skill-proposals"] }),
  });

  const pending = proposals.filter((p) => p.status === "proposed");
  const reviewed = proposals.filter((p) => p.status !== "proposed");

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            Skill Proposals
          </h1>
          <p className="text-sm text-muted-foreground">
            {pending.length} pending review, {reviewed.length} reviewed
          </p>
        </div>

        {/* Pending Proposals */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Pending Review</h2>
            {pending.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={() => approveMutation.mutate(proposal.id)}
                onReject={() => rejectMutation.mutate(proposal.id)}
              />
            ))}
          </div>
        )}

        {/* Reviewed */}
        {reviewed.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Reviewed</h2>
            {reviewed.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        )}

        {proposals.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No skill proposals yet</p>
            <p className="text-xs mt-1">Proposals are auto-generated from successful agent runs</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalCard({ proposal, onApprove, onReject }: {
  proposal: SkillProposal;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const confidence = proposal.confidence ? parseFloat(proposal.confidence) : 0;
  const statusColors: Record<string, string> = {
    proposed: "bg-amber-500/10 text-amber-500",
    approved: "bg-green-500/10 text-green-500",
    rejected: "bg-red-500/10 text-red-500",
    installed: "bg-blue-500/10 text-blue-500",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{proposal.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[proposal.status] ?? "bg-muted"}`}>
              {proposal.status}
            </span>
            {confidence > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>
          {proposal.description && (
            <p className="text-sm text-muted-foreground mb-2">{proposal.description}</p>
          )}
          {proposal.sourcePattern && (
            <p className="text-xs text-muted-foreground">Pattern: {proposal.sourcePattern}</p>
          )}
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <Code className="h-3 w-3" /> View proposed skill markdown
            </summary>
            <pre className="mt-2 text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-48">
              {proposal.proposedMarkdown}
            </pre>
          </details>
        </div>

        {proposal.status === "proposed" && (
          <div className="flex gap-1 ml-3">
            <button
              onClick={onApprove}
              className="p-2 rounded-md bg-green-500/10 text-green-500 hover:bg-green-500/20"
              title="Approve & Install"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onReject}
              className="p-2 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20"
              title="Reject"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
