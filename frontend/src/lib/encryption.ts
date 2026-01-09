/**
 * API Key Encryption Utilities
 *
 * Provides secure encryption/decryption for API keys using AES-256-GCM.
 * Keys are encrypted before storage and only decrypted when needed.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY';

/**
 * Get the encryption key from environment variables
 * @throws Error if ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const key = process.env[ENCRYPTION_KEY_ENV];

  if (!key) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} environment variable is not set. ` +
      `Generate one with: openssl rand -hex 32`
    );
  }

  // Ensure the key is exactly 32 bytes (64 hex characters)
  if (key.length !== 64) {
    throw new Error(
      `${ENCRYPTION_KEY_ENV} must be 32 bytes (64 hex characters). ` +
      `Current length: ${key.length}`
    );
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt an API key using AES-256-GCM
 *
 * @param apiKey - The plain text API key to encrypt
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 *
 * @example
 * const encrypted = encryptApiKey('sk-1234567890abcdef');
 * // Returns: "a1b2c3d4...f0:e1f2a3b4...c0:d1e2f3a4..."
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const encryptionKey = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted (all hex encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(
      `Failed to encrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt an encrypted API key
 *
 * @param encrypted - The encrypted string from encryptApiKey
 * @returns The original plain text API key
 *
 * @example
 * const decrypted = decryptApiKey(encrypted);
 * // Returns: "sk-1234567890abcdef"
 */
export function decryptApiKey(encrypted: string): string {
  try {
    const parts = encrypted.split(':');

    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted format. Expected format: iv:authTag:encrypted'
      );
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Missing required encryption components');
    }

    const encryptionKey = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(
      `Failed to decrypt API key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Mask an API key for display purposes
 *
 * Shows only the first 4 and last 4 characters, masking the middle.
 * For keys shorter than 8 characters, masks everything.
 *
 * @param apiKey - The plain text API key to mask
 * @returns Masked string
 *
 * @example
 * maskApiKey('sk-1234567890abcdef')
 * // Returns: "sk-1************cdef"
 *
 * maskApiKey('short')
 * // Returns: "*****"
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return '';
  }

  // For very short keys, mask everything
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length);
  }

  const start = apiKey.slice(0, 4);
  const end = apiKey.slice(-4);
  const middleLength = apiKey.length - 8;

  return `${start}${'*'.repeat(middleLength)}${end}`;
}

/**
 * Validate that an API key can be successfully encrypted and decrypted
 *
 * @param apiKey - The API key to validate
 * @returns true if valid, throws error otherwise
 *
 * @example
 * try {
 *   validateApiKeyEncryption('sk-test123');
 *   console.log('API key encryption is working');
 * } catch (error) {
 *   console.error('Encryption validation failed:', error);
 * }
 */
export function validateApiKeyEncryption(apiKey: string): boolean {
  const encrypted = encryptApiKey(apiKey);
  const decrypted = decryptApiKey(encrypted);

  if (decrypted !== apiKey) {
    throw new Error('Encryption validation failed: decrypted value does not match original');
  }

  return true;
}

/**
 * Generate a random encryption key for development/testing
 *
 * @returns A 32-byte hex string suitable for use as ENCRYPTION_KEY
 *
 * @example
 * const key = generateEncryptionKey();
 * console.log(`ENCRYPTION_KEY=${key}`);
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
