import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "@titanclip/adapter-claude-local/ui";
import { ClaudeLocalConfigFields } from "./config-fields";
import { buildClaudeLocalConfig } from "@titanclip/adapter-claude-local/ui";

export const claudeLocalUIAdapter: UIAdapterModule = {
  type: "claude_local",
  label: "Claude Code (local)",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: ClaudeLocalConfigFields,
  buildAdapterConfig: buildClaudeLocalConfig,
};
