/**
 * Secure Buyer Vault — AES-256-GCM Encryption
 *
 * Encrypts/decrypts buyer profile data for storage in httpOnly cookies.
 * Key: VAULT_ENCRYPTION_KEY env var (32 bytes = 64 hex chars).
 * Format: base64(iv):base64(ciphertext):base64(authTag)
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const TAG_LENGTH = 16 // 128-bit auth tag

/**
 * Get the vault encryption key from environment.
 * Must be a 32-byte (64 hex character) string.
 */
export function getVaultKey(): Buffer {
  const hex = process.env.VAULT_ENCRYPTION_KEY
  if (!hex) {
    throw new Error('VAULT_ENCRYPTION_KEY is not set')
  }
  if (hex.length !== 64) {
    throw new Error(
      `VAULT_ENCRYPTION_KEY must be 64 hex chars (32 bytes), got ${hex.length}`,
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt plaintext with AES-256-GCM.
 *
 * @param data  - Plaintext string to encrypt
 * @param key   - 64-char hex key (or uses VAULT_ENCRYPTION_KEY if omitted)
 * @returns     - "base64(iv):base64(ciphertext):base64(tag)"
 */
export function encrypt(data: string, key?: string): string {
  const keyBuf = key ? Buffer.from(key, 'hex') : getVaultKey()
  if (keyBuf.length !== 32) {
    throw new Error('Encryption key must be 32 bytes')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuf, iv, {
    authTagLength: TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':')
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 *
 * @param encrypted - "base64(iv):base64(ciphertext):base64(tag)"
 * @param key       - 64-char hex key (or uses VAULT_ENCRYPTION_KEY if omitted)
 * @returns         - Decrypted plaintext string
 */
export function decrypt(encrypted: string, key?: string): string {
  const keyBuf = key ? Buffer.from(key, 'hex') : getVaultKey()
  if (keyBuf.length !== 32) {
    throw new Error('Encryption key must be 32 bytes')
  }

  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format (expected iv:ciphertext:tag)')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const ciphertext = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`)
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH}, got ${tag.length}`)
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuf, iv, {
    authTagLength: TAG_LENGTH,
  })
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
