/**
 * User Credential Validator — enforces which credential types
 * non-admin users are allowed to create.
 *
 * Security policy: Users can manage dev credentials (GitHub, GitLab,
 * NPM, Docker, SSH keys, etc.) but NOT cloud LLM API keys.
 * Local LLM endpoints (ollama_local) are allowed.
 */

/** Providers users are allowed to configure */
export const USER_ALLOWED_PROVIDERS = new Set([
  "github",
  "gitlab",
  "bitbucket",
  "npm",
  "docker",
  "ollama_local",  // Local inference is OK
  "custom",
]);

/** Credential types users are allowed to create */
export const USER_ALLOWED_CREDENTIAL_TYPES = new Set([
  "access_token",
  "ssh_key",
  "oauth_token",
  "api_key",  // Generic API keys (non-LLM)
  "custom",
]);

/** LLM API providers that MUST be admin-configured */
export const BLOCKED_LLM_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "google",
  "gemini",
  "azure_ai",
  "azure",
  "openrouter",
  "ollama_cloud",
  "vertex",
  "aws_bedrock",
]);

export interface CredentialValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate whether a user (non-admin) is allowed to create a credential
 * with the given provider and type.
 */
export function validateUserCredential(
  provider: string,
  credentialType: string
): CredentialValidationResult {
  // Check blocked LLM providers
  if (BLOCKED_LLM_PROVIDERS.has(provider.toLowerCase())) {
    return {
      valid: false,
      error: `Provider "${provider}" is a cloud LLM service. LLM API keys must be configured by an administrator through the Vault. Contact your admin to add this credential.`,
    };
  }

  // Check allowed providers
  if (!USER_ALLOWED_PROVIDERS.has(provider.toLowerCase())) {
    return {
      valid: false,
      error: `Provider "${provider}" is not in the allowed list for user credentials. Allowed: ${[...USER_ALLOWED_PROVIDERS].join(", ")}`,
    };
  }

  // Check allowed credential types
  if (!USER_ALLOWED_CREDENTIAL_TYPES.has(credentialType.toLowerCase())) {
    return {
      valid: false,
      error: `Credential type "${credentialType}" is not allowed for user credentials. Allowed: ${[...USER_ALLOWED_CREDENTIAL_TYPES].join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get the list of providers and types available to users for UI dropdowns.
 */
export function getUserCredentialOptions() {
  return {
    providers: [
      { value: "github", label: "GitHub", description: "Personal access tokens" },
      { value: "gitlab", label: "GitLab", description: "Access tokens" },
      { value: "bitbucket", label: "Bitbucket", description: "App passwords" },
      { value: "npm", label: "NPM", description: "Registry tokens" },
      { value: "docker", label: "Docker", description: "Registry credentials" },
      { value: "ollama_local", label: "Ollama (Local)", description: "Local inference endpoint" },
      { value: "custom", label: "Custom", description: "Custom HTTP endpoint or API" },
    ],
    credentialTypes: [
      { value: "access_token", label: "Access Token" },
      { value: "ssh_key", label: "SSH Key" },
      { value: "oauth_token", label: "OAuth Token" },
      { value: "api_key", label: "API Key" },
      { value: "custom", label: "Custom" },
    ],
  };
}
