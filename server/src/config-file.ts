import fs from "node:fs";
import { titanclipConfigSchema, type TitanClipConfig } from "@titanclip/shared";
import { resolveTitanClipConfigPath } from "./paths.js";

export function readConfigFile(): TitanClipConfig | null {
  const configPath = resolveTitanClipConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return titanclipConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
