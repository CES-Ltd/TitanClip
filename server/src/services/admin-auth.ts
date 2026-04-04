import crypto from "node:crypto";
import type { InstanceAdminSettings } from "@titanclip/shared";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

// Per-process signing key — server restart invalidates all admin sessions
const SIGNING_KEY = crypto.randomBytes(32);

// The client sends SHA-256(pin) so plaintext never appears in requests.
// Default PIN "1234" → SHA-256("1234") = this hex string.
const DEFAULT_PIN_SHA256 = crypto.createHash("sha256").update("1234").digest("hex");

// Pre-computed scrypt hash of SHA-256("1234")
let defaultPinHash: string | null = null;

async function computeDefaultPinHash(): Promise<string> {
  if (!defaultPinHash) {
    defaultPinHash = await hashPin(DEFAULT_PIN_SHA256);
  }
  return defaultPinHash;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      pin,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt.toString("hex")}:${derivedKey.toString("hex")}`);
      },
    );
  });
}

export async function verifyPinAgainstHash(pin: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const storedKey = Buffer.from(keyHex, "hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      pin,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(crypto.timingSafeEqual(derivedKey, storedKey));
      },
    );
  });
}

export function issueAdminToken(timeoutSec: number): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + timeoutSec * 1000);
  const payload = JSON.stringify({ exp: expiresAt.getTime() });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payloadB64)
    .digest("base64url");
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

export function verifyAdminToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(payloadB64)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (typeof payload.exp !== "number") return false;
    return Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export interface AdminAuthService {
  verifyPin(pin: string): Promise<boolean>;
  changePin(currentPin: string, newPin: string): Promise<void>;
  issueToken(): { token: string; expiresAt: Date };
  verifyToken(token: string): boolean;
  isSsoMode(): boolean;
}

export function createAdminAuthService(opts: {
  getAdminSettings: () => Promise<InstanceAdminSettings>;
  updatePinHash: (hash: string) => Promise<void>;
  ssoClientId?: string;
}): AdminAuthService {
  return {
    async verifyPin(pin: string): Promise<boolean> {
      const settings = await opts.getAdminSettings();
      const hash = settings.adminPinHash ?? (await computeDefaultPinHash());
      return verifyPinAgainstHash(pin, hash);
    },

    async changePin(currentPin: string, newPin: string): Promise<void> {
      const valid = await this.verifyPin(currentPin);
      if (!valid) throw new Error("Current PIN is incorrect");
      const newHash = await hashPin(newPin);
      await opts.updatePinHash(newHash);
    },

    issueToken(): { token: string; expiresAt: Date } {
      // Use default timeout; caller can override via settings
      return issueAdminToken(1800);
    },

    verifyToken(token: string): boolean {
      return verifyAdminToken(token);
    },

    isSsoMode(): boolean {
      return !!opts.ssoClientId;
    },
  };
}
