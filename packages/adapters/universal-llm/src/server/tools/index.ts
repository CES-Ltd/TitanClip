/**
 * Built-in Tools — available to the universal_llm adapter's tool loop.
 *
 * Each tool implements:
 *   - name: unique identifier
 *   - description: what the tool does (sent to LLM)
 *   - parameters: JSON Schema for the tool's input
 *   - execute: async function that runs the tool and returns a result
 *
 * Tools are gated by the agent's autonomy level:
 *   - sandboxed: no tools execute (all blocked)
 *   - supervised: read-only tools auto-execute, destructive tools require approval
 *   - autonomous: all tools execute immediately
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Whether this tool has side effects (writes, deletes, executes commands) */
  destructive: boolean;
  /** Whether the tool only reads data (no side effects at all) */
  readOnly: boolean;
  /** Whether this tool should require human approval even in supervised mode */
  requiresApproval: boolean;
  /** Whether this tool is safe to run in parallel with others */
  concurrencySafe: boolean;
}

export interface ToolResult {
  content: string;
  success: boolean;
  error?: string;
}

export type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ── Built-in tool implementations ─────────────────────────────���────────

const webSearchTool: RegisteredTool = {
  definition: {
    name: "web_search",
    description: "Search the web for current information. Returns search result snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params) => {
    const query = params.query as string;
    // In a real implementation, this would call a search API
    // For now, return a placeholder indicating the tool was called
    return {
      content: `[web_search] Searched for: "${query}"\n\nNote: Web search requires an API key to be configured. Configure a search provider in Agent OS settings.`,
      success: true,
    };
  },
};

const webFetchTool: RegisteredTool = {
  definition: {
    name: "web_fetch",
    description: "Fetch the content of a web page by URL. Returns the page text.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params) => {
    const url = params.url as string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "TitanClip-AgentOS/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { content: `HTTP ${res.status}: ${res.statusText}`, success: false };
      const text = await res.text();
      // Truncate to avoid overwhelming the context
      const truncated = text.slice(0, 8000);
      return { content: truncated, success: true };
    } catch (err: any) {
      return { content: `Fetch error: ${err.message}`, success: false, error: err.message };
    }
  },
};

const shellExecTool: RegisteredTool = {
  definition: {
    name: "shell_exec",
    description: "Execute a shell command and return the output. Use with caution.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        cwd: { type: "string", description: "Working directory (optional)" },
      },
      required: ["command"],
    },
    destructive: true,
    readOnly: false,
    requiresApproval: true,
    concurrencySafe: false,
  },
  handler: async (params) => {
    const command = params.command as string;
    const cwd = params.cwd as string | undefined;
    try {
      const { execSync } = require("child_process");
      const output = execSync(command, {
        encoding: "utf-8",
        timeout: 30000,
        cwd,
        maxBuffer: 1024 * 1024, // 1MB
      });
      return { content: output.slice(0, 5000), success: true };
    } catch (err: any) {
      return {
        content: `Command failed: ${err.message}\n${err.stderr?.slice(0, 2000) ?? ""}`,
        success: false,
        error: err.message,
      };
    }
  },
};

const readFileTool: RegisteredTool = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
      },
      required: ["path"],
    },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params) => {
    const filePath = params.path as string;
    try {
      const { readFileSync } = require("fs");
      const content = readFileSync(filePath, "utf-8");
      return { content: content.slice(0, 10000), success: true };
    } catch (err: any) {
      return { content: `Read error: ${err.message}`, success: false, error: err.message };
    }
  },
};

const writeFileTool: RegisteredTool = {
  definition: {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write to" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    destructive: true,
    readOnly: false,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async (params) => {
    const filePath = params.path as string;
    const content = params.content as string;
    try {
      const { writeFileSync, mkdirSync } = require("fs");
      const { dirname } = require("path");
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
      return { content: `Wrote ${content.length} bytes to ${filePath}`, success: true };
    } catch (err: any) {
      return { content: `Write error: ${err.message}`, success: false, error: err.message };
    }
  },
};

const currentTimeTool: RegisteredTool = {
  definition: {
    name: "current_time",
    description: "Get the current date, time, and timezone.",
    parameters: { type: "object", properties: {} },
    destructive: false,
    readOnly: true,
    requiresApproval: false,
    concurrencySafe: true,
  },
  handler: async () => {
    const now = new Date();
    return {
      content: `Current time: ${now.toISOString()}\nLocal: ${now.toLocaleString()}\nTimezone offset: UTC${now.getTimezoneOffset() > 0 ? "-" : "+"}${Math.abs(now.getTimezoneOffset() / 60)}`,
      success: true,
    };
  },
};

// ── Tool Registry ──────────────────────────────────────────────────────

import { delegateToAgentTool } from "./delegate.js";
import { hireAgentTool } from "./hire-agent.js";
import { updateIssueTool } from "./update-issue.js";
import { issueCommentTool } from "./issue-comment.js";
import { postChatterTool } from "./post-chatter.js";
import { readIssueTool } from "./read-issue.js";
import { listAgentsTool } from "./list-agents.js";

const BUILT_IN_TOOLS: RegisteredTool[] = [
  webSearchTool,
  webFetchTool,
  shellExecTool,
  readFileTool,
  writeFileTool,
  currentTimeTool,
  delegateToAgentTool,
  hireAgentTool,
  updateIssueTool,
  issueCommentTool,
  postChatterTool,
  readIssueTool,
  listAgentsTool,
];

const toolMap = new Map<string, RegisteredTool>(
  BUILT_IN_TOOLS.map((t) => [t.definition.name, t])
);

export function getToolDefinitions(allowedTools?: string[]): ToolDefinition[] {
  if (allowedTools?.length) {
    return BUILT_IN_TOOLS
      .filter((t) => allowedTools.includes(t.definition.name))
      .map((t) => t.definition);
  }
  return BUILT_IN_TOOLS.map((t) => t.definition);
}

export function getToolHandler(name: string): ToolHandler | undefined {
  return toolMap.get(name)?.handler;
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return toolMap.get(name)?.definition;
}

export function isDestructiveTool(name: string): boolean {
  return toolMap.get(name)?.definition.destructive ?? true; // default to destructive if unknown
}

/**
 * Convert tool definitions to OpenAI function-calling format.
 */
export function toolDefinitionsToOpenAIFormat(defs: ToolDefinition[]) {
  return defs.map((d) => ({
    type: "function" as const,
    function: {
      name: d.name,
      description: d.description,
      parameters: d.parameters,
    },
  }));
}
