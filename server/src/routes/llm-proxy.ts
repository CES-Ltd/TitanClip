/**
 * LLM Proxy Route — server-side proxy for external LLM API calls.
 *
 * Avoids CORS issues in the Electron renderer by proxying HTTP requests
 * to external LLM endpoints through the local server (Node.js fetch
 * is not subject to browser CORS restrictions).
 */

import { Router } from "express";

export function llmProxyRoutes() {
  const router = Router();

  /**
   * POST /llm-proxy/models
   * Proxy a model discovery request to an external LLM endpoint.
   *
   * Body: { baseUrl: string, apiKey?: string, provider?: string }
   * Returns: the raw JSON response from the external endpoint.
   */
  router.post("/llm-proxy/models", async (req, res) => {
    const { baseUrl, apiKey, provider } = req.body as {
      baseUrl?: string;
      apiKey?: string;
      provider?: string;
    };

    if (!baseUrl || typeof baseUrl !== "string") {
      res.status(400).json({ error: "baseUrl is required" });
      return;
    }

    // Validate URL to prevent SSRF on internal networks
    let parsedUrl: URL;
    try {
      let modelsUrl = baseUrl.replace(/\/+$/, "");
      if (!modelsUrl.endsWith("/models")) modelsUrl += "/models";
      parsedUrl = new URL(modelsUrl);
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    // Allow localhost for Ollama and local endpoints
    const isLocalhost =
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname === "0.0.0.0" ||
      parsedUrl.hostname === "::1";

    // Block private IPs (10.x, 172.16-31.x, 192.168.x) unless localhost
    if (!isLocalhost) {
      const parts = parsedUrl.hostname.split(".");
      if (parts.length === 4) {
        const first = parseInt(parts[0]!, 10);
        const second = parseInt(parts[1]!, 10);
        if (
          first === 10 ||
          (first === 172 && second >= 16 && second <= 31) ||
          (first === 192 && second === 168)
        ) {
          res.status(403).json({ error: "Private network addresses are not allowed" });
          return;
        }
      }
    }

    // Anthropic doesn't have a /models endpoint — return static list
    if (provider === "anthropic") {
      res.json({
        data: [
          { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
          { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
          { id: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
          { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
          { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
        ],
      });
      return;
    }

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const upstream = await fetch(parsedUrl.toString(), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        res.status(upstream.status).json({
          error: `Upstream API returned ${upstream.status}: ${text.slice(0, 500)}`,
        });
        return;
      }

      const data = await upstream.json();
      res.json(data);
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        res.status(504).json({ error: "Request to upstream API timed out after 15s" });
        return;
      }
      res.status(502).json({
        error: `Failed to connect to upstream API: ${err?.message ?? "Unknown error"}`,
      });
    }
  });

  return router;
}
