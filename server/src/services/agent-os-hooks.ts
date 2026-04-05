/**
 * Agent OS Hooks — injected into the heartbeat execution pipeline.
 *
 * SAFETY DESIGN:
 * - This module is called from heartbeat.ts but is NOT inline in it
 * - Every hook is wrapped in try/catch — failures are logged, never propagated
 * - A feature flag (AGENT_OS_HOOKS_ENABLED env var) gates all hooks
 * - Each hook has an independent timeout to prevent blocking the execution pipeline
 * - If this module fails to import, heartbeat.ts continues unaffected
 *
 * ROLLBACK: Set AGENT_OS_HOOKS_ENABLED=false to disable all hooks instantly.
 * Or remove the two hook calls from heartbeat.ts (search for "agentOsHooks").
 */

import type { Db } from "@titanclip/db";
import { agentMemoryService } from "./agent-memory.js";
import { conversationService } from "./conversations.js";
import { skillProposerService } from "./skill-proposer.js";

const HOOKS_ENABLED = process.env.AGENT_OS_HOOKS_ENABLED !== "false";
const HOOK_TIMEOUT_MS = 5000; // Each hook gets max 5 seconds

interface PreExecutionContext {
  db: Db;
  agentId: string;
  companyId: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
}

interface PostExecutionContext {
  db: Db;
  agentId: string;
  companyId: string;
  runId: string;
  issueId?: string;
  issueTitle?: string;
  exitCode: number | null;
  summary?: string;
  resultContent?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Pre-execution hook: injects memory context into the execution config.
 *
 * Called BEFORE adapter.execute(). Modifies `context` in-place by adding
 * a `memoryContext` field that the universal_llm adapter reads.
 *
 * Returns the (possibly modified) context. If hook fails, returns context unchanged.
 */
export async function preExecutionHook(ctx: PreExecutionContext): Promise<Record<string, unknown>> {
  if (!HOOKS_ENABLED) return ctx.context;

  try {
    const result = await withTimeout(async () => {
      const memorySvc = agentMemoryService(ctx.db);
      const memoryContext = await memorySvc.buildMemoryContext(ctx.agentId, {
        maxTokenEstimate: 1500,
      });

      if (memoryContext) {
        return { ...ctx.context, memoryContext };
      }
      return ctx.context;
    }, HOOK_TIMEOUT_MS);

    return result;
  } catch (err) {
    console.warn("[AgentOS] preExecutionHook failed (continuing without memory):", safeErrorMessage(err));
    return ctx.context;
  }
}

/**
 * Post-execution hook: records conversation, extracts memories, analyzes for skills.
 *
 * Called AFTER adapter.execute() completes and results are recorded.
 * All operations are fire-and-forget — they don't block the heartbeat pipeline.
 */
export async function postExecutionHook(ctx: PostExecutionContext): Promise<void> {
  if (!HOOKS_ENABLED) return;

  // Run all post-hooks concurrently with individual timeouts
  // Each one is independent — failure of one doesn't affect others
  await Promise.allSettled([
    withTimeout(() => recordConversation(ctx), HOOK_TIMEOUT_MS).catch((err) =>
      console.warn("[AgentOS] recordConversation failed:", safeErrorMessage(err))
    ),
    withTimeout(() => extractMemories(ctx), HOOK_TIMEOUT_MS).catch((err) =>
      console.warn("[AgentOS] extractMemories failed:", safeErrorMessage(err))
    ),
    withTimeout(() => analyzeForSkills(ctx), HOOK_TIMEOUT_MS).catch((err) =>
      console.warn("[AgentOS] analyzeForSkills failed:", safeErrorMessage(err))
    ),
  ]);
}

// ── Individual post-execution hooks ───────────────────────────────────────

/**
 * Record the run as a conversation entry.
 * Creates or appends to an existing conversation for this agent+issue pair.
 */
async function recordConversation(ctx: PostExecutionContext): Promise<void> {
  if (!ctx.resultContent && !ctx.summary) return;

  const convSvc = conversationService(ctx.db);

  // Find or create conversation for this agent + issue
  let conversation;
  if (ctx.issueId) {
    const existing = await convSvc.list(ctx.companyId, {
      agentId: ctx.agentId,
      issueId: ctx.issueId,
      status: "active",
      limit: 1,
    });
    conversation = existing[0];
  }

  if (!conversation) {
    conversation = await convSvc.create(ctx.companyId, ctx.agentId, {
      title: ctx.issueTitle ?? `Run ${ctx.runId.slice(0, 8)}`,
      issueId: ctx.issueId,
    });
  }

  // Append the assistant's response
  const content = ctx.resultContent ?? ctx.summary ?? "(no output)";
  await convSvc.appendMessage(conversation.id, ctx.companyId, {
    role: "assistant",
    content,
    runId: ctx.runId,
    tokenCount: ctx.usage ? ctx.usage.inputTokens + ctx.usage.outputTokens : undefined,
  });
}

/**
 * Extract memories from a successful run.
 * Only extracts from runs that completed successfully.
 */
async function extractMemories(ctx: PostExecutionContext): Promise<void> {
  if (ctx.exitCode !== 0) return; // Only learn from successful runs
  if (!ctx.resultContent && !ctx.summary) return;

  const memorySvc = agentMemoryService(ctx.db);
  const content = ctx.resultContent ?? ctx.summary ?? "";

  // Extract basic project context from the issue
  if (ctx.issueId && ctx.issueTitle) {
    await memorySvc.upsert(ctx.agentId, ctx.companyId, {
      memoryType: "project_context",
      category: "recent_tasks",
      key: `issue:${ctx.issueId}`,
      content: `Worked on: ${ctx.issueTitle}`,
      importance: 3,
      sourceRunId: ctx.runId,
      sourceIssueId: ctx.issueId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 day TTL
    });
  }

  // Extract a "last run summary" memory
  if (content.length > 50) {
    const summaryText = content.slice(0, 500);
    await memorySvc.upsert(ctx.agentId, ctx.companyId, {
      memoryType: "learned_fact",
      category: "run_summaries",
      key: `run:${ctx.runId}`,
      content: summaryText,
      importance: 4,
      sourceRunId: ctx.runId,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day TTL
    });
  }
}

/**
 * Analyze a successful run for potential skill extraction.
 * This is a lightweight heuristic — full LLM-based analysis is Phase D+.
 */
async function analyzeForSkills(ctx: PostExecutionContext): Promise<void> {
  if (ctx.exitCode !== 0) return;
  if (!ctx.resultContent || ctx.resultContent.length < 200) return;

  // For now, just record that this run completed successfully.
  // Phase D's full implementation will analyze patterns across runs
  // and generate skill proposals using the configured LLM.
  //
  // The skill proposer service is ready to accept proposals:
  //   skillProposerService(ctx.db).propose(ctx.companyId, ctx.agentId, { ... })
  //
  // This will be connected when the LLM-based analysis is implemented.
}

// ── Helpers ──────────────────────────────────────────────────────────────

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Hook timed out after ${ms}ms`)), ms);
    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
