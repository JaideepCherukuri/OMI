import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

// Generate a deterministic test key (32 bytes = 64 hex chars)
const TEST_KEY = 'a'.repeat(64) // 0xaa...aa

describe('vault-crypto', () => {
  beforeEach(() => {
    vi.stubEnv('VAULT_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a simple string', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const plaintext = 'Hello, vault!'
      const encrypted = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('encrypts and decrypts JSON buyer profile', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const profile = {
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        addresses: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            streetAddress: '123 Main St',
            addressLocality: 'Portland',
            addressRegion: 'OR',
            postalCode: '97201',
            addressCountry: 'US',
          },
        ],
      }
      const json = JSON.stringify(profile)
      const encrypted = encrypt(json, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      expect(JSON.parse(decrypted)).toEqual(profile)
    })

    it('encrypts and decrypts unicode content', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const plaintext = '日本語テスト 🎉 émojis!'
      const encrypted = encrypt(plaintext, TEST_KEY)
      expect(decrypt(encrypted, TEST_KEY)).toBe(plaintext)
    })

    it('encrypts and decrypts empty string', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('', TEST_KEY)
      expect(decrypt(encrypted, TEST_KEY)).toBe('')
    })

    it('produces different ciphertext on each call (random IV)', async () => {
      const { encrypt } = await import('@/lib/vault-crypto')
      const plaintext = 'same input'
      const a = encrypt(plaintext, TEST_KEY)
      const b = encrypt(plaintext, TEST_KEY)
      expect(a).not.toBe(b) // different IVs
    })

    it('uses env key when no key argument provided', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const plaintext = 'env key test'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('format', () => {
    it('encrypted output has 3 base64 parts separated by colons', async () => {
      const { encrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('test', TEST_KEY)
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(3)

      // Each part should be valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow()
      }
    })

    it('IV is 12 bytes (96-bit)', async () => {
      const { encrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('test', TEST_KEY)
      const iv = Buffer.from(encrypted.split(':')[0], 'base64')
      expect(iv.length).toBe(12)
    })

    it('auth tag is 16 bytes (128-bit)', async () => {
      const { encrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('test', TEST_KEY)
      const tag = Buffer.from(encrypted.split(':')[2], 'base64')
      expect(tag.length).toBe(16)
    })
  })

  describe('wrong key', () => {
    it('throws when decrypting with a different key', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const otherKey = 'b'.repeat(64)
      const encrypted = encrypt('secret', TEST_KEY)
      expect(() => decrypt(encrypted, otherKey)).toThrow()
    })
  })

  describe('tampered data', () => {
    it('throws when ciphertext is modified', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('secret', TEST_KEY)
      const [iv, cipher, tag] = encrypted.split(':')
      // Flip a byte in the ciphertext
      const buf = Buffer.from(cipher, 'base64')
      buf[0] ^= 0xff
      const tampered = [iv, buf.toString('base64'), tag].join(':')
      expect(() => decrypt(tampered, TEST_KEY)).toThrow()
    })

    it('throws when auth tag is modified', async () => {
      const { encrypt, decrypt } = await import('@/lib/vault-crypto')
      const encrypted = encrypt('secret', TEST_KEY)
      const [iv, cipher, tag] = encrypted.split(':')
      const buf = Buffer.from(tag, 'base64')
      buf[0] ^= 0xff
      const tampered = [iv, cipher, buf.toString('base64')].join(':')
      expect(() => decrypt(tampered, TEST_KEY)).toThrow()
    })

    it('throws on malformed input (missing parts)', async () => {
      const { decrypt } = await import('@/lib/vault-crypto')
      expect(() => decrypt('just-one-part', TEST_KEY)).toThrow(/format/)
    })

    it('throws on empty string', async () => {
      const { decrypt } = await import('@/lib/vault-crypto')
      expect(() => decrypt('', TEST_KEY)).toThrow()
    })
  })

  describe('key validation', () => {
    it('throws when key is wrong length', async () => {
      const { encrypt } = await import('@/lib/vault-crypto')
      expect(() => encrypt('test', 'tooshort')).toThrow(/32 bytes/)
    })

    it('throws when VAULT_ENCRYPTION_KEY is missing', async () => {
      vi.stubEnv('VAULT_ENCRYPTION_KEY', '')
      // Re-import to pick up new env
      const mod = await import('@/lib/vault-crypto')
      expect(() => mod.getVaultKey()).toThrow(/not set/)
    })

    it('throws when VAULT_ENCRYPTION_KEY is wrong length', async () => {
      vi.stubEnv('VAULT_ENCRYPTION_KEY', 'abcd')
      const mod = await import('@/lib/vault-crypto')
      expect(() => mod.getVaultKey()).toThrow(/64 hex chars/)
    })
  })
})
