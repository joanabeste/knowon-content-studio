import crypto from "crypto";

/**
 * Symmetric encryption for secrets stored in the DB (OAuth tokens etc.).
 * Uses AES-256-GCM with a 32-byte key from INTEGRATIONS_ENCRYPTION_KEY (hex).
 *
 * Format of output: base64(iv[12] || ciphertext || authTag[16])
 */

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "INTEGRATIONS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32`.",
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${buf.length}.`,
    );
  }
  return buf;
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString("base64");
}

export function decryptString(b64: string): string {
  const key = getKey();
  const buf = Buffer.from(b64, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Encrypted payload too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
