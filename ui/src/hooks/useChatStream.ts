/**
 * useChatStream — SSE parsing hook for Agent OS chat.
 *
 * Extracts all SSE event handling from the chat component into
 * a reusable hook with typed state for content, tool calls,
 * approvals, and thinking blocks.
 */

import { useState, useRef, useCallback } from "react";

export interface ToolCall {
  id: string;
  name: string;
  args: string;
  result?: string;
  isError?: boolean;
  status: "running" | "completed" | "error";
}

export interface ApprovalRequest {
  approvalId: string;
  approvalType: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

export interface IssueCard {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectName?: string;
  assignee?: string;
  error?: string;
}

export interface ChatStreamState {
  isStreaming: boolean;
  content: string;
  toolCalls: ToolCall[];
  approvals: ApprovalRequest[];
  issueCards: IssueCard[];
  thinkingContent: string;
  conversationId: string | null;
  issueId: string | null;
}

interface UseChatStreamOptions {
  onConversationCreated?: (conversationId: string) => void;
  onDone?: () => void;
}

export function useChatStream(opts?: UseChatStreamOptions) {
  const [state, setState] = useState<ChatStreamState>({
    isStreaming: false,
    content: "",
    toolCalls: [],
    approvals: [],
    issueCards: [],
    thinkingContent: "",
    conversationId: null,
    issueId: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (
    url: string,
    body: Record<string, unknown>,
  ) => {
    setState((s) => ({
      ...s,
      isStreaming: true,
      content: "",
      toolCalls: [],
      approvals: [],
      issueCards: [],
      thinkingContent: "",
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Chat failed" }));
        throw new Error((err as any).error ?? "Chat failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let thinkingAccumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "start":
                setState((s) => ({
                  ...s,
                  conversationId: event.conversationId ?? null,
                  issueId: event.issueId ?? null,
                }));
                if (event.conversationId) {
                  opts?.onConversationCreated?.(event.conversationId);
                }
                break;

              case "chunk":
                if (event.content) {
                  accumulated += event.content;
                  setState((s) => ({ ...s, content: accumulated }));
                }
                break;

              case "thinking":
                if (event.content) {
                  thinkingAccumulated += event.content;
                  setState((s) => ({ ...s, thinkingContent: thinkingAccumulated }));
                }
                break;

              case "tool_start":
                setState((s) => ({
                  ...s,
                  toolCalls: [...s.toolCalls, {
                    id: event.id ?? `tc-${s.toolCalls.length}`,
                    name: event.name ?? "unknown",
                    args: typeof event.args === "string" ? event.args : JSON.stringify(event.args ?? {}),
                    status: "running",
                  }],
                }));
                break;

              case "tool_result":
                setState((s) => ({
                  ...s,
                  toolCalls: s.toolCalls.map((tc) =>
                    tc.id === event.id || (!event.id && tc.status === "running")
                      ? { ...tc, result: event.result, isError: event.isError, status: event.isError ? "error" : "completed" }
                      : tc
                  ),
                }));
                break;

              case "approval":
                setState((s) => ({
                  ...s,
                  approvals: [...s.approvals, {
                    approvalId: event.approvalId,
                    approvalType: event.approvalType ?? event.type,
                    payload: event.payload ?? {},
                    status: event.status ?? "pending",
                  }],
                }));
                break;

              case "issue_created":
                setState((s) => ({
                  ...s,
                  issueCards: [...s.issueCards, {
                    id: event.issue?.id ?? "",
                    identifier: event.issue?.identifier ?? "",
                    title: event.issue?.title ?? "",
                    description: event.issue?.description,
                    status: event.issue?.status ?? "backlog",
                    priority: event.issue?.priority ?? "medium",
                    projectName: event.issue?.projectName,
                    assignee: event.issue?.assignee,
                  }],
                }));
                break;

              case "issue_error":
                setState((s) => ({
                  ...s,
                  issueCards: [...s.issueCards, {
                    id: "",
                    identifier: "",
                    title: event.description ?? "",
                    status: "error",
                    priority: "",
                    error: event.error,
                  }],
                }));
                break;

              case "error":
                if (event.error) {
                  accumulated += `\n\n**Error:** ${event.error}`;
                  setState((s) => ({ ...s, content: accumulated }));
                }
                break;

              case "status":
                // Diagnostic — not displayed in main content
                break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[useChatStream]", err.message);
      }
    } finally {
      setState((s) => ({ ...s, isStreaming: false }));
      abortRef.current = null;
      opts?.onDone?.();
    }
  }, [opts]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      content: "",
      toolCalls: [],
      approvals: [],
      issueCards: [],
      thinkingContent: "",
      conversationId: null,
      issueId: null,
    });
  }, []);

  return { ...state, send, stop, reset };
}
