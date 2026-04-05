import type { Db } from "@titanclip/db";
import { issueDependencies, issues as issuesTable, agents as agentsTable } from "@titanclip/db";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import type { IssueDependency, CriticalPathNode, CriticalPathResult } from "@titanclip/shared";

function toDep(row: typeof issueDependencies.$inferSelect, extra?: Record<string, string | undefined>): IssueDependency {
  return {
    id: row.id,
    companyId: row.companyId,
    sourceIssueId: row.sourceIssueId,
    targetIssueId: row.targetIssueId,
    dependencyType: row.dependencyType as IssueDependency["dependencyType"],
    sourceIssueTitle: extra?.sourceTitle,
    sourceIssueIdentifier: extra?.sourceIdentifier,
    sourceIssueStatus: extra?.sourceStatus,
    targetIssueTitle: extra?.targetTitle,
    targetIssueIdentifier: extra?.targetIdentifier,
    targetIssueStatus: extra?.targetStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export function dependencyService(db: Db) {
  async function enrichDeps(deps: (typeof issueDependencies.$inferSelect)[]): Promise<IssueDependency[]> {
    const issueIds = [...new Set(deps.flatMap(d => [d.sourceIssueId, d.targetIssueId]))];
    if (issueIds.length === 0) return [];

    const issues = await db.select({
      id: issuesTable.id, title: issuesTable.title, identifier: issuesTable.identifier, status: issuesTable.status,
    }).from(issuesTable).where(inArray(issuesTable.id, issueIds));
    const map = new Map(issues.map(i => [i.id, i]));

    return deps.map(d => {
      const src = map.get(d.sourceIssueId);
      const tgt = map.get(d.targetIssueId);
      return toDep(d, {
        sourceTitle: src?.title, sourceIdentifier: src?.identifier ?? undefined, sourceStatus: src?.status,
        targetTitle: tgt?.title, targetIdentifier: tgt?.identifier ?? undefined, targetStatus: tgt?.status,
      });
    });
  }

  return {
    async listForIssue(issueId: string): Promise<IssueDependency[]> {
      const deps = await db.select().from(issueDependencies)
        .where(or(eq(issueDependencies.sourceIssueId, issueId), eq(issueDependencies.targetIssueId, issueId)))
        .orderBy(desc(issueDependencies.createdAt));
      return enrichDeps(deps);
    },

    async listForCompany(companyId: string): Promise<IssueDependency[]> {
      const deps = await db.select().from(issueDependencies)
        .where(eq(issueDependencies.companyId, companyId))
        .orderBy(desc(issueDependencies.createdAt))
        .limit(500);
      return enrichDeps(deps);
    },

    async addDependency(companyId: string, sourceIssueId: string, targetIssueId: string, dependencyType: string): Promise<IssueDependency> {
      if (sourceIssueId === targetIssueId) throw new Error("Cannot create self-dependency");

      // Check for circular dependency (simple 1-level check)
      const reverse = await db.select().from(issueDependencies)
        .where(and(
          eq(issueDependencies.sourceIssueId, targetIssueId),
          eq(issueDependencies.targetIssueId, sourceIssueId),
        ));
      if (reverse.length > 0) throw new Error("Circular dependency detected");

      const [row] = await db.insert(issueDependencies).values({
        companyId, sourceIssueId, targetIssueId, dependencyType,
      }).returning();

      // Auto-block: if A blocks B and A isn't done, mark B as blocked
      if (dependencyType === "blocks") {
        const [sourceIssue] = await db.select({ status: issuesTable.status }).from(issuesTable).where(eq(issuesTable.id, sourceIssueId));
        if (sourceIssue && sourceIssue.status !== "done") {
          const [targetIssue] = await db.select({ status: issuesTable.status }).from(issuesTable).where(eq(issuesTable.id, targetIssueId));
          if (targetIssue && targetIssue.status === "backlog") {
            await db.update(issuesTable).set({ status: "blocked", updatedAt: new Date() }).where(eq(issuesTable.id, targetIssueId));
          }
        }
      }

      const enriched = await enrichDeps([row]);
      return enriched[0];
    },

    async removeDependency(id: string): Promise<void> {
      // Get the dep before deleting
      const [dep] = await db.select().from(issueDependencies).where(eq(issueDependencies.id, id));
      if (!dep) return;

      await db.delete(issueDependencies).where(eq(issueDependencies.id, id));

      // Auto-unblock: if this was a blocks relationship, check if target can be unblocked
      if (dep.dependencyType === "blocks") {
        const remainingBlockers = await db.select().from(issueDependencies)
          .where(and(
            eq(issueDependencies.targetIssueId, dep.targetIssueId),
            eq(issueDependencies.dependencyType, "blocks"),
          ));

        // Check if all remaining blockers are done
        if (remainingBlockers.length === 0) {
          const [targetIssue] = await db.select({ status: issuesTable.status }).from(issuesTable).where(eq(issuesTable.id, dep.targetIssueId));
          if (targetIssue?.status === "blocked") {
            await db.update(issuesTable).set({ status: "backlog", updatedAt: new Date() }).where(eq(issuesTable.id, dep.targetIssueId));
          }
        }
      }
    },

    // Called when an issue transitions to "done" — auto-unblock dependents
    async onIssueCompleted(issueId: string): Promise<string[]> {
      const unblocked: string[] = [];
      const blocking = await db.select().from(issueDependencies)
        .where(and(eq(issueDependencies.sourceIssueId, issueId), eq(issueDependencies.dependencyType, "blocks")));

      for (const dep of blocking) {
        // Check if all other blockers are also done
        const otherBlockers = await db.select().from(issueDependencies)
          .where(and(
            eq(issueDependencies.targetIssueId, dep.targetIssueId),
            eq(issueDependencies.dependencyType, "blocks"),
          ));

        const blockerIssueIds = otherBlockers.map(b => b.sourceIssueId).filter(id => id !== issueId);
        let allDone = true;
        if (blockerIssueIds.length > 0) {
          const blockerStatuses = await db.select({ id: issuesTable.id, status: issuesTable.status })
            .from(issuesTable).where(inArray(issuesTable.id, blockerIssueIds));
          allDone = blockerStatuses.every(s => s.status === "done");
        }

        if (allDone) {
          const [target] = await db.select({ status: issuesTable.status }).from(issuesTable).where(eq(issuesTable.id, dep.targetIssueId));
          if (target?.status === "blocked") {
            await db.update(issuesTable).set({ status: "todo", updatedAt: new Date() }).where(eq(issuesTable.id, dep.targetIssueId));
            unblocked.push(dep.targetIssueId);
          }
        }
      }
      return unblocked;
    },

    // Critical path analysis
    async getCriticalPath(companyId: string, rootIssueId?: string): Promise<CriticalPathResult> {
      // Get all active dependencies for the company
      const allDeps = await db.select().from(issueDependencies)
        .where(and(eq(issueDependencies.companyId, companyId), eq(issueDependencies.dependencyType, "blocks")));

      // Get all relevant issues
      const issueIds = [...new Set(allDeps.flatMap(d => [d.sourceIssueId, d.targetIssueId]))];
      if (rootIssueId && !issueIds.includes(rootIssueId)) issueIds.push(rootIssueId);
      if (issueIds.length === 0) return { nodes: [], criticalPathLength: 0, estimatedCompletionMinutes: 0, bottleneckIssueId: null };

      const issues = await db.select({
        id: issuesTable.id, title: issuesTable.title, identifier: issuesTable.identifier,
        status: issuesTable.status, priority: issuesTable.priority, assigneeAgentId: issuesTable.assigneeAgentId,
      }).from(issuesTable).where(inArray(issuesTable.id, issueIds));
      const issueMap = new Map(issues.map(i => [i.id, i]));

      // Get agent names
      const agentIds = [...new Set(issues.filter(i => i.assigneeAgentId).map(i => i.assigneeAgentId!))];
      const agentMap = new Map<string, string>();
      if (agentIds.length > 0) {
        const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
          .from(agentsTable).where(inArray(agentsTable.id, agentIds));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      // Build adjacency: blockedBy and blocks maps
      const blockedByMap = new Map<string, string[]>();
      const blocksMap = new Map<string, string[]>();
      for (const d of allDeps) {
        if (!blockedByMap.has(d.targetIssueId)) blockedByMap.set(d.targetIssueId, []);
        blockedByMap.get(d.targetIssueId)!.push(d.sourceIssueId);
        if (!blocksMap.has(d.sourceIssueId)) blocksMap.set(d.sourceIssueId, []);
        blocksMap.get(d.sourceIssueId)!.push(d.targetIssueId);
      }

      // Compute depths (longest path from root)
      const depthMap = new Map<string, number>();
      const estimateMap = new Map<string, number>();
      function getDepth(id: string, visited = new Set<string>()): number {
        if (depthMap.has(id)) return depthMap.get(id)!;
        if (visited.has(id)) return 0; // cycle guard
        visited.add(id);
        const blockers = blockedByMap.get(id) ?? [];
        const depth = blockers.length === 0 ? 0 : Math.max(...blockers.map(b => getDepth(b, visited) + 1));
        depthMap.set(id, depth);
        return depth;
      }

      for (const id of issueIds) getDepth(id);

      // Estimate: 30 min per task as default
      const DEFAULT_EST = 30;
      function getEstimate(id: string, visited = new Set<string>()): number {
        if (estimateMap.has(id)) return estimateMap.get(id)!;
        if (visited.has(id)) return 0;
        visited.add(id);
        const issue = issueMap.get(id);
        if (issue?.status === "done") { estimateMap.set(id, 0); return 0; }
        const blockers = blockedByMap.get(id) ?? [];
        const maxBlockerEst = blockers.length === 0 ? 0 : Math.max(...blockers.map(b => getEstimate(b, visited)));
        const est = maxBlockerEst + DEFAULT_EST;
        estimateMap.set(id, est);
        return est;
      }

      for (const id of issueIds) getEstimate(id);

      // Find critical path (longest chain)
      const maxDepth = Math.max(0, ...depthMap.values());
      const criticalNodes = new Set<string>();
      // Trace back from deepest nodes
      const deepestIds = [...depthMap.entries()].filter(([, d]) => d === maxDepth).map(([id]) => id);
      function traceCritical(id: string) {
        criticalNodes.add(id);
        const blockers = blockedByMap.get(id) ?? [];
        if (blockers.length > 0) {
          const deepestBlocker = blockers.reduce((best, b) => (depthMap.get(b) ?? 0) > (depthMap.get(best) ?? 0) ? b : best);
          traceCritical(deepestBlocker);
        }
      }
      for (const id of deepestIds) traceCritical(id);

      // Bottleneck: node that blocks the most others
      let bottleneckId: string | null = null;
      let maxBlocks = 0;
      for (const [id, targets] of blocksMap) {
        if (targets.length > maxBlocks) { maxBlocks = targets.length; bottleneckId = id; }
      }

      const nodes: CriticalPathNode[] = issueIds.map(id => {
        const issue = issueMap.get(id);
        return {
          issueId: id,
          issueTitle: issue?.title ?? "Unknown",
          issueIdentifier: issue?.identifier ?? "",
          issueStatus: issue?.status ?? "unknown",
          issuePriority: issue?.priority ?? "medium",
          assigneeAgentName: issue?.assigneeAgentId ? (agentMap.get(issue.assigneeAgentId) ?? null) : null,
          estimatedMinutes: estimateMap.get(id) ?? DEFAULT_EST,
          isCritical: criticalNodes.has(id),
          depth: depthMap.get(id) ?? 0,
          blockedBy: blockedByMap.get(id) ?? [],
          blocks: blocksMap.get(id) ?? [],
        };
      }).sort((a, b) => a.depth - b.depth);

      const estimatedCompletionMinutes = Math.max(0, ...estimateMap.values());

      return {
        nodes,
        criticalPathLength: maxDepth + 1,
        estimatedCompletionMinutes,
        bottleneckIssueId: bottleneckId,
      };
    },
  };
}
