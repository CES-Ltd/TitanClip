import { pgTable, uuid, text, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const llmProviderConfigs = pgTable(
  "llm_provider_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    providerSlug: text("provider_slug").notNull(), // "openai", "anthropic", "openrouter", "ollama"
    label: text("label").notNull(),
    baseUrl: text("base_url"), // custom endpoint (Ollama, self-hosted)
    apiKeySecretId: uuid("api_key_secret_id").references(() => companySecrets.id),
    isDefault: boolean("is_default").notNull().default(false),
    status: text("status").notNull().default("active"), // active, disabled, error
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderIdx: uniqueIndex("llm_provider_configs_company_provider_idx").on(
      table.companyId,
      table.providerSlug
    ),
  })
);
