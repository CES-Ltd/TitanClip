import crypto from "node:crypto";
import type { Db } from "@titanclip/db";
import { workflowTemplates, issues as issuesTable, issueDependencies } from "@titanclip/db";
import { eq, and, desc } from "drizzle-orm";
import type { WorkflowTemplate, WorkflowStep } from "@titanclip/shared";

function toTemplate(row: typeof workflowTemplates.$inferSelect): WorkflowTemplate {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    steps: (row.steps as WorkflowStep[]) ?? [],
    enabled: row.enabled,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function workflowService(db: Db) {
  return {
    async listTemplates(companyId: string): Promise<WorkflowTemplate[]> {
      const rows = await db.select().from(workflowTemplates)
        .where(eq(workflowTemplates.companyId, companyId))
        .orderBy(desc(workflowTemplates.createdAt));
      return rows.map(toTemplate);
    },

    async getTemplate(id: string): Promise<WorkflowTemplate | null> {
      const [row] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id));
      return row ? toTemplate(row) : null;
    },

    async createTemplate(companyId: string, input: {
      name: string;
      description?: string;
      steps: WorkflowStep[];
    }): Promise<WorkflowTemplate> {
      // Assign IDs to steps if missing
      const steps = input.steps.map(s => ({
        ...s,
        id: s.id || crypto.randomUUID(),
      }));
      const [row] = await db.insert(workflowTemplates).values({
        companyId,
        name: input.name,
        description: input.description ?? "",
        steps: steps as any,
      }).returning();
      return toTemplate(row);
    },

    async updateTemplate(id: string, patch: Partial<{
      name: string;
      description: string;
      steps: WorkflowStep[];
      enabled: boolean;
    }>): Promise<WorkflowTemplate | null> {
      const [row] = await db.update(workflowTemplates)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(workflowTemplates.id, id))
        .returning();
      return row ? toTemplate(row) : null;
    },

    async deleteTemplate(id: string): Promise<void> {
      await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
    },

    // Execute a workflow: create issues with dependencies
    async executeWorkflow(companyId: string, templateId: string, opts?: {
      projectId?: string;
      prefix?: string;
    }): Promise<{ issueIds: string[] }> {
      const [template] = await db.select().from(workflowTemplates)
        .where(eq(workflowTemplates.id, templateId));
      if (!template) throw new Error("Workflow template not found");

      const steps = (template.steps as WorkflowStep[]) ?? [];
      if (steps.length === 0) throw new Error("Workflow has no steps");

      const prefix = opts?.prefix ? `${opts.prefix}: ` : "";
      const stepIdToIssueId = new Map<string, string>();
      const issueIds: string[] = [];

      // Create issues for each step
      for (const step of steps) {
        const [issue] = await db.insert(issuesTable).values({
          companyId,
          projectId: opts?.projectId ?? null,
          title: `${prefix}${step.title}`,
          description: step.description || null,
          priority: step.priority || "medium",
          status: step.dependsOnStepIds.length > 0 ? "blocked" : "backlog",
        } as any).returning();

        stepIdToIssueId.set(step.id, issue.id);
        issueIds.push(issue.id);
      }

      // Create dependencies
      for (const step of steps) {
        const targetIssueId = stepIdToIssueId.get(step.id)!;
        for (const depStepId of step.dependsOnStepIds) {
          const sourceIssueId = stepIdToIssueId.get(depStepId);
          if (sourceIssueId) {
            await db.insert(issueDependencies).values({
              companyId,
              sourceIssueId,
              targetIssueId,
              dependencyType: "blocks",
            });
          }
        }
      }

      // Increment usage count
      await db.update(workflowTemplates)
        .set({ usageCount: template.usageCount + 1, updatedAt: new Date() })
        .where(eq(workflowTemplates.id, templateId));

      return { issueIds };
    },
  };
}
