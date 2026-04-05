export type CredentialType = "api_key" | "ssh_key" | "oauth_token" | "service_account" | "custom";
export type CredentialProvider = "github" | "aws" | "gcp" | "azure" | "npm" | "docker" | "custom";
export type CredentialStatus = "active" | "expired" | "revoked" | "rotating";
export type CheckoutStatus = "active" | "checked_in" | "expired" | "revoked";

export interface VaultCredential {
  id: string;
  companyId: string;
  name: string;
  description: string;
  credentialType: CredentialType;
  provider: CredentialProvider;
  secretId: string | null;
  allowedAgentIds: string[] | null;
  allowedRoles: string[] | null;
  rotationPolicy: "manual" | "auto";
  rotationIntervalDays: number | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
  tokenTtlSeconds: number;
  maxConcurrentCheckouts: number;
  totalCheckouts: number;
  lastCheckedOutAt: string | null;
  lastCheckedOutByAgentId: string | null;
  status: CredentialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VaultTokenCheckout {
  id: string;
  credentialId: string;
  companyId: string;
  agentId: string;
  runId: string | null;
  envVarName: string;
  issuedAt: string;
  expiresAt: string;
  checkedInAt: string | null;
  expiredAt: string | null;
  status: CheckoutStatus;
  createdAt: string;
}

export interface VaultCheckoutResult {
  tokenId: string;
  envVarName: string;
  value: string;
  expiresAt: string;
}
