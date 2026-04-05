import { Router } from "express";
import type { Db } from "@titanclip/db";
import { llmProviderService } from "../services/llm-providers.js";
import { assertCompanyAccess } from "./authz.js";

export function llmProviderRoutes(db: Db) {
  const router = Router();
  const svc = llmProviderService(db);

  // List available provider types (static)
  router.get("/llm-providers/available", (_req, res) => {
    res.json([
      { slug: "openai", label: "OpenAI" },
      { slug: "anthropic", label: "Anthropic" },
      { slug: "openrouter", label: "OpenRouter" },
      { slug: "ollama", label: "Ollama (Local)" },
    ]);
  });

  // List configured providers for a company
  router.get("/companies/:companyId/llm-providers", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const providers = await svc.list(companyId);
    res.json(providers);
  });

  // Get a specific provider
  router.get("/llm-providers/:id", async (req, res) => {
    const provider = await svc.getById(req.params.id as string);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    assertCompanyAccess(req, provider.companyId);
    res.json(provider);
  });

  // Create/configure a provider
  router.post("/companies/:companyId/llm-providers", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const provider = await svc.create(companyId, req.body);
    res.status(201).json(provider);
  });

  // Update a provider
  router.patch("/llm-providers/:id", async (req, res) => {
    const existing = await svc.getById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const provider = await svc.update(existing.id, req.body);
    res.json(provider);
  });

  // Delete a provider
  router.delete("/llm-providers/:id", async (req, res) => {
    const existing = await svc.getById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    await svc.remove(existing.id);
    res.json({ ok: true });
  });

  // Test a provider connection
  router.post("/llm-providers/:id/test", async (req, res) => {
    const existing = await svc.getById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const adapterMod = await (Function("p", "return import(p)")("@titanclip/adapter-universal-llm/server") as Promise<any>);
    const getProvider = adapterMod.getProvider;
    const provider = getProvider(existing.providerSlug);
    const apiKey = await svc.resolveApiKey(existing.companyId, existing.providerSlug);
    const result = await provider.testConnection({
      apiKey: apiKey ?? undefined,
      baseUrl: existing.baseUrl ?? undefined,
    });
    res.json(result);
  });

  // List models from a provider
  router.get("/llm-providers/:id/models", async (req, res) => {
    const existing = await svc.getById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    const adapterMod = await (Function("p", "return import(p)")("@titanclip/adapter-universal-llm/server") as Promise<any>);
    const getProvider = adapterMod.getProvider;
    const provider = getProvider(existing.providerSlug);
    const apiKey = await svc.resolveApiKey(existing.companyId, existing.providerSlug);
    const models = await provider.listModels({
      apiKey: apiKey ?? undefined,
      baseUrl: existing.baseUrl ?? undefined,
    });
    res.json(models);
  });

  return router;
}
