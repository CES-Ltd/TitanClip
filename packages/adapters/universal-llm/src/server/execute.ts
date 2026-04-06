/**
 * Universal LLM Adapter — Agentic Tool Loop Execution.
 *
 * Implements the ZeroClaw-style run_tool_call_loop pattern:
 *   1. Send messages to LLM with available tools
 *   2. If LLM responds with tool_calls → execute each tool
 *   3. Feed tool results back as tool role messages
 *   4. Repeat until LLM returns a final text response or max iterations
 *
 * Cost budgeting: tracks cumulative cost per-run and stops if exceeded.
 * Autonomy gating: destructive tools require the correct autonomy level.
 */

import type { AdapterExecutionContext, AdapterExecutionResult } from "@titanclip/adapter-utils";
import { getProvider, type ChatMessage, type ChatOptions, type ChatResponse } from "./providers/index.js";
import {
  getToolDefinitions,
  getToolHandler,
  isDestructiveTool,
  toolDefinitionsToOpenAIFormat,
} from "./tools/index.js";

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_MAX_COST_PER_RUN_USD = 1.0;
const DEFAULT_MAX_TOKENS_PER_RUN = 100_000;

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const startTime = Date.now();
  const config = ctx.config ?? {};

  // Provider config — infer provider from model string if not explicitly set
  let providerSlug = (config.provider as string) ?? "";
  let model = (config.model as string) ?? "gpt-4o-mini";
  const apiKey = (config.apiKey as string) ?? "";
  const baseUrl = (config.baseUrl as string) ?? undefined;

  const KNOWN_PROVIDER_PREFIXES = ["openai", "anthropic", "ollama", "ollama_cloud", "ollama_local", "openrouter", "gemini", "azure", "vertex", "custom"];

  if (model.includes("/")) {
    const slashIdx = model.indexOf("/");
    const prefix = model.slice(0, slashIdx).toLowerCase();
    if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
      // Always strip the prefix from model name
      model = model.slice(slashIdx + 1);
      // Infer provider if not explicitly set
      if (!providerSlug) {
        providerSlug = prefix;
      }
    }
  }
  if (!providerSlug) providerSlug = "openai";
  const systemPrompt = (config.systemPrompt as string) ?? undefined;
  const temperature = config.temperature as number | undefined;
  const maxOutputTokens = (config.maxTokens as number) ?? 4096;

  // Tool loop config
  const maxIterations = (config.maxToolIterations as number) ?? DEFAULT_MAX_ITERATIONS;
  const maxCostPerRun = (config.maxCostPerRunUsd as number) ?? DEFAULT_MAX_COST_PER_RUN_USD;
  const maxTokensPerRun = (config.maxTokensPerRun as number) ?? DEFAULT_MAX_TOKENS_PER_RUN;
  const allowedTools = config.allowedTools as string[] | undefined;
  const autonomyLevel = (config.autonomyLevel as string) ?? "supervised";
  const enableTools = autonomyLevel !== "sandboxed";

  const provider = getProvider(providerSlug);

  // Build messages from context
  const messages: ChatMessage[] = [];

  // Load conversation history from session
  const sessionHistory = ctx.runtime.sessionParams?.history as ChatMessage[] | undefined;
  if (sessionHistory?.length) {
    messages.push(...sessionHistory);
  }

  // Add current user message
  const taskContext = ctx.context;
  const userMessage = taskContext?.userMessage as string | undefined;
  const memoryContext = taskContext?.memoryContext as string | undefined;
  const issueTitle = taskContext?.issueTitle as string | undefined;
  const issueDescription = taskContext?.issueDescription as string | undefined;

  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  } else if (issueTitle) {
    messages.push({ role: "user", content: issueDescription ? `Task: ${issueTitle}\n\n${issueDescription}` : `Task: ${issueTitle}` });
  }

  if (messages.length === 0) {
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: "No messages to send", provider: providerSlug, model };
  }

  // Build system prompt with memory
  let effectiveSystemPrompt = systemPrompt ?? "You are a helpful AI assistant with access to tools. Use tools when needed to accomplish tasks.";
  if (memoryContext) {
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n## Memory Context\n${memoryContext}`;
  }

  // Get available tools
  const toolDefs = enableTools ? getToolDefinitions(allowedTools) : [];
  const openAITools = toolDefs.length > 0 ? toolDefinitionsToOpenAIFormat(toolDefs) : undefined;

  // ── Agentic Tool Loop ─────────────────────────────────────────────────
  let fullContent = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let iterations = 0;
  let lastResponse: ChatResponse | null = null;
  let loopMessages = [...messages]; // Working message list for the loop

  try {
    while (iterations < maxIterations) {
      iterations++;

      // ── Budget check ────────────────────────────────────────────────
      if (totalCostUsd >= maxCostPerRun) {
        ctx.onLog("stderr", `\n[paperclip] Run cost budget exceeded ($${totalCostUsd.toFixed(4)} >= $${maxCostPerRun}). Stopping.\n`);
        break;
      }

      // ── Token budget overflow recovery (auto-compact) ──────────────
      const estimatedTokens = loopMessages.reduce((sum, m) => sum + (m.content?.length ?? 0) / 4, 0);
      if (estimatedTokens > maxTokensPerRun * 0.8) {
        // Keep system prompt (first message if system) + last 6 messages
        const systemMsg = loopMessages[0]?.role === "system" ? [loopMessages[0]] : [];
        const recentMsgs = loopMessages.slice(-6);
        const compactedCount = loopMessages.length - systemMsg.length - recentMsgs.length;
        if (compactedCount > 0) {
          loopMessages = [...systemMsg, ...recentMsgs];
          ctx.onLog("stderr", `[paperclip] Auto-compacted ${compactedCount} older messages to stay within token budget.\n`);
        }
      }
      if (totalInputTokens + totalOutputTokens >= maxTokensPerRun) {
        ctx.onLog("stderr", `\n[paperclip] Token budget exceeded (${totalInputTokens + totalOutputTokens} >= ${maxTokensPerRun}). Stopping.\n`);
        break;
      }

      // ── Call LLM ────────────────────────────────────────────────────
      const chatOptions: ChatOptions = {
        model,
        temperature,
        maxTokens: maxOutputTokens,
        systemPrompt: effectiveSystemPrompt,
        tools: openAITools,
      };

      ctx.onLog("stderr", `[paperclip] Calling ${providerSlug}/${model} (iteration ${iterations})${baseUrl ? ` via ${baseUrl}` : ""}\n`);

      const response = await provider.chatStream(
        loopMessages,
        chatOptions,
        { apiKey, baseUrl },
        (chunk) => {
          if (chunk.type === "text_delta" && chunk.content) {
            fullContent += chunk.content;
            ctx.onLog("stdout", chunk.content);
          }
        }
      );

      // Warn if the LLM returned nothing
      if (!response.content && !response.toolCalls?.length && response.usage.inputTokens === 0) {
        ctx.onLog("stderr", `[paperclip] Warning: LLM returned empty response with 0 tokens. This may indicate a connection or model configuration issue.\n`);
      }

      lastResponse = response;
      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;
      totalCostUsd += provider.estimateCost(response.model, response.usage);

      // ── Check for tool calls ────────────────────────────────────────
      if (response.finishReason === "tool_calls" && response.toolCalls?.length) {
        // Add assistant message with tool calls to history
        loopMessages.push({
          role: "assistant",
          content: response.content || "",
          tool_calls: response.toolCalls,
        });

        ctx.onLog("stdout", `\n\n--- Tool calls (iteration ${iterations}) ---\n`);

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          ctx.onLog("stdout", `[tool] ${toolName}(${JSON.stringify(toolArgs)})\n`);

          // ── Autonomy gating ───────────────────────────────────────
          if (autonomyLevel === "sandboxed") {
            const blocked = `Tool "${toolName}" blocked: agent is in sandboxed mode. No tools can execute.`;
            ctx.onLog("stderr", `[blocked] ${blocked}\n`);
            loopMessages.push({ role: "tool", content: blocked, tool_call_id: toolCall.id });
            continue;
          }

          if (autonomyLevel === "supervised" && isDestructiveTool(toolName)) {
            const blocked = `Tool "${toolName}" requires approval: agent is in supervised mode and this tool has side effects. The operation was blocked. Ask the user for permission or switch to autonomous mode.`;
            ctx.onLog("stderr", `[approval_needed] ${toolName} is destructive, supervised mode blocks it\n`);
            loopMessages.push({ role: "tool", content: blocked, tool_call_id: toolCall.id });
            continue;
          }

          // ── Execute tool ──────────────────────────────────────────
          const handler = getToolHandler(toolName);
          if (!handler) {
            const msg = `Unknown tool: "${toolName}"`;
            loopMessages.push({ role: "tool", content: msg, tool_call_id: toolCall.id });
            ctx.onLog("stderr", `[error] ${msg}\n`);
            continue;
          }

          try {
            const result = await handler(toolArgs);
            const resultMsg = result.success
              ? result.content
              : `Error: ${result.error ?? result.content}`;
            loopMessages.push({ role: "tool", content: resultMsg, tool_call_id: toolCall.id });
            ctx.onLog("stdout", `[result] ${resultMsg.slice(0, 2000)}${resultMsg.length > 2000 ? "..." : ""}\n`);
          } catch (err: any) {
            const errMsg = `Tool execution error: ${err.message}`;
            loopMessages.push({ role: "tool", content: errMsg, tool_call_id: toolCall.id });
            ctx.onLog("stderr", `[error] ${errMsg}\n`);
          }
        }

        ctx.onLog("stdout", `--- End tool calls ---\n\n`);
        // Continue the loop — LLM will process tool results
        continue;
      }

      // ── Final response (no more tool calls) ────────────────────────
      break;
    }

    // Build session history
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: fullContent },
    ];
    const maxHistoryTurns = (config.maxHistoryTurns as number) ?? 50;
    const trimmedHistory = updatedHistory.slice(-maxHistoryTurns * 2);

    const durationMs = Date.now() - startTime;

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedInputTokens: lastResponse?.usage.cachedInputTokens ?? 0,
      },
      sessionId: ctx.runtime.sessionId,
      sessionParams: { history: trimmedHistory },
      provider: lastResponse?.provider ?? providerSlug,
      biller: lastResponse?.provider ?? providerSlug,
      model: lastResponse?.model ?? model,
      billingType: providerSlug === "ollama" ? "free" as any : "api" as any,
      costUsd: totalCostUsd,
      resultJson: {
        content: fullContent,
        finishReason: lastResponse?.finishReason ?? "stop",
        durationMs,
        iterations,
        totalCostUsd,
        toolCallsExecuted: iterations > 1,
      },
      summary: fullContent.slice(0, 200),
    };
  } catch (err: any) {
    ctx.onLog("stderr", `Error: ${err.message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: err.message,
      provider: providerSlug,
      model,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, cachedInputTokens: 0 },
      costUsd: totalCostUsd,
    };
  }
}
