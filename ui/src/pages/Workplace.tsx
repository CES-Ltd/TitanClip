import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { TaskAssignmentOverlay } from "../components/TaskAssignmentOverlay";

export function Workplace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const [assigningAgentId, setAssigningAgentId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Workplace" }]);
  }, [setBreadcrumbs]);

  // Fetch data
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "backlog,todo" }),
    enabled: !!selectedCompanyId,
  });

  // Initialize Phaser game (dynamic import to avoid polluting main bundle)
  useEffect(() => {
    if (!gameContainerRef.current || gameRef.current) return;
    let destroyed = false;
    import("../workplace/WorkplaceGame").then(({ createWorkplaceGame }) => {
      if (destroyed || !gameContainerRef.current) return;
      gameRef.current = createWorkplaceGame(gameContainerRef.current);
    });
    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Sync agent data to Phaser
  useEffect(() => {
    if (!gameRef.current || !agents) return;
    gameRef.current.events.emit("agents-updated", agents);

    // Update HUD stats
    const workingCount = agents.filter((a) => a.status === "running").length;
    const errorCount = agents.filter((a) => a.status === "error").length;
    const pausedCount = agents.filter((a) => a.status === "paused").length;
    const activeAgents = agents.filter((a) => a.status !== "terminated");
    gameRef.current.events.emit("stats-updated", {
      agentCount: activeAgents.length,
      workingCount,
      idleCount: activeAgents.length - workingCount - errorCount - pausedCount,
      errorCount,
      taskCount: issues?.length ?? 0,
    });
  }, [agents, issues]);

  // Sync live runs to Phaser
  useEffect(() => {
    if (!gameRef.current || !liveRuns) return;
    gameRef.current.events.emit("runs-updated", liveRuns);
  }, [liveRuns]);

  // Listen for interaction events from Phaser
  useEffect(() => {
    if (!gameRef.current) return;
    const handler = (agentId: string) => {
      setAssigningAgentId(agentId);
    };
    gameRef.current.events.on("assign-task", handler);
    return () => {
      gameRef.current?.events.off("assign-task", handler);
    };
  }, []);

  const assignMutation = useMutation({
    mutationFn: async ({ issueId, agentId }: { issueId: string; agentId: string }) => {
      await issuesApi.update(issueId, { assigneeAgentId: agentId, status: "todo" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      setAssigningAgentId(null);
    },
  });

  const handleAssign = useCallback((issueId: string) => {
    if (!assigningAgentId) return;
    assignMutation.mutate({ issueId, agentId: assigningAgentId });
  }, [assigningAgentId, assignMutation]);

  const assigningAgent = agents?.find((a) => a.id === assigningAgentId);

  return (
    <div className="relative w-full h-[calc(100vh-3rem)]">
      <div ref={gameContainerRef} className="w-full h-full" />
      {assigningAgentId && assigningAgent && (
        <TaskAssignmentOverlay
          agent={assigningAgent}
          issues={issues ?? []}
          onAssign={handleAssign}
          onClose={() => setAssigningAgentId(null)}
          isPending={assignMutation.isPending}
        />
      )}
    </div>
  );
}
