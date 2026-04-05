import { companies, agents, issues, companyMemberships } from "@titanclip/db";
import { eq } from "drizzle-orm";
import { logger } from "./middleware/logger.js";

const LOCAL_BOARD_USER_ID = "local-board";

/**
 * Seeds the first team, CEO agent, and hiring task on a fresh database.
 * Only runs when zero companies exist. Safe to call on every startup.
 */
export async function seedFirstTeamAndAgent(db: any): Promise<void> {
  // Check if any company already exists
  const existingCompanies = await db.select({ id: companies.id }).from(companies);
  if (existingCompanies.length > 0) return; // Already seeded

  logger.info("Seeding first team and CEO agent on fresh database...");

  const now = new Date();

  // 1. Create the first company/team
  const [company] = await db.insert(companies).values({
    name: "Delivery Pod",
    description: "Enterprise High-Performance Delivery Pod",
    status: "active",
    issuePrefix: "DEL",
    issueCounter: 0,
    budgetMonthlyCents: 0,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info(`Created team: ${company.name} (${company.issuePrefix})`);

  // 2. Ensure board membership for the team
  await db.insert(companyMemberships).values({
    companyId: company.id,
    principalType: "user",
    principalId: LOCAL_BOARD_USER_ID,
    status: "active",
    membershipRole: "owner",
  }).onConflictDoNothing();

  // 3. Create CEO agent (Business Unit Head)
  const [ceoAgent] = await db.insert(agents).values({
    companyId: company.id,
    name: "Business Unit Head",
    role: "ceo",
    title: "Head of Delivery Pod",
    adapterType: "claude_local",
    adapterConfig: {},
    status: "idle",
    spentMonthlyCents: 0,
    budgetMonthlyCents: 0,
    lastHeartbeatAt: null,
    runtimeConfig: {
      heartbeat: {
        enabled: true,
        intervalSeconds: 3600,
        wakeOnDemand: true,
        maxConcurrentRuns: 1,
      },
    },
    createdAt: now,
    updatedAt: now,
  } as any).returning();

  logger.info(`Created CEO agent: ${ceoAgent.name} (${ceoAgent.id})`);

  // 4. Create the initial hiring task
  const [hiringTask] = await db.insert(issues).values({
    companyId: company.id,
    title: "Set up the delivery pod and hire your first engineer",
    description: `Welcome to your new Delivery Pod! As the Business Unit Head, your first priorities are:

1. **Review the team templates** — Go to Instance Settings → Admin to see the pre-configured delivery pod roles (Backend Engineer, Frontend Engineer, QA, DevOps, Security, PM, SRE, Docs, Performance)

2. **Hire your first engineer** — Create a new agent using one of the available templates. Choose the role that matches your most pressing need.

3. **Create a hiring plan** — Define the full pod composition based on your project requirements. A typical high-performance pod includes:
   - 2-3 Engineers (Backend + Frontend)
   - 1 QA Engineer
   - 1 DevOps/SRE Engineer
   - 1 Product Manager

4. **Set up workflows** — Create onboarding workflows (Team → Lifecycle) so new agents get ramped up automatically with training tasks.

This task was auto-created during pod initialization.`,
    priority: "high",
    status: "todo",
    assigneeAgentId: ceoAgent.id,
    issueNumber: 1,
    identifier: `${company.issuePrefix}-1`,
    createdAt: now,
    updatedAt: now,
  } as any).returning();

  // Update issue counter
  await db.update(companies)
    .set({ issueCounter: 1 })
    .where(eq(companies.id, company.id));

  logger.info(`Created initial task: ${hiringTask.title} (${hiringTask.identifier})`);
  logger.info("First team and agent seeded successfully");
}
