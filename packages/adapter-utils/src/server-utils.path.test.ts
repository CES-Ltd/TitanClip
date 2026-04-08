import { describe, expect, it } from "vitest";
import { defaultPathForPlatform, ensurePathInEnv } from "./server-utils.js";

describe("ensurePathInEnv", () => {
  it("augments sparse PATH instead of leaving it untouched", () => {
    const delimiter = process.platform === "win32" ? ";" : ":";
    const seed = process.platform === "win32" ? "C:\\custom\\bin" : "/custom/bin";
    const env = ensurePathInEnv({ PATH: seed });
    const pathValue = env.PATH ?? "";
    const entries = pathValue.split(delimiter).filter(Boolean);
    expect(entries[0]).toBe(seed);
    for (const fallback of defaultPathForPlatform().split(delimiter).filter(Boolean)) {
      expect(entries).toContain(fallback);
    }
  });

  it("provides fallback PATH when PATH is missing", () => {
    const env = ensurePathInEnv({});
    const pathValue = env.PATH ?? env.Path ?? "";
    expect(pathValue.length).toBeGreaterThan(0);
  });

  it("appends ~/.local/bin when HOME is set (user-local CLIs such as Cursor agent)", () => {
    if (process.platform === "win32") return;
    const env = ensurePathInEnv({ HOME: "/Users/example", PATH: "/usr/bin" });
    expect(env.PATH ?? "").toContain("/Users/example/.local/bin");
  });

  it("appends user .local\\bin from USERPROFILE on Windows when set", () => {
    if (process.platform !== "win32") return;
    const env = ensurePathInEnv({ USERPROFILE: "C:\\Users\\example", Path: "C:\\Windows" });
    const pathValue = env.PATH ?? env.Path ?? "";
    expect(pathValue).toContain("C:\\Users\\example\\.local\\bin");
  });
});
