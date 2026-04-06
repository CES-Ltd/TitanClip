/**
 * Agent Chat Route — conversational chat with the team's main agent.
 *
 * Always uses the universal_llm execution path for direct LLM API calls,
 * regardless of the agent's CLI adapter type. The model/provider/baseUrl
 * are extracted from the agent's adapterConfig.
 *
 * Supports slash commands: /status, /create-issue, /agents, /help
 */

import { Router } from "express";
import type { Db } from "@titanclip/db";
import { agents, issues } from "@titanclip/db";
import { eq, and, ne } from "drizzle-orm";
import { getServerAdapter } from "../adapters/index.js";
import { conversationService } from "../services/conversations.js";
import { agentMemoryService } from "../services/agent-memory.js";
import { dashboardService } from "../services/dashboard.js";
import { chatterService } from "../services/chatter.js";
import { heartbeatService } from "../services/index.js";
import { logActivity } from "../services/activity-log.js";
import { queueIssueAssignmentWakeup, type IssueAssignmentWakeupDeps } from "../services/issue-assignment-wakeup.js";
import { assertCompanyAccess } from "./authz.js";

// ── Provider Base URL Defaults ───────────────────────────────────────────
const PROVIDER_BASE_URLS: Record<string, string> = {
  ollama: "http://localhost:11434/v1",
  ollama_local: "http://localhost:11434/v1",
  ollama_cloud: "https://ollama.com/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  azure: "",
  vertex: "",
  custom: "",
};

// ── Role Priority for Main Agent ─────────────────────────────────────────
const ROLE_PRIORITY = ["ceo", "cto", "cmo", "cfo", "pm", "engineer", "general"];

/**
 * Parse model string to extract provider and model name.
 * "ollama/kimi-k2.5:cloud" → { provider: "ollama", model: "kimi-k2.5:cloud" }
 * "gpt-4o" → { provider: "", model: "gpt-4o" }
 */
function parseModelString(modelStr: string): { provider: string; model: string } {
  if (!modelStr) return { provider: "", model: "" };
  const knownPrefixes = ["openai", "anthropic", "ollama", "ollama_cloud", "ollama_local", "openrouter", "gemini", "azure", "vertex", "custom"];
  const slashIdx = modelStr.indexOf("/");
  if (slashIdx > 0) {
    const prefix = modelStr.slice(0, slashIdx).toLowerCase();
    if (knownPrefixes.includes(prefix)) {
      return { provider: prefix, model: modelStr.slice(slashIdx + 1) };
    }
  }
  return { provider: "", model: modelStr };
}

/**
 * Build a config object suitable for the universal_llm execute function
 * from any adapter's config.
 */
function buildChatConfig(adapterConfig: Record<string, unknown>, httpAdapters?: any[]): Record<string, unknown> {
  const rawModel = (adapterConfig.model as string) ?? "";
  const parsed = parseModelString(rawModel);

  let provider = (adapterConfig.provider as string) || parsed.provider || "openai";
  let model = parsed.model || rawModel;
  let baseUrl = (adapterConfig.baseUrl as string) || "";
  let apiKey = (adapterConfig.apiKey as string) || "";

  // For agents: look up credentials from the matching httpAdapter
  if (httpAdapters?.length && (!apiKey || !baseUrl)) {
    // Find adapter matching the provider prefix from the model string
    const matchingAdapter = httpAdapters.find((a: any) =>
      a.enabled && a.provider === parsed.provider && a.models?.includes(parsed.model)
    ) ?? httpAdapters.find((a: any) => a.enabled && a.provider === parsed.provider)
      ?? httpAdapters.find((a: any) => a.enabled);

    if (matchingAdapter) {
      if (!apiKey && matchingAdapter.apiKey) apiKey = matchingAdapter.apiKey;
      if (!baseUrl && matchingAdapter.baseUrl) baseUrl = matchingAdapter.baseUrl;
      if (!provider || provider === "openai") provider = matchingAdapter.provider;
    }
  }

  // Env var fallback if still no API key after adapter config and httpAdapters
  if (!apiKey) {
    if (provider === "anthropic") {
      apiKey = process.env.ANTHROPIC_API_KEY || "";
    } else if (provider === "openai") {
      apiKey = process.env.OPENAI_API_KEY || "";
    } else if (provider === "openrouter") {
      apiKey = process.env.OPENROUTER_API_KEY || "";
    } else {
      apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "";
    }
  }

  if (!baseUrl) baseUrl = PROVIDER_BASE_URLS[provider] || "";

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    systemPrompt: (adapterConfig.systemPrompt as string) ?? undefined,
    temperature: adapterConfig.temperature as number | undefined,
    maxTokens: (adapterConfig.maxTokens as number) ?? 4096,
    autonomyLevel: "supervised",
    maxToolIterations: 5,
    maxCostPerRunUsd: 2.0,
    maxTokensPerRun: 200_000,
  };
}

/**
 * Find the "main" agent for a company — highest role priority.
 */
async function findMainAgent(db: Db, companyId: string) {
  const allAgents = await db
    .select()
    .from(agents)
    .where(and(
      eq(agents.companyId, companyId),
      ne(agents.status, "terminated"),
    ));

  if (allAgents.length === 0) return null;

  // Sort by role priority
  allAgents.sort((a, b) => {
    const aIdx = ROLE_PRIORITY.indexOf(a.role ?? "general");
    const bIdx = ROLE_PRIORITY.indexOf(b.role ?? "general");
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return allAgents[0]!;
}

export function agentChatRoutes(db: Db) {
  const router = Router();
  const convSvc = conversationService(db);
  const memorySvc = agentMemoryService(db);
  const dashSvc = dashboardService(db);
  const chatSvc = chatterService(db);
  const heartbeat = heartbeatService(db);

  router.post("/companies/:companyId/agents/:agentId/chat", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);

    const { message, conversationId, projectId, mentions } = req.body as {
      message: string;
      conversationId?: string;
      projectId?: string;
      mentions?: { issues?: string[]; agents?: string[] };
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

    // 2. Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendSSE = (data: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    // 3. Get or create conversation FIRST (so slash commands are also recorded)
    const issueTitle = message.slice(0, 100) + (message.length > 100 ? "..." : "");
    let conversation;
    if (conversationId) {
      conversation = await convSvc.getById(conversationId);
    }
    if (!conversation) {
      conversation = await convSvc.create(companyId, agentId, { title: issueTitle, projectId: projectId || undefined });
    }

    // Resolve effective projectId: use provided, or fall back to conversation's persisted project
    const effectiveProjectId = projectId || (conversation as any).projectId || null;

    // Persist project selection on conversation if changed
    if (projectId && projectId !== (conversation as any).projectId) {
      try {
        const { conversations: convTable } = await import("@titanclip/db");
        await db.update(convTable).set({ projectId } as any).where(eq(convTable.id, conversation.id));
      } catch { /* projectId column may not exist */ }
    }

    // 4. Record user message
    await convSvc.appendMessage(conversation.id, companyId, {
      role: "user",
      content: message,
    });

    sendSSE({ type: "start", conversationId: conversation.id });

    // 5. Check for slash commands
    const trimmedMsg = message.trim();
    if (trimmedMsg.startsWith("/")) {
      const spaceIdx = trimmedMsg.indexOf(" ");
      const command = spaceIdx > 0 ? trimmedMsg.slice(1, spaceIdx).toLowerCase() : trimmedMsg.slice(1).toLowerCase();
      const args = spaceIdx > 0 ? trimmedMsg.slice(spaceIdx + 1).trim() : "";

      let slashResponse = "";
      const slashSendSSE = (data: Record<string, unknown>) => {
        sendSSE(data);
        if (data.type === "chunk" && data.content) slashResponse += data.content as string;
      };

      try {
        await handleSlashCommand(command, args, { db, companyId, agentId, agent, projectId: effectiveProjectId, sendSSE: slashSendSSE, convSvc, dashSvc, chatSvc, heartbeat });
      } catch (err: any) {
        slashSendSSE({ type: "chunk", content: `Error: ${err.message}` });
        sendSSE({ type: "error", error: err.message });
      }

      // Record slash command response in conversation
      if (slashResponse) {
        await convSvc.appendMessage(conversation.id, companyId, {
          role: "assistant",
          content: slashResponse,
          metadata: { command },
        });
      }

      sendSSE({ type: "done", conversationId: conversation.id });
      res.end();
      return;
    }

    // 6. Regular chat — no auto issue creation
    const issueId: string | undefined = undefined;

    // 7. Build memory context
    let memoryContext = "";
    try {
      memoryContext = await memorySvc.buildMemoryContext(agentId, { maxTokenEstimate: 1500 });
    } catch { /* may not exist */ }

    // 8. Load conversation history
    const recentMessages = await convSvc.getMessages(conversation.id, { limit: 20 });
    const history = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    let fullContent = "";

    try {
      // 9. Fetch admin settings for credential resolution + validation
      let httpAdapters: any[] = [];
      let adminSettings: any = {};
      try {
        const { instanceSettingsService } = await import("../services/instance-settings.js");
        const settingsSvc = instanceSettingsService(db);
        adminSettings = await settingsSvc.getAdmin();
        httpAdapters = adminSettings.httpAdapters ?? [];
      } catch { /* ok */ }

      // 9a. Validate agent's adapter/model is still admin-allowed
      if (adminSettings.allowedAdapterTypes !== null && adminSettings.allowedAdapterTypes) {
        if (!adminSettings.allowedAdapterTypes.includes(agent.adapterType)) {
          throw new Error(`This agent's adapter type "${agent.adapterType}" has been disabled by admin. Please reconfigure the agent in settings.`);
        }
      }
      const adapterConfig = (agent.adapterConfig as Record<string, unknown>) ?? {};
      const rawModel = (adapterConfig.model as string) ?? "";
      if (rawModel && adminSettings.allowedModelsPerAdapter) {
        const modelAllowlist = adminSettings.allowedModelsPerAdapter[agent.adapterType];
        if (modelAllowlist !== null && modelAllowlist !== undefined && Array.isArray(modelAllowlist)) {
          // Strip provider prefix for comparison
          const parsed = parseModelString(rawModel);
          const modelName = parsed.model || rawModel;
          if (!modelAllowlist.includes(rawModel) && !modelAllowlist.includes(modelName)) {
            throw new Error(`Model "${rawModel}" has been disabled by admin for adapter "${agent.adapterType}". Please update the agent's model configuration.`);
          }
        }
      }

      const chatConfig = buildChatConfig(adapterConfig, httpAdapters);

      // Validate we have a model
      if (!chatConfig.model) {
        throw new Error("No LLM model configured for this agent. Set a model in the agent's adapter settings.");
      }

      // 9b. Inject project context if a project is selected
      if (effectiveProjectId) {
        const projectContext = await buildProjectContext(db, companyId, effectiveProjectId);
        if (projectContext) {
          chatConfig.systemPrompt = (chatConfig.systemPrompt ? chatConfig.systemPrompt + "\n\n" : "") + projectContext;
        }
      }

      // 9c. Resolve mention context (issues and agents)
      if (mentions) {
        const mentionContext = await resolveMentionContext(db, companyId, mentions);
        if (mentionContext) {
          chatConfig.systemPrompt = (chatConfig.systemPrompt ? chatConfig.systemPrompt + "\n\n" : "") + mentionContext;
        }
      }

      // 9d. Inject team context, available templates, and tool instructions
      try {
        const { instanceSettingsService: issSvc } = await import("../services/instance-settings.js");
        const templates = await issSvc(db).getAvailableTemplates();

        // Get existing team members to prevent duplicate hires
        const teamAgents = await db.select().from(agents).where(
          and(eq(agents.companyId, companyId), ne(agents.status, "terminated"))
        );
        const filledRoles = [...new Set(teamAgents.map((a) => a.role))];
        const teamList = teamAgents.map((a) => `- ${a.name} (${a.role}) — ${a.status}`).join("\n");

        let instructions = `## Your Role
You are the Team Lead (CEO) agent. You orchestrate work across the team. When the user describes a project or task:
1. **Break it down** into specific sub-tasks automatically
2. **Create issues** for each sub-task using delegate_to_agent (assigns to existing agents)
3. **Hire agents** if the required role doesn't exist on the team (use hire_agent with template names ONLY)
4. **Track progress** by reading issues and posting updates

## Current Team
${teamList || "No agents hired yet."}
${filledRoles.length > 0 ? `Filled roles: ${filledRoles.join(", ")}` : ""}
`;

        if (templates.length > 0) {
          const templateList = templates.map((t: any) => `- ${t.name} (${t.role})`).join("\n");
          instructions += `\n## Available Templates for Hiring
ONLY these templates can be hired. Do NOT invent roles outside this list:
${templateList}
`;
        }

        instructions += `\n## Orchestration Rules
- When the user describes work, IMMEDIATELY break it into concrete tasks and create issues using delegate_to_agent for EACH task.
- Each issue must have a clear title, detailed description, and be assigned to the right agent by name.
- If no agent exists for a required role, hire one FIRST using hire_agent, then delegate the task to them.
- Hires are auto-approved — the agent becomes active immediately. Always create an issue for them right after hiring.
- Agent names are unique (ROLE_UUID format). Always use the exact agent name when delegating.
- Use post_to_chatter to announce project kickoffs, milestones, and completions.
- Use update_issue_status to track progress: todo → in_progress → in_review → done.
- Use add_issue_comment to add context, blockers, or decisions to issues.
- NEVER just list tasks in text — always create actual issues using the tools.`;

        chatConfig.systemPrompt = (chatConfig.systemPrompt ? chatConfig.systemPrompt + "\n\n" : "") + instructions;
      } catch { /* templates may not exist */ }

      // 10. Import and call universal_llm execute directly
      const llmExecute = getServerAdapter("universal_llm").execute;

      const result = await llmExecute({
        runId: `chat-${Date.now()}`,
        agent: {
          id: agent.id,
          companyId: agent.companyId,
          name: agent.name,
          adapterType: "universal_llm",
          adapterConfig: chatConfig,
        },
        runtime: {
          sessionId: conversation.id,
          sessionParams: { history },
          sessionDisplayId: conversation.title ?? "chat",
          taskKey: `chat:${conversation.id}`,
        },
        config: chatConfig,
        context: {
          userMessage: message,
          memoryContext,
          conversationId: conversation.id,
          issueId,
        },
        onLog: async (stream, chunk) => {
          if (!chunk) return;
          if (stream === "stdout") {
            // Check if it's a structured tool call log
            if (chunk.startsWith("[tool] ") || chunk.startsWith("[result] ") || chunk.startsWith("[blocked] ") || chunk.startsWith("[error] ") || chunk.startsWith("[approval_needed] ")) {
              if (chunk.startsWith("[tool] ")) {
                const match = chunk.match(/^\[tool\] (\w+)\((.+)\)$/);
                if (match) {
                  const toolId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  sendSSE({ type: "tool_start", id: toolId, name: match[1], args: match[2] });
                  // Log to chatter for team awareness
                  chatSvc.postMessage(companyId, {
                    body: `${agent.name} is executing **${match[1]}**`,
                    channel: "agent-activity",
                    messageType: "tool_call",
                    metadata: { agentId, toolName: match[1], issueId },
                  }).catch(() => {});
                  return;
                }
              }
              if (chunk.startsWith("[result] ")) {
                const resultText = chunk.slice(9).replace(/\n$/, "");
                sendSSE({ type: "tool_result", result: resultText });

                // Process structured tool actions from result JSON
                processToolAction(db, resultText, {
                  companyId, agentId, agent, httpAdapters, sendSSE, chatSvc, heartbeat, projectId: effectiveProjectId,
                }).catch((e) => console.warn("[paperclip] Tool action error:", e.message));

                // Log result to chatter
                chatSvc.postMessage(companyId, {
                  body: `${agent.name} completed tool: ${resultText.slice(0, 120)}`,
                  channel: "agent-activity",
                  messageType: "tool_result",
                  metadata: { agentId, result: resultText.slice(0, 500) },
                }).catch(() => {});
                return;
              }
              if (chunk.startsWith("[approval_needed] ")) {
                sendSSE({ type: "status", content: chunk });
                return;
              }
              sendSSE({ type: "status", content: chunk });
              return;
            }
            // Skip internal markers
            if (chunk.includes("--- Tool calls") || chunk.includes("--- End tool calls")) {
              return;
            }
            fullContent += chunk;
            sendSSE({ type: "chunk", content: chunk });
          } else if (stream === "stderr") {
            sendSSE({ type: "status", content: chunk });
          }
        },
      });

      // Handle failed execution
      if (result.exitCode !== 0 && !fullContent) {
        const errorMsg = result.errorMessage || "LLM execution failed";
        fullContent = `Error: ${errorMsg}`;
        sendSSE({ type: "chunk", content: fullContent });
      }

      const responseContent = fullContent || (result.resultJson as any)?.content || result.summary || "(no response)";

      // 11. Record assistant response
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

      // 12. Log activity
      await logActivity(db, {
        companyId,
        actorType: "agent",
        actorId: agentId,
        agentId,
        action: result.exitCode === 0 ? "agent.chat.completed" : "agent.chat.failed",
        entityType: "conversation",
        entityId: conversation.id,
        details: {
          issueId,
          model: result.model,
          provider: result.provider,
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          costUsd: result.costUsd,
        },
      });

      // 12b. Persist cost event for budget tracking
      if (result.costUsd && result.costUsd > 0) {
        try {
          const { costEvents } = await import("@titanclip/db");
          await db.insert(costEvents).values({
            companyId,
            agentId,
            kind: "llm_inference",
            amountCents: Math.round(result.costUsd * 100),
            model: result.model ?? "unknown",
            provider: result.provider ?? "unknown",
            inputTokens: result.usage?.inputTokens ?? 0,
            outputTokens: result.usage?.outputTokens ?? 0,
          } as any);
        } catch { /* cost table may not exist or schema mismatch — best effort */ }
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
        } catch { /* best effort */ }
      }

      sendSSE({
        type: "done",
        conversationId: conversation.id,
        issueId,
        usage: result.usage,
        model: result.model,
        provider: result.provider,
        costUsd: result.costUsd,
        exitCode: result.exitCode,
      });
    } catch (err: any) {
      console.error("[AgentChat] Execution error:", err.message);
      if (!fullContent) {
        sendSSE({ type: "chunk", content: `Error: ${err.message}` });
      }
      sendSSE({ type: "error", error: err.message });
      sendSSE({ type: "done", conversationId: conversation.id, issueId, exitCode: 1, error: err.message });

      // Record error in conversation
      try {
        await convSvc.appendMessage(conversation.id, companyId, {
          role: "assistant",
          content: `Error: ${err.message}`,
          metadata: { error: true },
        });
      } catch { /* best effort */ }
    }

    res.end();
  });

  // ── Main Agent Endpoint ──────────────────────────────────────────────
  router.get("/companies/:companyId/main-agent", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const mainAgent = await findMainAgent(db, companyId);
    if (!mainAgent) {
      res.status(404).json({ error: "No active agents found" });
      return;
    }
    res.json(mainAgent);
  });

  return router;
}

// ── Project Context Builder ──────────────────────────────────────────────

async function buildProjectContext(db: Db, companyId: string, projectId: string): Promise<string | null> {
  try {
    const { projects } = await import("@titanclip/db");
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return null;

    // Get recent issues for this project
    const projectIssues = await db
      .select()
      .from(issues)
      .where(and(eq(issues.companyId, companyId), eq(issues.projectId, projectId)))
      .limit(15);

    const issueList = projectIssues.length > 0
      ? projectIssues.map((i) => `- [${i.status}] ${i.title}`).join("\n")
      : "No issues yet.";

    const codebase = (project as any).codebase;
    const repoInfo = codebase?.repoUrl || codebase?.localFolder || codebase?.effectiveLocalFolder || "Not configured";

    return `## Active Project: ${project.name}
${project.description ? `Description: ${project.description}` : ""}
Status: ${project.status}
Codebase: ${repoInfo}

Recent issues in this project:
${issueList}`;
  } catch {
    return null;
  }
}

// ── LLM Helper for Slash Commands ────────────────────────────────────────

async function runSlashLLM(ctx: SlashContext, systemPrompt: string, userQuery: string) {
  // Fetch httpAdapters for credential resolution
  let httpAdapters: any[] = [];
  try {
    const { instanceSettingsService } = await import("../services/instance-settings.js");
    const svc = instanceSettingsService(ctx.db);
    const admin = await svc.getAdmin();
    httpAdapters = (admin as any).httpAdapters ?? [];
  } catch { /* ok */ }

  const adapterConfig = (ctx.agent.adapterConfig as Record<string, unknown>) ?? {};
  const chatConfig = buildChatConfig(adapterConfig, httpAdapters);
  chatConfig.systemPrompt = systemPrompt;

  // Inject project context if available
  if (ctx.projectId) {
    const projectCtx = await buildProjectContext(ctx.db, ctx.companyId, ctx.projectId);
    if (projectCtx) {
      chatConfig.systemPrompt += "\n\n" + projectCtx;
    }
  }

  const llmExec = getServerAdapter("universal_llm").execute;
  await llmExec({
    runId: `cmd-${Date.now()}`,
    agent: { id: ctx.agentId, companyId: ctx.companyId, name: ctx.agent.name, adapterType: "universal_llm", adapterConfig: chatConfig },
    runtime: { sessionId: `cmd-${Date.now()}`, sessionParams: {}, sessionDisplayId: "command", taskKey: `cmd:${Date.now()}` },
    config: chatConfig,
    context: { userMessage: userQuery },
    onLog: async (stream, chunk) => {
      if (stream === "stdout" && chunk && !chunk.startsWith("[tool]") && !chunk.startsWith("[result]") && !chunk.includes("--- Tool calls")) {
        ctx.sendSSE({ type: "chunk", content: chunk });
      }
    },
  });
}

// ── Slash Command Handler ────────────────────────────────────────────────

interface SlashContext {
  db: Db;
  companyId: string;
  agentId: string;
  agent: any;
  projectId?: string;
  sendSSE: (data: Record<string, unknown>) => void;
  convSvc: ReturnType<typeof conversationService>;
  dashSvc: ReturnType<typeof dashboardService>;
  chatSvc: ReturnType<typeof chatterService>;
  heartbeat: IssueAssignmentWakeupDeps;
}

async function handleSlashCommand(command: string, args: string, ctx: SlashContext) {
  switch (command) {
    case "help":
      return cmdHelp(ctx);
    case "status":
      return cmdStatus(args, ctx);
    case "create-issue":
      return cmdCreateIssue(args, ctx);
    case "agents":
      return cmdAgents(ctx);
    case "review":
      return cmdReview(args, ctx);
    case "plan":
      return cmdPlan(args, ctx);
    default:
      ctx.sendSSE({ type: "chunk", content: `Unknown command: /${command}\n\nType /help for available commands.` });
  }
}

function cmdHelp(ctx: SlashContext) {
  ctx.sendSSE({
    type: "chunk",
    content: `**Available Commands**

| Command | Description |
|---------|-------------|
| \`/status [question]\` | Team status summary. Add a question for contextual analysis. |
| \`/create-issue <description>\` | Create a new issue from description. |
| \`/agents\` | List all agents with their roles and status. |
| \`/review [question]\` | Review recent activity, progress, and accomplishments. |
| \`/plan <description>\` | Break down a task into actionable steps with ownership. |
| \`/help\` | Show this help message. |

Select a project with the project picker to scope commands to that project.`,
  });
}

async function cmdStatus(question: string, ctx: SlashContext) {
  const [summary, recentChatter] = await Promise.all([
    ctx.dashSvc.summary(ctx.companyId),
    ctx.chatSvc.listMessages(ctx.companyId, "general", undefined, 15),
  ]);

  const agentsList = await ctx.db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, ctx.companyId), ne(agents.status, "terminated")));

  const agentSummary = agentsList.map((a) => `- **${a.name}** (${a.role}) — ${a.status}`).join("\n");
  const chatterSummary = recentChatter.length > 0
    ? recentChatter.slice(0, 10).map((m: any) => `- ${m.body?.slice(0, 100)}`).join("\n")
    : "No recent team chatter.";

  if (!question) {
    ctx.sendSSE({
      type: "chunk",
      content: `**Team Status**

**Agents** (${summary.agents.active + summary.agents.running} active, ${summary.agents.paused} paused, ${summary.agents.error} errors)
${agentSummary}

**Tasks** — ${summary.tasks.open} open, ${summary.tasks.inProgress} in progress, ${summary.tasks.blocked} blocked, ${summary.tasks.done} done

**Costs** — $${(summary.costs.monthSpendCents / 100).toFixed(2)} / $${(summary.costs.monthBudgetCents / 100).toFixed(2)} budget (${summary.costs.monthUtilizationPercent.toFixed(0)}%)

**Pending Approvals** — ${summary.pendingApprovals}

**Recent Chatter**
${chatterSummary}`,
    });
    return;
  }

  const contextBlock = `Team dashboard:
- Active agents: ${summary.agents.active + summary.agents.running}
- Open tasks: ${summary.tasks.open}, in progress: ${summary.tasks.inProgress}, blocked: ${summary.tasks.blocked}
- Month spend: $${(summary.costs.monthSpendCents / 100).toFixed(2)}
- Pending approvals: ${summary.pendingApprovals}

Agents:
${agentSummary}

Recent chatter:
${chatterSummary}`;

  await runSlashLLM(ctx,
    `You are a team operations analyst for an AI-powered engineering team. Based on the team data below, provide a concise, actionable answer to the user's question. Focus on blockers, agents that need attention, budget concerns, and actionable next steps. Be specific with numbers and agent names. Use markdown formatting.

## Team Data
${contextBlock}`,
    question
  );
}

async function cmdCreateIssue(description: string, ctx: SlashContext) {
  if (!description.trim()) {
    ctx.sendSSE({ type: "chunk", content: "Usage: `/create-issue <description>`\n\nDescribe what needs to be done. Select a project using the project picker first." });
    return;
  }

  // Require a project
  let resolvedProjectId = ctx.projectId;
  let projectName = "";

  if (!resolvedProjectId) {
    // Try to find a default project
    try {
      const { projects } = await import("@titanclip/db");
      const allProjects = await ctx.db.select().from(projects).where(eq(projects.companyId, ctx.companyId)).limit(5);
      if (allProjects.length === 1) {
        // Auto-select the only project
        resolvedProjectId = allProjects[0]!.id;
        projectName = allProjects[0]!.name;
      } else if (allProjects.length > 1) {
        const projectList = allProjects.map((p: any) => `- **${p.name}**`).join("\n");
        ctx.sendSSE({
          type: "chunk",
          content: `Please select a project using the project picker before creating an issue.\n\n**Available projects:**\n${projectList}`,
        });
        return;
      } else {
        ctx.sendSSE({ type: "chunk", content: "No projects found. Create a project first before creating issues." });
        return;
      }
    } catch {
      ctx.sendSSE({ type: "chunk", content: "Please select a project using the project picker before creating an issue." });
      return;
    }
  } else {
    // Get project name for the card
    try {
      const { projects } = await import("@titanclip/db");
      const [proj] = await ctx.db.select().from(projects).where(eq(projects.id, resolvedProjectId));
      if (proj) projectName = proj.name;
    } catch { /* ok */ }
  }

  const title = description.length > 80 ? description.slice(0, 77) + "..." : description;

  // Auto-assign to the best available agent (auto-assignment logic)
  let assigneeAgentId: string | null = null;
  let assigneeName = "";
  try {
    const availableAgents = await ctx.db
      .select()
      .from(agents)
      .where(and(
        eq(agents.companyId, ctx.companyId),
        ne(agents.status, "terminated"),
      ));

    if (availableAgents.length > 0) {
      // Count open issues per agent for workload balancing
      const agentIssues = await ctx.db
        .select({ assigneeAgentId: issues.assigneeAgentId })
        .from(issues)
        .where(and(
          eq(issues.companyId, ctx.companyId),
          ne(issues.status, "done"),
          ne(issues.status, "cancelled"),
        ));

      const workload = new Map<string, number>();
      for (const i of agentIssues) {
        if (i.assigneeAgentId) {
          workload.set(i.assigneeAgentId, (workload.get(i.assigneeAgentId) ?? 0) + 1);
        }
      }

      // Prefer engineers/workers over CEO, then pick the least loaded
      const workerRoles = ["engineer", "cto", "devops", "pm", "general"];
      const workers = availableAgents.filter((a) => workerRoles.includes(a.role ?? ""));
      const candidates = workers.length > 0 ? workers : availableAgents;

      // Sort by workload (ascending) — assign to least busy agent
      candidates.sort((a, b) => (workload.get(a.id) ?? 0) - (workload.get(b.id) ?? 0));
      const chosen = candidates[0]!;
      assigneeAgentId = chosen.id;
      assigneeName = chosen.name;
    }
  } catch { /* auto-assign is best-effort */ }

  try {
    const [newIssue] = await ctx.db.insert(issues).values({
      companyId: ctx.companyId,
      title,
      description,
      status: assigneeAgentId ? "todo" : "backlog",
      priority: "medium",
      originKind: "manual",
      createdByUserId: "local-board",
      projectId: resolvedProjectId,
      assigneeAgentId,
    }).returning();

    // Add instruction comment for the assigned agent
    if (assigneeAgentId && assigneeName) {
      try {
        const { issueComments } = await import("@titanclip/db");
        await ctx.db.insert(issueComments).values({
          companyId: ctx.companyId,
          issueId: newIssue.id,
          body: `**@${assigneeName}** — You have been assigned this task. Please start working on it immediately.\n\n**Task:** ${description}\n\n**Instructions:**\n1. Review the task description above\n2. Update this issue status to \`in_progress\` when you begin\n3. Post progress updates as comments on this issue\n4. Update status to \`done\` when complete`,
          authorAgentId: ctx.agentId,
        });
      } catch { /* ok */ }
    }

    await logActivity(ctx.db, {
      companyId: ctx.companyId,
      actorType: "user",
      actorId: "local-board",
      action: "issue.created",
      entityType: "issue",
      entityId: newIssue.id,
      details: { title, origin: "paperclip_chat_command", projectId: resolvedProjectId },
    });

    // Wake the assigned agent so it starts working on the task
    if (assigneeAgentId) {
      void queueIssueAssignmentWakeup({
        heartbeat: ctx.heartbeat,
        issue: { id: newIssue.id, assigneeAgentId, status: "todo" },
        reason: "issue_assigned",
        mutation: "create",
        contextSource: "agent_chat.create_issue_command",
        requestedByActorType: "user",
        requestedByActorId: "local-board",
      });
    }

    // Send structured issue card event
    ctx.sendSSE({
      type: "issue_created",
      issue: {
        id: newIssue.id,
        identifier: newIssue.identifier ?? newIssue.id.slice(0, 8),
        title: newIssue.title,
        description: description.slice(0, 120) + (description.length > 120 ? "..." : ""),
        status: assigneeAgentId ? "todo" : "backlog",
        priority: "medium",
        projectName: projectName || undefined,
        assignee: assigneeName || undefined,
      },
    });

    // Also send as chunk for conversation recording
    const assigneeText = assigneeName ? ` Assigned to **${assigneeName}**.` : "";
    ctx.sendSSE({
      type: "chunk",
      content: `Issue **${newIssue.identifier ?? newIssue.id.slice(0, 8)}** created: "${newIssue.title}" in project ${projectName || "default"}.${assigneeText}`,
    });
  } catch (err: any) {
    ctx.sendSSE({
      type: "issue_error",
      error: err.message,
      description,
    });
    ctx.sendSSE({ type: "chunk", content: `Failed to create issue: ${err.message}` });
  }
}

async function cmdAgents(ctx: SlashContext) {
  const agentsList = await ctx.db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, ctx.companyId), ne(agents.status, "terminated")));

  if (agentsList.length === 0) {
    ctx.sendSSE({ type: "chunk", content: "No active agents found." });
    return;
  }

  const rows = agentsList.map((a) => {
    const config = (a.adapterConfig as any) ?? {};
    const model = config.model ?? "—";
    return `| ${a.name} | ${a.role} | ${a.status} | ${a.adapterType} | ${model} |`;
  }).join("\n");

  ctx.sendSSE({
    type: "chunk",
    content: `**Team Agents**\n\n| Name | Role | Status | Adapter | Model |\n|------|------|--------|---------|-------|\n${rows}`,
  });
}

async function cmdReview(question: string, ctx: SlashContext) {
  // Gather recent activity and issues
  const recentIssues = await ctx.db
    .select()
    .from(issues)
    .where(eq(issues.companyId, ctx.companyId))
    .limit(20);

  const issuesByStatus: Record<string, string[]> = {};
  for (const issue of recentIssues) {
    const bucket = issue.status ?? "unknown";
    if (!issuesByStatus[bucket]) issuesByStatus[bucket] = [];
    issuesByStatus[bucket]!.push(issue.title);
  }

  const issueContext = Object.entries(issuesByStatus)
    .map(([status, titles]) => `${status}: ${titles.map((t) => `"${t}"`).join(", ")}`)
    .join("\n");

  const recentChatter = await ctx.chatSvc.listMessages(ctx.companyId, "general", undefined, 10);
  const chatterContext = recentChatter.length > 0
    ? recentChatter.map((m: any) => `- ${m.body?.slice(0, 120)}`).join("\n")
    : "No recent chatter.";

  const userQuery = question || "Give me a sprint review summary. What got done, what's in progress, and what are the risks?";

  await runSlashLLM(ctx,
    `You are a sprint review analyst for an AI-powered engineering team. Based on the recent activity and issue data below, provide a clear, concise review. Highlight accomplishments, work in progress, blockers, and risks. Recommend next steps. Use markdown formatting.

## Recent Issues
${issueContext}

## Recent Team Chatter
${chatterContext}`,
    userQuery
  );
}

async function cmdPlan(description: string, ctx: SlashContext) {
  if (!description.trim()) {
    ctx.sendSSE({ type: "chunk", content: "Usage: `/plan <description>`\n\nDescribe what you want to build or accomplish." });
    return;
  }

  // Get available agents for assignment suggestions
  const agentsList = await ctx.db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, ctx.companyId), ne(agents.status, "terminated")));

  const agentRoles = agentsList.map((a) => `- ${a.name} (${a.role})`).join("\n");

  await runSlashLLM(ctx,
    `You are a project planner for an AI-powered engineering team. Break down the user's request into actionable tasks. For each task suggest:
1. A clear, concise title
2. Priority (critical/high/medium/low)
3. Which team member should own it (based on their role)
4. Brief description of what needs to be done

Format as a numbered list with clear ownership. Be practical and specific.

## Available Team Members
${agentRoles}`,
    description
  );
}

// ── Mention Context Resolution ───────────────────────────────────────────

async function resolveMentionContext(
  db: Db,
  companyId: string,
  mentions: { issues?: string[]; agents?: string[] }
): Promise<string | null> {
  const parts: string[] = [];

  // Resolve issue mentions
  if (mentions.issues?.length) {
    for (const identifier of mentions.issues.slice(0, 5)) {
      try {
        const [issue] = await db
          .select()
          .from(issues)
          .where(and(eq(issues.companyId, companyId), eq(issues.identifier, identifier)))
          .limit(1);
        if (issue) {
          // Try to get recent comments
          let commentsText = "";
          try {
            const { issueComments } = await import("@titanclip/db");
            const comments = await db
              .select()
              .from(issueComments)
              .where(eq(issueComments.issueId, issue.id))
              .limit(5);
            if (comments.length > 0) {
              commentsText = "\nRecent comments:\n" + comments.map((c: any) => `- ${c.body?.slice(0, 150)}`).join("\n");
            }
          } catch { /* comments table may not exist */ }

          parts.push(`## Referenced Issue: ${identifier}
Title: ${issue.title}
Status: ${issue.status}
Priority: ${issue.priority}
${issue.description ? `Description: ${issue.description.slice(0, 500)}` : ""}
Assignee: ${issue.assigneeAgentId ? "Agent assigned" : "Unassigned"}${commentsText}`);
        }
      } catch { /* skip unresolvable */ }
    }
  }

  // Resolve agent mentions
  if (mentions.agents?.length) {
    for (const agentMentionId of mentions.agents.slice(0, 3)) {
      try {
        const [mentionedAgent] = await db
          .select()
          .from(agents)
          .where(eq(agents.id, agentMentionId));
        if (mentionedAgent) {
          // Get agent's current tasks
          const agentIssues = await db
            .select()
            .from(issues)
            .where(and(
              eq(issues.companyId, companyId),
              eq(issues.assigneeAgentId, agentMentionId),
              ne(issues.status, "done"),
              ne(issues.status, "cancelled"),
            ))
            .limit(5);

          const taskList = agentIssues.length > 0
            ? agentIssues.map((i) => `- [${i.status}] ${i.title}`).join("\n")
            : "No active tasks.";

          parts.push(`## Mentioned Agent: @${mentionedAgent.name}
Role: ${mentionedAgent.role}
Status: ${mentionedAgent.status}
Current tasks:
${taskList}

The user mentioned this agent. If the message is a task or request, consider delegating to this agent by creating an issue assigned to them. If it's a question about their work, answer based on their current tasks and status.`);
        }
      } catch { /* skip unresolvable */ }
    }
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

// ── Auto-Hire Processing ─────────────────────────────────────────────────

async function processHireFromToolResult(
  db: Db,
  resultText: string,
  ctx: ToolActionCtx
) {
  let parsed: any;
  try {
    parsed = JSON.parse(resultText);
  } catch {
    return;
  }
  if (parsed.action !== "hire_agent") return;

  const templateName = parsed.templateName as string;
  const reason = parsed.reason as string;
  if (!templateName || !reason) return;

  // Look up template
  const { instanceSettingsService } = await import("../services/instance-settings.js");
  const settingsSvc = instanceSettingsService(db);
  const templates = await settingsSvc.getAvailableTemplates();
  const template = templates.find((t: any) => t.name.toLowerCase() === templateName.toLowerCase());

  if (!template) {
    // Only hire from available templates
    const templateNames = templates.map((t: any) => t.name).join(", ");
    ctx.sendSSE({ type: "chunk", content: `Template "${templateName}" not found. Available templates: ${templateNames}` });
    return;
  }

  // Check if an agent with this role already exists (prevent duplicate hires)
  const { agents: existingAgentsTable } = await import("@titanclip/db");
  const existingAgents = await db.select().from(existingAgentsTable).where(
    and(eq(existingAgentsTable.companyId, ctx.companyId), ne(existingAgentsTable.status, "terminated"))
  );
  const roleAlreadyFilled = existingAgents.some((a) =>
    a.role === template.role && !a.name.includes("(auto-hired)")
  );
  if (roleAlreadyFilled) {
    const existingAgent = existingAgents.find((a) => a.role === template.role);
    ctx.sendSSE({
      type: "chunk",
      content: `Role "${template.role}" is already filled by **${existingAgent?.name}**. Skipping duplicate hire. Consider delegating tasks to the existing agent instead.`,
    });
    return;
  }

  // Determine adapter: inherit main agent's config
  const experimental = await settingsSvc.getExperimental();
  // Inherit the hiring agent's adapter config for the new hire
  const mainConfig = (ctx.agent.adapterConfig as Record<string, unknown>) ?? {};
  let hireAdapterType: string = ctx.agent.adapterType ?? "opencode_local";
  let hireAdapterConfig: Record<string, unknown> = { ...mainConfig };

  // Generate unique name: TemplateName_UUID
  const shortId = crypto.randomUUID().slice(0, 8);
  const templateLabel = (template.name || template.role || "Agent").replace(/\s+/g, "_");
  const agentName = `${templateLabel}_${shortId}`;

  // Build instructions root path
  const { join } = await import("path");
  const instructionsRoot = join(
    process.env.HOME || "/tmp",
    ".titanclip", "instances", "default", "agents", agentName
  );

  // Set instructions path in adapter config
  hireAdapterConfig.instructionsRootPath = instructionsRoot;

  const { agents: agentsTable } = await import("@titanclip/db");
  const [newAgent] = await db.insert(agentsTable).values({
    companyId: ctx.companyId,
    name: agentName,
    title: template.name,
    role: template.role || "general",
    status: "idle",
    adapterType: hireAdapterType,
    adapterConfig: hireAdapterConfig,
    runtimeConfig: { heartbeat: { enabled: true, intervalSeconds: 3600, wakeOnDemand: true, maxConcurrentRuns: 1 } },
    budgetMonthlyCents: parsed.budgetMonthlyCents ?? template.defaultBudgetMonthlyCents ?? 0,
    reportsTo: ctx.agentId,
  }).returning();

  // Write template instructions (SOUL.md, HEARTBEAT.md, AGENTS.md)
  try {
    const { mkdirSync, writeFileSync } = await import("fs");
    mkdirSync(instructionsRoot, { recursive: true });
    if (template.soulMd) writeFileSync(join(instructionsRoot, "SOUL.md"), template.soulMd, "utf-8");
    if (template.heartbeatMd) writeFileSync(join(instructionsRoot, "HEARTBEAT.md"), template.heartbeatMd, "utf-8");

    // Write AGENTS.md — template-specific or generate from role
    const agentsMd = template.agentsMd || `# ${template.name}\n\nRole: ${template.role}\n\n## Responsibilities\n\nYou are a ${template.name} agent. Follow your SOUL.md principles and HEARTBEAT.md priorities.\n\n## Tools Available\n\nUse the tools provided to accomplish your tasks. Report progress via issue comments and chatter.`;
    writeFileSync(join(instructionsRoot, "AGENTS.md"), agentsMd, "utf-8");
  } catch (e) {
    console.warn("[paperclip] Failed to write instructions:", (e as Error).message);
  }

  // Log activity
  await logActivity(db, {
    companyId: ctx.companyId,
    actorType: "agent",
    actorId: ctx.agentId,
    agentId: ctx.agentId,
    action: "agent.autonomous_hire",
    entityType: "agent",
    entityId: newAgent.id,
    details: {
      reason,
      templateName: template.name,
      hiredAgentName: agentName,
      adapterType: hireAdapterType,
      model: (hireAdapterConfig.model as string) ?? "",
    },
  });

  // Auto-approve → notify → create issue → assign
  ctx.sendSSE({
    type: "chunk",
    content: `Hired **${agentName}** (${template.role}) with ${hireAdapterType} adapter. Agent is now active.`,
  });

  // Post hire to chatter for team awareness
  ctx.chatSvc.postMessage(ctx.companyId, {
    body: `**${ctx.agent.name}** hired **${agentName}** (${template.role}). Reason: ${reason}. Agent is now active.`,
    channel: "general",
    messageType: "hire_completed",
    metadata: { agentId: ctx.agentId, hiredAgentId: newAgent.id, templateName: template.name },
  }).catch(() => {});

  // Create initial issue assigned to the new agent in the active project
  try {
    const issueTitle = reason.length > 80 ? reason.slice(0, 77) + "..." : reason;
    const [hireIssue] = await db.insert(issues).values({
      companyId: ctx.companyId,
      title: issueTitle,
      description: `Hired for: ${reason}\n\nTemplate: ${template.name}\nRole: ${template.role}`,
      status: "todo",
      priority: "medium",
      assigneeAgentId: newAgent.id,
      projectId: ctx.projectId || null,
      originKind: "manual",
      createdByUserId: "local-board",
    }).returning();

    try {
      const { issueComments } = await import("@titanclip/db");
      await db.insert(issueComments).values({
        companyId: ctx.companyId,
        issueId: hireIssue.id,
        body: `**@${agentName}** — Welcome to the team! You have been hired and assigned your first task.\n\n**Task:** ${reason}\n\n**Instructions:**\n1. Start working on this task immediately\n2. Update this issue status to \`in_progress\`\n3. Post progress updates as comments on this issue\n4. Use \`post_to_chatter\` to notify the team of important updates\n5. Update status to \`done\` when the task is complete\n\n_Assigned by ${ctx.agent.name}_`,
        authorAgentId: ctx.agentId,
      });
    } catch { /* ok */ }

    ctx.sendSSE({
      type: "issue_created",
      issue: {
        id: hireIssue.id,
        identifier: hireIssue.identifier ?? hireIssue.id.slice(0, 8),
        title: hireIssue.title,
        description: reason.slice(0, 120),
        status: "todo",
        priority: "medium",
        assignee: agentName,
      },
    });

    // Wake the newly hired agent so it starts working on its first task
    void queueIssueAssignmentWakeup({
      heartbeat: ctx.heartbeat,
      issue: { id: hireIssue.id, assigneeAgentId: newAgent.id, status: "todo" },
      reason: "issue_assigned",
      mutation: "create",
      contextSource: "agent_chat.hire",
      requestedByActorType: "agent",
      requestedByActorId: ctx.agentId,
    });

    await logActivity(db, {
      companyId: ctx.companyId,
      actorType: "agent",
      actorId: ctx.agentId,
      action: "issue.created",
      entityType: "issue",
      entityId: hireIssue.id,
      details: { title: issueTitle, assignee: agentName, origin: "paperclip_auto_hire" },
    });
  } catch (e) {
    console.warn("[paperclip] Failed to create issue for hired agent:", (e as Error).message);
  }
}

// ── Unified Tool Action Processor ────────────────────────────────────────

interface ToolActionCtx {
  companyId: string;
  agentId: string;
  agent: any;
  httpAdapters: any[];
  sendSSE: (data: Record<string, unknown>) => void;
  chatSvc: ReturnType<typeof chatterService>;
  heartbeat: IssueAssignmentWakeupDeps;
  projectId?: string | null;
}

async function processToolAction(db: Db, resultText: string, ctx: ToolActionCtx) {
  let parsed: any;
  try {
    parsed = JSON.parse(resultText);
  } catch {
    return; // Not structured JSON — skip
  }

  const action = parsed.action as string;
  if (!action) return;

  switch (action) {
    case "hire_agent":
      return processHireFromToolResult(db, resultText, ctx);

    case "delegate_to_agent":
      return processDelegateAction(db, parsed, ctx);

    case "update_issue_status":
      return processUpdateIssue(db, parsed, ctx);

    case "add_issue_comment":
      return processIssueComment(db, parsed, ctx);

    case "post_to_chatter":
      return processPostChatter(db, parsed, ctx);

    case "read_issue":
      return processReadIssue(db, parsed, ctx);

    case "list_team_agents":
      return processListAgents(db, ctx);
  }
}

// ── Delegate to Agent ────────────────────────────────────────────────────

async function processDelegateAction(db: Db, parsed: any, ctx: ToolActionCtx) {
  const agentName = parsed.agentName as string;
  const taskTitle = parsed.taskTitle as string;
  const taskDescription = parsed.taskDescription as string;
  const priority = parsed.priority as string || "medium";

  if (!agentName || !taskTitle) return;

  // Find target agent
  const allAgents = await db.select().from(agents).where(and(eq(agents.companyId, ctx.companyId), ne(agents.status, "terminated")));
  const target = allAgents.find((a) => a.name.toLowerCase().includes(agentName.toLowerCase()));

  if (!target) {
    ctx.sendSSE({ type: "chunk", content: `Could not find agent "${agentName}" for delegation.` });
    return;
  }

  // Create issue assigned to target agent (in the active project)
  const [newIssue] = await db.insert(issues).values({
    companyId: ctx.companyId,
    title: taskTitle,
    description: taskDescription || null,
    status: "todo",
    priority,
    projectId: ctx.projectId || null,
    assigneeAgentId: target.id,
    originKind: "manual",
    createdByUserId: "local-board",
  }).returning();

  // Add instruction comment for the assigned agent
  try {
    const { issueComments } = await import("@titanclip/db");
    await db.insert(issueComments).values({
      companyId: ctx.companyId,
      issueId: newIssue.id,
      body: `**@${target.name}** — This task has been delegated to you by **${ctx.agent.name}**. Please start working on it.\n\n**Task:** ${taskTitle}\n${taskDescription ? `\n**Details:** ${taskDescription.slice(0, 500)}\n` : ""}\n**Instructions:**\n1. Update this issue status to \`in_progress\` when you begin\n2. Post progress updates as comments on this issue\n3. Update status to \`done\` when complete\n4. If blocked, update status to \`blocked\` and comment with the blocker details`,
      authorAgentId: ctx.agentId,
    });
  } catch { /* ok */ }

  await logActivity(db, {
    companyId: ctx.companyId,
    actorType: "agent",
    actorId: ctx.agentId,
    agentId: ctx.agentId,
    action: "agent.delegated_task",
    entityType: "issue",
    entityId: newIssue.id,
    details: { targetAgentId: target.id, targetAgentName: target.name, taskTitle },
  });

  // Wake the assigned agent so it starts working on the delegated task
  void queueIssueAssignmentWakeup({
    heartbeat: ctx.heartbeat,
    issue: { id: newIssue.id, assigneeAgentId: target.id, status: "todo" },
    reason: "issue_assigned",
    mutation: "create",
    contextSource: "agent_chat.delegate",
    requestedByActorType: "agent",
    requestedByActorId: ctx.agentId,
  });

  // Log to chatter
  ctx.chatSvc.postMessage(ctx.companyId, {
    body: `${ctx.agent.name} delegated task **"${taskTitle}"** to **${target.name}**`,
    channel: "general",
    messageType: "delegation",
    metadata: { fromAgentId: ctx.agentId, toAgentId: target.id, issueId: newIssue.id },
  }).catch(() => {});

  ctx.sendSSE({
    type: "issue_created",
    issue: {
      id: newIssue.id,
      identifier: newIssue.identifier ?? newIssue.id.slice(0, 8),
      title: newIssue.title,
      description: (taskDescription || "").slice(0, 120) + ((taskDescription || "").length > 120 ? "..." : ""),
      status: "todo",
      priority,
      assignee: target.name,
    },
  });
}

// ── Update Issue Status ──────────────────────────────────────────────────

async function processUpdateIssue(db: Db, parsed: any, ctx: ToolActionCtx) {
  const issueIdentifier = parsed.issueIdentifier as string;
  const status = parsed.status as string;
  const comment = parsed.comment as string | null;

  if (!issueIdentifier || !status) return;

  const [issue] = await db.select().from(issues).where(
    and(eq(issues.companyId, ctx.companyId), eq(issues.identifier, issueIdentifier))
  ).limit(1);

  if (!issue) {
    ctx.sendSSE({ type: "chunk", content: `Issue "${issueIdentifier}" not found.` });
    return;
  }

  const updates: any = { status, updatedAt: new Date() };
  if (status === "in_progress" && !issue.startedAt) updates.startedAt = new Date();
  if (status === "done" && !issue.completedAt) updates.completedAt = new Date();

  await db.update(issues).set(updates).where(eq(issues.id, issue.id));

  if (comment) {
    try {
      const { issueComments } = await import("@titanclip/db");
      await db.insert(issueComments).values({
        companyId: ctx.companyId,
        issueId: issue.id,
        body: comment,
        authorAgentId: ctx.agentId,
      });
    } catch { /* ok */ }
  }

  await logActivity(db, {
    companyId: ctx.companyId,
    actorType: "agent",
    actorId: ctx.agentId,
    agentId: ctx.agentId,
    action: "issue.status_changed",
    entityType: "issue",
    entityId: issue.id,
    details: { from: issue.status, to: status, issueIdentifier },
  });

  ctx.chatSvc.postMessage(ctx.companyId, {
    body: `${ctx.agent.name} updated **${issueIdentifier}** status: ${issue.status} → **${status}**`,
    channel: "general",
    messageType: "status_update",
    metadata: { agentId: ctx.agentId, issueId: issue.id, from: issue.status, to: status },
  }).catch(() => {});
}

// ── Add Issue Comment ────────────────────────────────────────────────────

async function processIssueComment(db: Db, parsed: any, ctx: ToolActionCtx) {
  const issueIdentifier = parsed.issueIdentifier as string;
  const body = parsed.body as string;

  if (!issueIdentifier || !body) return;

  const [issue] = await db.select().from(issues).where(
    and(eq(issues.companyId, ctx.companyId), eq(issues.identifier, issueIdentifier))
  ).limit(1);

  if (!issue) {
    ctx.sendSSE({ type: "chunk", content: `Issue "${issueIdentifier}" not found.` });
    return;
  }

  try {
    const { issueComments } = await import("@titanclip/db");
    await db.insert(issueComments).values({
      companyId: ctx.companyId,
      issueId: issue.id,
      body,
      authorAgentId: ctx.agentId,
    });
  } catch (err: any) {
    ctx.sendSSE({ type: "chunk", content: `Failed to add comment: ${err.message}` });
    return;
  }

  ctx.chatSvc.postMessage(ctx.companyId, {
    body: `${ctx.agent.name} commented on **${issueIdentifier}**: ${body.slice(0, 100)}`,
    channel: "agent-activity",
    messageType: "issue_comment",
    metadata: { agentId: ctx.agentId, issueId: issue.id },
  }).catch(() => {});
}

// ── Post to Chatter ──────────────────────────────────────────────────────

async function processPostChatter(_db: Db, parsed: any, ctx: ToolActionCtx) {
  const message = parsed.message as string;
  const channel = (parsed.channel as string) || "general";

  if (!message) return;

  await ctx.chatSvc.postMessage(ctx.companyId, {
    body: `**${ctx.agent.name}**: ${message}`,
    channel,
    messageType: "agent_message",
    metadata: { agentId: ctx.agentId },
  });
}

// ── Read Issue ───────────────────────────────────────────────────────────

async function processReadIssue(db: Db, parsed: any, ctx: ToolActionCtx) {
  const issueIdentifier = parsed.issueIdentifier as string;
  if (!issueIdentifier) return;

  const [issue] = await db.select().from(issues).where(
    and(eq(issues.companyId, ctx.companyId), eq(issues.identifier, issueIdentifier))
  ).limit(1);

  if (!issue) return; // Tool result already shown, no extra action needed

  // Fetch comments
  let comments: any[] = [];
  try {
    const { issueComments } = await import("@titanclip/db");
    comments = await db.select().from(issueComments).where(eq(issueComments.issueId, issue.id)).limit(5);
  } catch { /* ok */ }

  // The tool result is already fed back to the LLM — but we need to replace the
  // placeholder result with actual data. We'll send it as a status event for context.
  const commentsSummary = comments.length > 0
    ? comments.map((c: any) => `- ${c.body?.slice(0, 100)}`).join("\n")
    : "No comments.";

  ctx.sendSSE({
    type: "status",
    content: `[Issue ${issueIdentifier}] ${issue.title} | Status: ${issue.status} | Priority: ${issue.priority} | Comments: ${comments.length}`,
  });
}

// ── List Team Agents ─────────────────────────────────────────────────────

async function processListAgents(db: Db, ctx: ToolActionCtx) {
  const allAgents = await db.select().from(agents).where(
    and(eq(agents.companyId, ctx.companyId), ne(agents.status, "terminated"))
  );

  // Count open issues per agent
  const openIssues = await db.select({ assigneeAgentId: issues.assigneeAgentId }).from(issues).where(
    and(eq(issues.companyId, ctx.companyId), ne(issues.status, "done"), ne(issues.status, "cancelled"))
  );

  const workload = new Map<string, number>();
  for (const i of openIssues) {
    if (i.assigneeAgentId) workload.set(i.assigneeAgentId, (workload.get(i.assigneeAgentId) ?? 0) + 1);
  }

  // Send as status for agent context (the actual tool result is already in the LLM loop)
  const agentList = allAgents.map((a) =>
    `${a.name} (${a.role}) — ${a.status} — ${workload.get(a.id) ?? 0} tasks`
  ).join("; ");

  ctx.sendSSE({ type: "status", content: `[Team] ${agentList}` });
}
