import crypto from 'node:crypto';
import argon2 from 'argon2';
import { serverEnv } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit NIST recommended IV size for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag
const KEY_VERSION = 'v1';

/**
 * @name CryptographicIntegrityError
 * @description [Security]: Thrown when encrypted payload tampering or key mismatch is detected.
 */
export class CryptographicIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptographicIntegrityError';
  }
}

/**
 * @name getMasterKeyBuffer
 * @description [Security]: Derives the 256-bit binary key buffer from validated hex environment secret.
 */
function getMasterKeyBuffer(): Buffer {
  return Buffer.from(serverEnv.ENCRYPTION_MASTER_KEY, 'hex');
}

/**
 * @name encryptPII
 * @description [Business Logic]: Encrypts sensitive customer/employee Personally Identifiable
 * Information (National ID, RIF, WhatsApp phone numbers, bank accounts) using AES-256-GCM
 * with a unique 96-bit random IV per record before persisting to PostgreSQL.
 */
export function encryptPII(plaintext: string): string {
  const normalized = plaintext.trim();
  if (!normalized) {
    throw new CryptographicIntegrityError('Cannot encrypt an empty PII value.');
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const key = getMasterKeyBuffer();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${KEY_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * @name decryptPII
 * @description [Business Logic]: Decrypts AES-256-GCM protected PII records and verifies
 * cryptographic authenticity tags to guarantee data has not been tampered with at rest.
 */
export function decryptPII(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 4 || parts[0] !== KEY_VERSION) {
    throw new CryptographicIntegrityError('Malformed or unsupported encrypted payload format.');
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new CryptographicIntegrityError('Invalid cryptographic IV or authentication tag length.');
  }

  try {
    const key = getMasterKeyBuffer();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    throw new CryptographicIntegrityError('PII decryption failed due to authentication tag mismatch.');
  }
}

/**
 * @name computeBlindIndex
 * @description [Business Logic]: Generates a deterministic, keyed HMAC-SHA256 lookup token
 * so the platform can query encrypted identifiers (RIF, National ID, WhatsApp phone)
 * without exposing plaintext values in database indexes or query logs.
 */
export function computeBlindIndex(rawValue: string): string {
  const canonical = rawValue.replace(/[\s\-+().]/g, '').toUpperCase();
  return crypto
    .createHmac('sha256', serverEnv.BLIND_INDEX_PEPPER)
    .update(canonical)
    .digest('hex');
}

/**
 * @name hashPassword
 * @description [Business Logic]: Hashes user passwords using Argon2id (64MB memory cost,
 * 3 time iterations, parallelism 4) to resist GPU and ASIC brute-force attacks.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * @name verifyPassword
 * @description [Business Logic]: Verifies a user password against its stored Argon2id hash
 * using constant-time verification to prevent timing side-channel attacks.
 */
export async function verifyPassword(
  storedHash: string,
  candidatePassword: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, candidatePassword);
  } catch {
    return false;
  }
}

/**
 * @name generateCryptographicToken
 * @description [Business Logic]: Generates a 256-bit URL-safe random token for magic links,
 * employee invitations, and refresh tokens, returning both the raw delivery token and
 * its SHA-256 digest for safe database persistence.
 */
export function generateCryptographicToken(byteLength = 32): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = crypto.randomBytes(byteLength).toString('base64url');
  const tokenHash = hashSha256(rawToken);
  return { rawToken, tokenHash };
}

/**
 * @name hashSha256
 * @description [Security]: Computes a deterministic SHA-256 hex digest for tokens and IP addresses.
 */
export function hashSha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * @name constantTimeEqual
 * @description [Security]: Compares two strings in constant time via `crypto.timingSafeEqual`
 * to eliminate timing side-channel leaks during signature or token checks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to keep execution time uniform
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}