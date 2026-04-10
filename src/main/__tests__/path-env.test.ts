import { describe, expect, it } from "vitest";
import { augmentPathEnv, defaultPathForPlatform } from "../path-env.js";

describe("path-env", () => {
  it("keeps existing PATH entries and appends platform fallbacks", () => {
    const delimiter = process.platform === "win32" ? ";" : ":";
    const seed = process.platform === "win32" ? "C:\\custom\\bin" : "/custom/bin";
    const env = augmentPathEnv({ PATH: seed });
    const pathValue = env.PATH ?? "";
    const entries = pathValue.split(delimiter).filter(Boolean);
    expect(entries[0]).toBe(seed);
    for (const fallback of defaultPathForPlatform().split(delimiter).filter(Boolean)) {
      expect(entries).toContain(fallback);
    }
  });

  it("uses Path key when PATH is absent", () => {
    const env = augmentPathEnv({ Path: "/custom/path" });
    expect(env.Path?.includes("/custom/path")).toBe(true);
    expect(env.PATH).toBeUndefined();
  });
});
