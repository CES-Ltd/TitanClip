/**
 * Universal LLM Adapter — execute function.
 *
 * Reads provider + model from adapterConfig, resolves the provider,
 * builds the conversation from context, and executes via the provider's chat API.
 */

import type { AdapterExecutionContext, AdapterExecutionResult } from "@titanclip/adapter-utils";
import { getProvider, type ChatMessage, type ChatOptions } from "./providers/index.js";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const startTime = Date.now();
  const config = ctx.config ?? {};
  const providerSlug = (config.provider as string) ?? "openai";
  const model = (config.model as string) ?? "gpt-4o-mini";
  const apiKey = (config.apiKey as string) ?? "";
  const baseUrl = (config.baseUrl as string) ?? undefined;
  const systemPrompt = (config.systemPrompt as string) ?? undefined;
  const temperature = config.temperature as number | undefined;
  const maxTokens = (config.maxTokens as number) ?? 4096;

  const provider = getProvider(providerSlug);

  // Build messages from context
  const messages: ChatMessage[] = [];

  // Add conversation history from session params if available
  const sessionHistory = ctx.runtime.sessionParams?.history as ChatMessage[] | undefined;
  if (sessionHistory?.length) {
    messages.push(...sessionHistory);
  }

  // Add the current task/issue context as a user message
  const taskContext = ctx.context;
  const issueTitle = taskContext?.issueTitle as string | undefined;
  const issueDescription = taskContext?.issueDescription as string | undefined;
  const userMessage = taskContext?.userMessage as string | undefined;
  const memoryContext = taskContext?.memoryContext as string | undefined;

  if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  } else if (issueTitle) {
    const content = issueDescription
      ? `Task: ${issueTitle}\n\n${issueDescription}`
      : `Task: ${issueTitle}`;
    messages.push({ role: "user", content });
  }

  if (messages.length === 0) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No messages to send — provide a userMessage or issue context",
      provider: providerSlug,
      model,
    };
  }

  // Build effective system prompt with memory context
  let effectiveSystemPrompt = systemPrompt ?? "You are a helpful AI assistant.";
  if (memoryContext) {
    effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n## Memory Context\n${memoryContext}`;
  }

  const chatOptions: ChatOptions = {
    model,
    temperature,
    maxTokens,
    systemPrompt: effectiveSystemPrompt,
  };

  try {
    // Stream output to the log callback
    let fullContent = "";
    const response = await provider.chatStream(
      messages,
      chatOptions,
      { apiKey, baseUrl },
      (chunk) => {
        if (chunk.type === "text_delta" && chunk.content) {
          fullContent += chunk.content;
          ctx.onLog("stdout", chunk.content);
        }
      }
    );

    // Build updated conversation history for session persistence
    const updatedHistory: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: response.content },
    ];

    // Keep only last N turns to avoid unbounded growth
    const maxHistoryTurns = (config.maxHistoryTurns as number) ?? 50;
    const trimmedHistory = updatedHistory.slice(-maxHistoryTurns * 2);

    const costUsd = provider.estimateCost(response.model, response.usage);
    const durationMs = Date.now() - startTime;

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cachedInputTokens: response.usage.cachedInputTokens ?? 0,
      },
      sessionId: ctx.runtime.sessionId,
      sessionParams: { history: trimmedHistory },
      provider: response.provider,
      biller: response.provider,
      model: response.model,
      billingType: providerSlug === "ollama" ? "free" as any : "api" as any,
      costUsd,
      resultJson: {
        content: response.content,
        finishReason: response.finishReason,
        durationMs,
      },
      summary: response.content.slice(0, 200),
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
    };
  }
}
