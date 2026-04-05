/**
 * Agent Chat Route — accepts a user message, triggers adapter execution,
 * and streams the response back via Server-Sent Events (SSE).
 *
 * This is the core execution path for the Agent OS chat interface.
 *
 * Flow:
 *   1. Client sends POST with { message, conversationId? }
 *   2. Server resolves agent + adapter config
 *   3. Builds memory context from agent memories
 *   4. Creates/appends to conversation
 *   5. Calls adapter.execute() with streaming callbacks
 *   6. Streams response chunks back to client via SSE
 *   7. Records assistant response in conversation
 */

import { Router } from "express";
import type { Db } from "@titanclip/db";
import { agents } from "@titanclip/db";
import { eq, and } from "drizzle-orm";
import { getServerAdapter } from "../adapters/index.js";
import { conversationService } from "../services/conversations.js";
import { agentMemoryService } from "../services/agent-memory.js";
import { assertCompanyAccess } from "./authz.js";

export function agentChatRoutes(db: Db) {
  const router = Router();
  const convSvc = conversationService(db);
  const memorySvc = agentMemoryService(db);

  /**
   * POST /companies/:companyId/agents/:agentId/chat
   *
   * Body: { message: string, conversationId?: string, model?: string, provider?: string }
   * Response: SSE stream of { type: "chunk"|"done"|"error", content?, usage? }
   */
  router.post("/companies/:companyId/agents/:agentId/chat", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);

    const { message, conversationId, model, provider } = req.body as {
      message: string;
      conversationId?: string;
      model?: string;
      provider?: string;
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

    // 2. Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await convSvc.getById(conversationId);
    }
    if (!conversation) {
      conversation = await convSvc.create(companyId, agentId, {
        title: message.slice(0, 100),
      });
    }

    // 3. Record user message
    await convSvc.appendMessage(conversation.id, companyId, {
      role: "user",
      content: message,
    });

    // 4. Build memory context
    let memoryContext = "";
    try {
      memoryContext = await memorySvc.buildMemoryContext(agentId, { maxTokenEstimate: 1500 });
    } catch {
      // Memory service may not have tables yet — continue without
    }

    // 5. Load conversation history for context
    const recentMessages = await convSvc.getMessages(conversation.id, { limit: 20 });
    const history = recentMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // 6. Resolve adapter
    const adapterType = agent.adapterType;
    const adapter = getServerAdapter(adapterType);
    const adapterConfig = (agent.adapterConfig as Record<string, unknown>) ?? {};

    // Allow runtime model/provider override from the chat request
    const effectiveConfig = {
      ...adapterConfig,
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
    };

    // 7. Set up SSE response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Conversation-Id", conversation.id);
    res.flushHeaders();

    const sendSSE = (data: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendSSE({ type: "start", conversationId: conversation.id });

    let fullContent = "";

    try {
      // 8. Execute adapter
      const result = await adapter.execute({
        runId: `chat-${Date.now()}`,
        agent: {
          id: agent.id,
          companyId: agent.companyId,
          name: agent.name,
          adapterType: agent.adapterType,
          adapterConfig: effectiveConfig,
        },
        runtime: {
          sessionId: conversation.id,
          sessionParams: { history },
          sessionDisplayId: conversation.title ?? "chat",
          taskKey: `chat:${conversation.id}`,
        },
        config: effectiveConfig,
        context: {
          userMessage: message,
          memoryContext,
          conversationId: conversation.id,
        },
        onLog: async (stream, chunk) => {
          if (stream === "stdout" && chunk) {
            fullContent += chunk;
            sendSSE({ type: "chunk", content: chunk });
          }
        },
      });

      // 9. Record assistant response
      const responseContent = fullContent || (result.resultJson as any)?.content || result.summary || "(no response)";
      await convSvc.appendMessage(conversation.id, companyId, {
        role: "assistant",
        content: responseContent,
        tokenCount: result.usage
          ? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
          : undefined,
        metadata: {
          model: result.model,
          provider: result.provider,
          exitCode: result.exitCode,
          costUsd: result.costUsd,
        },
      });

      // 10. Extract memories from successful response
      if (result.exitCode === 0 && responseContent.length > 50) {
        try {
          await memorySvc.upsert(agentId, companyId, {
            memoryType: "learned_fact",
            category: "chat_summaries",
            key: `conv:${conversation.id}:${Date.now()}`,
            content: responseContent.slice(0, 500),
            importance: 3,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day TTL
          });
        } catch {
          // Memory table may not exist — continue
        }
      }

      sendSSE({
        type: "done",
        conversationId: conversation.id,
        usage: result.usage,
        model: result.model,
        provider: result.provider,
        costUsd: result.costUsd,
      });
    } catch (err: any) {
      sendSSE({ type: "error", error: err.message });
    }

    res.end();
  });

  /**
   * POST /companies/:companyId/agents/:agentId/chat/regenerate
   * Re-runs the last turn in a conversation.
   */
  router.post("/companies/:companyId/agents/:agentId/chat/regenerate", async (req, res) => {
    res.status(501).json({ error: "Regenerate not yet implemented" });
  });

  return router;
}
