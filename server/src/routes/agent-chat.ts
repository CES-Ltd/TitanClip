/**
 * Agent Chat Route — unified with TitanClip's observability pipeline.
 *
 * When a user sends a message:
 * 1. Creates a TitanClip issue (or appends to existing) — visible in Issues page
 * 2. Creates/appends to a conversation — linked to the issue
 * 3. Executes via the agent's adapter with streaming
 * 4. Records activity log, cost events — visible in Activity + Costs pages
 * 5. Optionally routes through skill-based routing
 *
 * All chat activity flows through TitanClip's standard observability system.
 */

import { Router } from "express";
import type { Db } from "@titanclip/db";
import { agents, issues } from "@titanclip/db";
import { eq, and } from "drizzle-orm";
import { getServerAdapter } from "../adapters/index.js";
import { conversationService } from "../services/conversations.js";
import { agentMemoryService } from "../services/agent-memory.js";
import { logActivity } from "../services/activity-log.js";
import { assertCompanyAccess } from "./authz.js";

export function agentChatRoutes(db: Db) {
  const router = Router();
  const convSvc = conversationService(db);
  const memorySvc = agentMemoryService(db);

  router.post("/companies/:companyId/agents/:agentId/chat", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);

    const { message, conversationId } = req.body as {
      message: string;
      conversationId?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // 1. Resolve agent
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }

    // 2. Create TitanClip issue for this chat task (D2 fix)
    const issueTitle = message.slice(0, 100) + (message.length > 100 ? "..." : "");
    let issueId: string | undefined;
    try {
      const [newIssue] = await db
        .insert(issues)
        .values({
          companyId,
          title: issueTitle,
          description: message,
          status: "in_progress",
          priority: "medium",
          assigneeAgentId: agentId,
          originKind: "manual",
          createdByUserId: "local-board",
        })
        .returning();
      issueId = newIssue?.id;

      // Log issue creation in activity (D4 fix)
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: "local-board",
        action: "issue.created",
        entityType: "issue",
        entityId: issueId!,
        details: { title: issueTitle, origin: "agent_os_chat" },
      });
    } catch (err) {
      // Issue creation is best-effort — continue with chat even if it fails
      console.warn("[AgentChat] Issue creation failed:", (err as Error).message);
    }

    // 3. Get or create conversation, linked to issue
    let conversation;
    if (conversationId) {
      conversation = await convSvc.getById(conversationId);
    }
    if (!conversation) {
      conversation = await convSvc.create(companyId, agentId, {
        title: issueTitle,
        issueId,
      });
    } else if (issueId && !conversation.issueId) {
      await convSvc.linkToIssue(conversation.id, issueId);
    }

    // 4. Record user message
    await convSvc.appendMessage(conversation.id, companyId, {
      role: "user",
      content: message,
    });

    // 5. Build memory context
    let memoryContext = "";
    try {
      memoryContext = await memorySvc.buildMemoryContext(agentId, { maxTokenEstimate: 1500 });
    } catch { /* Memory tables may not exist — continue without */ }

    // 6. Load conversation history
    const recentMessages = await convSvc.getMessages(conversation.id, { limit: 20 });
    const history = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // 7. Resolve adapter + config
    const adapter = getServerAdapter(agent.adapterType);
    const adapterConfig = (agent.adapterConfig as Record<string, unknown>) ?? {};

    // 8. Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Conversation-Id", conversation.id);
    if (issueId) res.setHeader("X-Issue-Id", issueId);
    res.flushHeaders();

    const sendSSE = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendSSE({ type: "start", conversationId: conversation.id, issueId });

    let fullContent = "";

    try {
      // 9. Execute adapter
      const result = await adapter.execute({
        runId: `chat-${Date.now()}`,
        agent: {
          id: agent.id,
          companyId: agent.companyId,
          name: agent.name,
          adapterType: agent.adapterType,
          adapterConfig,
        },
        runtime: {
          sessionId: conversation.id,
          sessionParams: { history },
          sessionDisplayId: conversation.title ?? "chat",
          taskKey: issueId ? `issue:${issueId}` : `chat:${conversation.id}`,
        },
        config: adapterConfig,
        context: {
          userMessage: message,
          memoryContext,
          conversationId: conversation.id,
          issueId,
        },
        onLog: async (stream, chunk) => {
          if (stream === "stdout" && chunk) {
            fullContent += chunk;
            sendSSE({ type: "chunk", content: chunk });
          }
        },
      });

      const responseContent = fullContent || (result.resultJson as any)?.content || result.summary || "(no response)";

      // 10. Record assistant response in conversation
      await convSvc.appendMessage(conversation.id, companyId, {
        role: "assistant",
        content: responseContent,
        tokenCount: result.usage
          ? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
          : undefined,
        metadata: {
          model: result.model,
          provider: result.provider,
          costUsd: result.costUsd,
          exitCode: result.exitCode,
        },
      });

      // 11. Log activity for the chat execution (D4 fix)
      await logActivity(db, {
        companyId,
        actorType: "agent",
        actorId: agentId,
        agentId,
        action: "agent.chat.completed",
        entityType: "conversation",
        entityId: conversation.id,
        details: {
          issueId,
          model: result.model,
          provider: result.provider,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          costUsd: result.costUsd,
          iterations: (result.resultJson as any)?.iterations,
        },
      });

      // 12. If we created an issue, add the response as an issue comment
      if (issueId) {
        try {
          const { issueComments } = await import("@titanclip/db");
          await db.insert(issueComments).values({
            companyId,
            issueId: issueId!,
            body: responseContent.slice(0, 10000),
            authorAgentId: agentId,
          });
        } catch { /* Best effort */ }
      }

      // 13. Memory extraction
      if (result.exitCode === 0 && responseContent.length > 50) {
        try {
          await memorySvc.upsert(agentId, companyId, {
            memoryType: "learned_fact",
            category: "chat_summaries",
            key: `conv:${conversation.id}:${Date.now()}`,
            content: responseContent.slice(0, 500),
            importance: 3,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        } catch { /* Memory table may not exist */ }
      }

      // 14. Process autonomous hire requests from tool results
      const hireResults = await processHireActions(db, {
        companyId,
        requestingAgentId: agentId,
        conversationId: conversation.id,
        issueId,
        responseContent,
        sendSSE,
      });

      sendSSE({
        type: "done",
        conversationId: conversation.id,
        issueId,
        usage: result.usage,
        model: result.model,
        provider: result.provider,
        costUsd: result.costUsd,
        hires: hireResults,
      });
    } catch (err: any) {
      sendSSE({ type: "error", error: err.message });

      // Log failure activity
      try {
        await logActivity(db, {
          companyId,
          actorType: "agent",
          actorId: agentId,
          agentId,
          action: "agent.chat.failed",
          entityType: "conversation",
          entityId: conversation.id,
          details: { error: err.message, issueId },
        });
      } catch { /* Best effort */ }
    }

    res.end();
  });

  return router;
}

// ── Autonomous Hire Processing ─────────────────────────────────────────

interface HireResult {
  templateName: string;
  reason: string;
  agentId?: string;
  agentName?: string;
  status: "created" | "pending_approval" | "template_not_found" | "rate_limited" | "error";
  error?: string;
}

async function processHireActions(
  db: any,
  ctx: {
    companyId: string;
    requestingAgentId: string;
    conversationId: string;
    issueId?: string;
    responseContent: string;
    sendSSE: (data: Record<string, unknown>) => void;
  }
): Promise<HireResult[]> {
  const results: HireResult[] = [];

  // Scan response for hire_agent action JSON blocks
  const hirePattern = /"action"\s*:\s*"hire_agent"/g;
  if (!hirePattern.test(ctx.responseContent)) return results;

  // Extract all JSON blocks that contain hire actions
  const jsonBlocks = ctx.responseContent.match(/\{[^{}]*"action"\s*:\s*"hire_agent"[^{}]*\}/g);
  if (!jsonBlocks?.length) return results;

  // Rate limit: max 3 hires per request
  const MAX_HIRES_PER_REQUEST = 3;

  for (const block of jsonBlocks.slice(0, MAX_HIRES_PER_REQUEST)) {
    try {
      const parsed = JSON.parse(block);
      if (parsed.action !== "hire_agent") continue;

      const templateName = parsed.templateName as string;
      const reason = parsed.reason as string;
      const budgetMonthlyCents = parsed.budgetMonthlyCents as number | undefined;

      if (!templateName || !reason) continue;

      ctx.sendSSE({ type: "hire_started", templateName, reason });

      // Resolve template
      const { instanceSettingsService } = await import("../services/instance-settings.js");
      const settingsSvc = instanceSettingsService(db);
      const templates = await settingsSvc.getAvailableTemplates();
      const template = templates.find(
        (t: any) => t.name.toLowerCase() === templateName.toLowerCase()
      );

      if (!template) {
        results.push({ templateName, reason, status: "template_not_found", error: `No template found matching "${templateName}"` });
        ctx.sendSSE({ type: "hire_failed", templateName, error: `Template "${templateName}" not found` });
        continue;
      }

      // Check company approval policy
      const { companies: companiesTable } = await import("@titanclip/db");
      const [company] = await db.select().from(companiesTable).where(
        (await import("drizzle-orm")).eq(companiesTable.id, ctx.companyId)
      );

      const requiresApproval = company?.requireBoardApprovalForNewAgents ?? true;
      const agentStatus = requiresApproval ? "pending_approval" : "idle";

      // Create the agent
      const { agents: agentsTable } = await import("@titanclip/db");
      const agentName = `${template.name} (auto-hired)`;
      const [newAgent] = await db.insert(agentsTable).values({
        companyId: ctx.companyId,
        name: agentName,
        role: template.role || "general",
        status: agentStatus,
        adapterType: "openai_compatible",
        adapterConfig: {},
        runtimeConfig: {},
        budgetMonthlyCents: budgetMonthlyCents ?? template.defaultBudgetMonthlyCents ?? 0,
      }).returning();

      // Log the autonomous hire in activity audit
      await logActivity(db, {
        companyId: ctx.companyId,
        actorType: "agent",
        actorId: ctx.requestingAgentId,
        agentId: ctx.requestingAgentId,
        action: "agent.autonomous_hire",
        entityType: "agent",
        entityId: newAgent.id,
        details: {
          reason,
          templateId: template.id,
          templateName: template.name,
          hiredAgentName: agentName,
          hiredAgentId: newAgent.id,
          conversationId: ctx.conversationId,
          issueId: ctx.issueId,
          requiresApproval,
          budgetMonthlyCents: newAgent.budgetMonthlyCents,
        },
      });

      // If approval required, create approval record
      if (requiresApproval) {
        try {
          const { approvals: approvalsTable } = await import("@titanclip/db");
          await db.insert(approvalsTable).values({
            companyId: ctx.companyId,
            type: "hire_agent",
            status: "pending",
            payload: {
              agentId: newAgent.id,
              name: agentName,
              role: template.role,
              templateId: template.id,
              templateName: template.name,
              reason,
              requestedByAgentId: ctx.requestingAgentId,
              autonomous: true,
            },
          }).returning();

          await logActivity(db, {
            companyId: ctx.companyId,
            actorType: "system",
            actorId: "agent-os",
            action: "approval.created",
            entityType: "agent",
            entityId: newAgent.id,
            details: { type: "hire_agent", reason, autonomous: true },
          });
        } catch { /* Approval creation is best-effort */ }
      }

      // Add issue comment documenting the hire
      if (ctx.issueId) {
        try {
          const { issueComments } = await import("@titanclip/db");
          await db.insert(issueComments).values({
            companyId: ctx.companyId,
            issueId: ctx.issueId,
            body: `**Autonomous Hire**: Agent hired "${agentName}" from template "${template.name}".\n\n**Reason**: ${reason}\n\n${requiresApproval ? "_Pending board approval._" : "_Agent is now active._"}`,
            authorAgentId: ctx.requestingAgentId,
          });
        } catch { /* Best effort */ }
      }

      results.push({
        templateName: template.name,
        reason,
        agentId: newAgent.id,
        agentName,
        status: requiresApproval ? "pending_approval" : "created",
      });

      ctx.sendSSE({
        type: "hire_completed",
        templateName: template.name,
        agentName,
        agentId: newAgent.id,
        status: requiresApproval ? "pending_approval" : "created",
        reason,
      });
    } catch (err: any) {
      results.push({ templateName: "unknown", reason: "parse error", status: "error", error: err.message });
    }
  }

  return results;
}
