import { z } from "zod";

export const credentialTypeSchema = z.enum(["api_key", "ssh_key", "oauth_token", "service_account", "custom"]);
export const credentialProviderSchema = z.enum(["github", "aws", "gcp", "azure", "npm", "docker", "custom"]);

export const createVaultCredentialSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  credentialType: credentialTypeSchema.default("api_key"),
  provider: credentialProviderSchema.default("custom"),
  value: z.string().min(1).max(100_000), // The actual secret value (will be encrypted)
  envVarName: z.string().min(1).max(200), // e.g. "GITHUB_TOKEN"
  allowedAgentIds: z.array(z.string().uuid()).nullable().default(null),
  allowedRoles: z.array(z.string()).nullable().default(null),
  rotationPolicy: z.enum(["manual", "auto"]).default("manual"),
  rotationIntervalDays: z.number().int().min(1).max(365).nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  tokenTtlSeconds: z.number().int().min(60).max(86400).default(3600),
  maxConcurrentCheckouts: z.number().int().min(1).max(100).default(5),
});

export const updateVaultCredentialSchema = createVaultCredentialSchema
  .omit({ value: true })
  .partial();

export const rotateVaultCredentialSchema = z.object({
  newValue: z.string().min(1).max(100_000),
});

export type CreateVaultCredential = z.infer<typeof createVaultCredentialSchema>;
export type UpdateVaultCredential = z.infer<typeof updateVaultCredentialSchema>;
