import type { ServerAdapterModule } from "./types.js";
import { getAdapterSessionManagement } from "@titanclip/adapter-utils";
import {
  execute as claudeExecute,
  listClaudeSkills,
  syncClaudeSkills,
  testEnvironment as claudeTestEnvironment,
  sessionCodec as claudeSessionCodec,
  getQuotaWindows as claudeGetQuotaWindows,
} from "@titanclip/adapter-claude-local/server";
import { agentConfigurationDoc as claudeAgentConfigurationDoc, models as claudeModels } from "@titanclip/adapter-claude-local";
import {
  execute as codexExecute,
  listCodexSkills,
  syncCodexSkills,
  testEnvironment as codexTestEnvironment,
  sessionCodec as codexSessionCodec,
  getQuotaWindows as codexGetQuotaWindows,
} from "@titanclip/adapter-codex-local/server";
import { agentConfigurationDoc as codexAgentConfigurationDoc, models as codexModels } from "@titanclip/adapter-codex-local";
import {
  execute as cursorExecute,
  listCursorSkills,
  syncCursorSkills,
  testEnvironment as cursorTestEnvironment,
  sessionCodec as cursorSessionCodec,
} from "@titanclip/adapter-cursor-local/server";
import { agentConfigurationDoc as cursorAgentConfigurationDoc, models as cursorModels } from "@titanclip/adapter-cursor-local";
import {
  execute as geminiExecute,
  listGeminiSkills,
  syncGeminiSkills,
  testEnvironment as geminiTestEnvironment,
  sessionCodec as geminiSessionCodec,
} from "@titanclip/adapter-gemini-local/server";
import { agentConfigurationDoc as geminiAgentConfigurationDoc, models as geminiModels } from "@titanclip/adapter-gemini-local";
import {
  execute as openCodeExecute,
  listOpenCodeSkills,
  syncOpenCodeSkills,
  testEnvironment as openCodeTestEnvironment,
  sessionCodec as openCodeSessionCodec,
  listOpenCodeModels,
} from "@titanclip/adapter-opencode-local/server";
import {
  agentConfigurationDoc as openCodeAgentConfigurationDoc,
  models as openCodeModels,
} from "@titanclip/adapter-opencode-local";
import {
  execute as openclawGatewayExecute,
  testEnvironment as openclawGatewayTestEnvironment,
} from "@titanclip/adapter-openclaw-gateway/server";
import {
  agentConfigurationDoc as openclawGatewayAgentConfigurationDoc,
  models as openclawGatewayModels,
} from "@titanclip/adapter-openclaw-gateway";
import { listCodexModels } from "./codex-models.js";
import { listCursorModels } from "./cursor-models.js";
import {
  execute as piExecute,
  listPiSkills,
  syncPiSkills,
  testEnvironment as piTestEnvironment,
  sessionCodec as piSessionCodec,
  listPiModels,
} from "@titanclip/adapter-pi-local/server";
import {
  agentConfigurationDoc as piAgentConfigurationDoc,
} from "@titanclip/adapter-pi-local";
import {
  execute as hermesExecute,
  testEnvironment as hermesTestEnvironment,
  sessionCodec as hermesSessionCodec,
  listSkills as hermesListSkills,
  syncSkills as hermesSyncSkills,
  detectModel as detectModelFromHermes,
} from "hermes-paperclip-adapter/server";
import {
  agentConfigurationDoc as hermesAgentConfigurationDoc,
  models as hermesModels,
} from "hermes-paperclip-adapter";
import { processAdapter } from "./process/index.js";
import { httpAdapter } from "./http/index.js";
// Universal LLM adapter — placeholder that loads dynamically on first use
// to avoid static import issues during server compilation

const claudeLocalAdapter: ServerAdapterModule = {
  type: "claude_local",
  execute: claudeExecute,
  testEnvironment: claudeTestEnvironment,
  listSkills: listClaudeSkills,
  syncSkills: syncClaudeSkills,
  sessionCodec: claudeSessionCodec,
  sessionManagement: getAdapterSessionManagement("claude_local") ?? undefined,
  models: claudeModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: claudeAgentConfigurationDoc,
  getQuotaWindows: claudeGetQuotaWindows,
};

const codexLocalAdapter: ServerAdapterModule = {
  type: "codex_local",
  execute: codexExecute,
  testEnvironment: codexTestEnvironment,
  listSkills: listCodexSkills,
  syncSkills: syncCodexSkills,
  sessionCodec: codexSessionCodec,
  sessionManagement: getAdapterSessionManagement("codex_local") ?? undefined,
  models: codexModels,
  listModels: listCodexModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: codexAgentConfigurationDoc,
  getQuotaWindows: codexGetQuotaWindows,
};

const cursorLocalAdapter: ServerAdapterModule = {
  type: "cursor",
  execute: cursorExecute,
  testEnvironment: cursorTestEnvironment,
  listSkills: listCursorSkills,
  syncSkills: syncCursorSkills,
  sessionCodec: cursorSessionCodec,
  sessionManagement: getAdapterSessionManagement("cursor") ?? undefined,
  models: cursorModels,
  listModels: listCursorModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: cursorAgentConfigurationDoc,
};

const geminiLocalAdapter: ServerAdapterModule = {
  type: "gemini_local",
  execute: geminiExecute,
  testEnvironment: geminiTestEnvironment,
  listSkills: listGeminiSkills,
  syncSkills: syncGeminiSkills,
  sessionCodec: geminiSessionCodec,
  sessionManagement: getAdapterSessionManagement("gemini_local") ?? undefined,
  models: geminiModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: geminiAgentConfigurationDoc,
};

const openclawGatewayAdapter: ServerAdapterModule = {
  type: "openclaw_gateway",
  execute: openclawGatewayExecute,
  testEnvironment: openclawGatewayTestEnvironment,
  models: openclawGatewayModels,
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: openclawGatewayAgentConfigurationDoc,
};

const openCodeLocalAdapter: ServerAdapterModule = {
  type: "opencode_local",
  execute: openCodeExecute,
  testEnvironment: openCodeTestEnvironment,
  listSkills: listOpenCodeSkills,
  syncSkills: syncOpenCodeSkills,
  sessionCodec: openCodeSessionCodec,
  models: openCodeModels,
  sessionManagement: getAdapterSessionManagement("opencode_local") ?? undefined,
  listModels: listOpenCodeModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: openCodeAgentConfigurationDoc,
};

const piLocalAdapter: ServerAdapterModule = {
  type: "pi_local",
  execute: piExecute,
  testEnvironment: piTestEnvironment,
  listSkills: listPiSkills,
  syncSkills: syncPiSkills,
  sessionCodec: piSessionCodec,
  sessionManagement: getAdapterSessionManagement("pi_local") ?? undefined,
  models: [],
  listModels: listPiModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: piAgentConfigurationDoc,
};

const hermesLocalAdapter: ServerAdapterModule = {
  type: "hermes_local",
  execute: hermesExecute,
  testEnvironment: hermesTestEnvironment,
  sessionCodec: hermesSessionCodec,
  listSkills: hermesListSkills,
  syncSkills: hermesSyncSkills,
  models: hermesModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: hermesAgentConfigurationDoc,
  detectModel: () => detectModelFromHermes(),
};

// OpenAI-compatible HTTP endpoint adapter (also registered as universal_llm for backward compat)
const lazyExecute = async (ctx: any) => {
  const mod = await (Function("p", "return import(p)")("@titanclip/adapter-universal-llm/server") as Promise<any>);
  return mod.execute(ctx);
};
const lazyTest = async (ctx: any) => {
  const mod = await (Function("p", "return import(p)")("@titanclip/adapter-universal-llm/server") as Promise<any>);
  return mod.testEnvironment(ctx);
};
const openaiCompatModels = [
  { id: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Anthropic)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { id: "llama3", label: "Llama 3 (Ollama)" },
];
const openaiCompatDoc = "OpenAI-compatible HTTP endpoint adapter — supports OpenAI, Anthropic, Gemini, Azure, Vertex AI, Ollama, OpenRouter, and custom endpoints. Select a provider preset to auto-configure the endpoint URL.";

const openaiCompatibleAdapter: ServerAdapterModule = {
  type: "openai_compatible",
  execute: lazyExecute,
  testEnvironment: lazyTest,
  models: openaiCompatModels,
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: openaiCompatDoc,
};

// Backward compat alias
const universalLlmAdapter: ServerAdapterModule = {
  type: "universal_llm",
  execute: lazyExecute,
  testEnvironment: lazyTest,
  models: openaiCompatModels,
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: openaiCompatDoc,
};

// TitanClaw adapter — spawns the titanclaw CLI as a child process
// Similar to claude_local which spawns the `claude` CLI
let _titanClawDbRef: any = null;
export function setTitanClawDbRef(db: any) { _titanClawDbRef = db; }

async function listTitanClawModels(): Promise<{ id: string; label: string }[]> {
  if (!_titanClawDbRef) return openaiCompatModels;
  try {
    const { instanceSettingsService } = await (Function("p", "return import(p)")("../services/instance-settings.js") as Promise<any>);
    const svc = instanceSettingsService(_titanClawDbRef);
    const admin = await svc.getAdmin();
    const httpAdapters = (admin as any).httpAdapters ?? [];
    const models: { id: string; label: string }[] = [];
    for (const adapter of httpAdapters) {
      if (!adapter.enabled) continue;
      for (const modelId of adapter.models ?? []) {
        models.push({ id: `${adapter.provider}/${modelId}`, label: `${modelId} (${adapter.name})` });
      }
    }
    return models.length > 0 ? models : openaiCompatModels;
  } catch {
    return openaiCompatModels;
  }
}

// Execute by spawning the titanclaw CLI — falls back to embedded execute if CLI not found
const titanClawExecute = async (ctx: any) => {
  const config = ctx.config ?? {};
  const model = (config.model as string) ?? "";
  const apiKey = (config.apiKey as string) ?? "";
  const baseUrl = (config.baseUrl as string) ?? "";
  const userMessage = ctx.context?.userMessage ?? ctx.context?.issueTitle ?? "Execute assigned task";

  // Try CLI first
  try {
    const { execSync } = await import("child_process");
    execSync("which titanclaw", { stdio: "ignore" });

    // CLI is available — spawn it
    const { spawn } = await import("child_process");
    const args = ["run", "--task", userMessage];
    if (model) { args.push("-m", model); }
    if (apiKey) { args.push("--api-key", apiKey); }
    if (baseUrl) { args.push("--base-url", baseUrl); }

    return new Promise((resolve) => {
      let fullContent = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      let resultModel = model;
      let resultProvider = "";
      let costUsd = 0;

      const child = spawn("titanclaw", args, {
        env: { ...process.env, TITANCLIP_API_URL: "http://127.0.0.1:3100/api" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "chunk" && event.content) {
              fullContent += event.content;
              ctx.onLog("stdout", event.content);
            } else if (event.type === "tool_start") {
              ctx.onLog("stdout", `[tool] ${event.name}(${JSON.stringify(event.args)})\n`);
            } else if (event.type === "tool_result") {
              ctx.onLog("stdout", `[result] ${event.result}\n`);
            } else if (event.type === "done") {
              usage = event.usage ?? usage;
              resultModel = event.model ?? resultModel;
              resultProvider = event.provider ?? resultProvider;
              costUsd = event.costUsd ?? costUsd;
            } else if (event.type === "error") {
              ctx.onLog("stderr", `Error: ${event.error}\n`);
            }
          } catch { /* skip non-JSON lines */ }
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        ctx.onLog("stderr", data.toString());
      });

      child.on("close", (code: number) => {
        resolve({
          exitCode: code ?? 0,
          signal: null,
          timedOut: false,
          usage,
          model: resultModel,
          provider: resultProvider,
          costUsd,
          resultJson: { content: fullContent },
          summary: fullContent.slice(0, 200),
        });
      });
    });
  } catch {
    // CLI not found — fall back to embedded universal_llm execute
    const mod = await (Function("p", "return import(p)")("@titanclip/adapter-universal-llm/server") as Promise<any>);
    return mod.execute(ctx);
  }
};

const titanClawAdapter: ServerAdapterModule = {
  type: "titanclaw_local",
  execute: titanClawExecute,
  testEnvironment: lazyTest,
  models: openaiCompatModels,
  listModels: listTitanClawModels,
  supportsLocalAgentJwt: false,
  agentConfigurationDoc: `# TitanClaw Adapter\n\nUses the TitanClaw CLI for agentic task execution.\nWhen the 'titanclaw' CLI is installed, spawns it as a child process.\nFalls back to the embedded universal_llm adapter if CLI is not found.\nSupports all built-in tools: web_search, shell_exec, read_file, write_file, delegate_to_agent, hire_agent.`,
};

const adaptersByType = new Map<string, ServerAdapterModule>(
  [
    claudeLocalAdapter,
    codexLocalAdapter,
    openCodeLocalAdapter,
    piLocalAdapter,
    cursorLocalAdapter,
    geminiLocalAdapter,
    openclawGatewayAdapter,
    hermesLocalAdapter,
    universalLlmAdapter,
    openaiCompatibleAdapter,
    titanClawAdapter,
    processAdapter,
    httpAdapter,
  ].map((a) => [a.type, a]),
);

export function getServerAdapter(type: string): ServerAdapterModule {
  const adapter = adaptersByType.get(type);
  if (!adapter) {
    // Fall back to process adapter for unknown types
    return processAdapter;
  }
  return adapter;
}

export async function listAdapterModels(type: string): Promise<{ id: string; label: string }[]> {
  const adapter = adaptersByType.get(type);
  if (!adapter) return [];
  if (adapter.listModels) {
    const discovered = await adapter.listModels();
    if (discovered.length > 0) return discovered;
  }
  return adapter.models ?? [];
}

export function listServerAdapters(): ServerAdapterModule[] {
  return Array.from(adaptersByType.values());
}

export async function detectAdapterModel(
  type: string,
): Promise<{ model: string; provider: string; source: string } | null> {
  const adapter = adaptersByType.get(type);
  if (!adapter?.detectModel) return null;
  const detected = await adapter.detectModel();
  return detected ? { model: detected.model, provider: detected.provider, source: detected.source } : null;
}

export function findServerAdapter(type: string): ServerAdapterModule | null {
  return adaptersByType.get(type) ?? null;
}
