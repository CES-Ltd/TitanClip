import os from "node:os";
import path from "node:path";

export function defaultPathForPlatform(): string {
  if (process.platform === "win32") {
    return "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\Wbem";
  }
  return "/usr/local/bin:/opt/homebrew/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";
}

function commonCommandDirsForPlatform(): string[] {
  if (process.platform === "darwin") {
    return ["/opt/homebrew/bin", "/usr/local/bin", "/usr/local/sbin", "/usr/bin"];
  }
  if (process.platform === "win32") {
    return [
      "C:\\Program Files\\nodejs",
      "C:\\Program Files\\Git\\cmd",
      "C:\\Program Files\\Git\\bin",
    ];
  }
  return ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
}

function pathKeyFromEnv(env: NodeJS.ProcessEnv): "PATH" | "Path" {
  if (typeof env.Path === "string" && typeof env.PATH !== "string") return "Path";
  return "PATH";
}

function splitPathValue(value: string, delimiter: string): string[] {
  return value
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function homeDirFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  const home = env.HOME ?? env.USERPROFILE;
  if (typeof home === "string" && home.trim().length > 0) return home.trim();
  try {
    const fallback = os.homedir();
    return typeof fallback === "string" && fallback.length > 0 ? fallback : undefined;
  } catch {
    return undefined;
  }
}

export function augmentPathEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const nextEnv = { ...env };
  const key = pathKeyFromEnv(nextEnv);
  const existingValue = typeof nextEnv[key] === "string" ? nextEnv[key] : "";
  const delimiter = process.platform === "win32" ? ";" : ":";
  const homeLocalBins = (() => {
    const dir = homeDirFromEnv(nextEnv);
    return dir ? [path.join(dir, ".local", "bin")] : [];
  })();
  const ordered = [
    ...splitPathValue(existingValue, delimiter),
    ...splitPathValue(defaultPathForPlatform(), delimiter),
    ...commonCommandDirsForPlatform(),
    ...homeLocalBins,
  ];
  nextEnv[key] = Array.from(new Set(ordered)).join(delimiter);
  if (key === "PATH") {
    delete (nextEnv as Record<string, string | undefined>).Path;
  }
  return nextEnv;
}
