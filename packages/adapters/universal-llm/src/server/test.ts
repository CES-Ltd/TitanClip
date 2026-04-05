import type { AdapterEnvironmentTestResult } from "@titanclip/adapter-utils";
import { getProvider } from "./providers/index.js";

export async function testEnvironment(ctx: {
  config: Record<string, unknown>;
}): Promise<AdapterEnvironmentTestResult> {
  const providerSlug = (ctx.config.provider as string) ?? "openai";
  const apiKey = (ctx.config.apiKey as string) ?? "";
  const baseUrl = (ctx.config.baseUrl as string) ?? undefined;

  const checks: Array<{ label: string; status: string; message?: string }> = [];

  // Check provider exists
  try {
    const provider = getProvider(providerSlug);
    checks.push({ label: `Provider: ${provider.label}`, status: "pass" });

    // Test connectivity
    const result = await provider.testConnection({ apiKey, baseUrl });
    checks.push({
      label: "API connectivity",
      status: result.ok ? "pass" : "fail",
      message: result.error,
    });

    // List models
    if (result.ok) {
      const models = await provider.listModels({ apiKey, baseUrl });
      checks.push({
        label: `Available models: ${models.length}`,
        status: models.length > 0 ? "pass" : "warn",
      });
    }
  } catch (err: any) {
    checks.push({ label: `Provider: ${providerSlug}`, status: "fail", message: err.message });
  }

  const allPass = checks.every((c) => c.status === "pass");
  return {
    status: allPass ? "pass" : "fail",
    checks: checks as any,
  };
}
