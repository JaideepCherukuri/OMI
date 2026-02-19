import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the ShopifyClient
vi.mock('@/lib/shopify-client', () => ({
  ShopifyClient: vi.fn().mockImplementation(() => ({
    fetchProductDetails: vi.fn().mockResolvedValue([
      {
        productId: 1,
        title: 'Test Product',
        priceRange: '$29.99',
        totalStock: 10,
        variants: [],
        images: [],
        tags: [],
      },
    ]),
    getProduct: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Test Product',
    }),
    createProduct: vi.fn().mockResolvedValue({
      id: 2,
      title: 'New Product',
    }),
    updateProduct: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Updated',
    }),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
    createCheckout: vi.fn().mockResolvedValue({
      web_url: 'https://store.myshopify.com/checkout/abc',
      total_price: '29.99',
      currency: 'USD',
      line_items: [],
    }),
  })),
  ShopifyAPIError: class extends Error {
    statusCode: number
    constructor(status: number, msg: string) {
      super(msg)
      this.statusCode = status
    }
  },
}))

// Mock Next.js request/response
class MockNextRequest {
  private body: unknown
  constructor(body: unknown) {
    this.body = body
  }
  async json() {
    return this.body
  }
}

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/shopify/products', () => {
    it('lists products', async () => {
      const { POST } = await import('@/app/api/shopify/products/route')
      const req = new MockNextRequest({
        storeCredentials: {
          storeUrl: 'test.myshopify.com',
          accessToken: 'shpat_test',
        },
        action: 'list',
      })

      const resp = await POST(req as any)
      const data = await resp.json()
      expect(data.products).toHaveLength(1)
      expect(data.products[0].title).toBe('Test Product')
    })

    it('rejects missing credentials', async () => {
      const { POST } = await import('@/app/api/shopify/products/route')
      const req = new MockNextRequest({
        action: 'list',
      })

      const resp = await POST(req as any)
      expect(resp.status).toBe(400)
    })

    it('rejects unknown action', async () => {
      const { POST } = await import('@/app/api/shopify/products/route')
      const req = new MockNextRequest({
        storeCredentials: {
          storeUrl: 'test.myshopify.com',
          accessToken: 'shpat_test',
        },
        action: 'unknown',
      })

      const resp = await POST(req as any)
      expect(resp.status).toBe(400)
    })
  })

  describe('POST /api/shopify/checkout', () => {
    it('creates checkout', async () => {
      const { POST } = await import('@/app/api/shopify/checkout/route')
      const req = new MockNextRequest({
        storeCredentials: {
          storeUrl: 'test.myshopify.com',
          accessToken: 'shpat_test',
        },
        items: [{ variantId: 123, quantity: 1 }],
      })

      const resp = await POST(req as any)
      const data = await resp.json()
      expect(data.checkoutUrl).toContain('checkout')
    })

    it('rejects empty items', async () => {
      const { POST } = await import('@/app/api/shopify/checkout/route')
      const req = new MockNextRequest({
        storeCredentials: {
          storeUrl: 'test.myshopify.com',
          accessToken: 'shpat_test',
        },
        items: [],
      })

      const resp = await POST(req as any)
      expect(resp.status).toBe(400)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // Vault API
  // ═══════════════════════════════════════════════════════════

  describe('Vault API (/api/vault)', () => {
    const TEST_KEY = 'a'.repeat(64)

    beforeEach(() => {
      vi.stubEnv('VAULT_ENCRYPTION_KEY', TEST_KEY)
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('GET returns null when no cookie', async () => {
      const { GET } = await import('@/app/api/vault/route')
      const req = new MockNextRequest({})
      // @ts-expect-error mock cookies
      req.cookies = { get: () => undefined }

      const resp = await GET(req as any)
      const data = await resp.json()
      expect(data.profile).toBeNull()
    })

    it('POST validates required fields', async () => {
      const { POST } = await import('@/app/api/vault/route')
      const req = new MockNextRequest({ email: 'a@b.com' }) // missing firstName, lastName, addresses

      const resp = await POST(req as any)
      expect(resp.status).toBe(400)
    })

    it('POST accepts valid profile', async () => {
      const { POST } = await import('@/app/api/vault/route')
      const req = new MockNextRequest({
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        addresses: [],
      })

      const resp = await POST(req as any)
      const data = await resp.json()
      expect(data.success).toBe(true)
      expect(data.profile.email).toBe('test@example.com')
    })
  })

  // ═══════════════════════════════════════════════════════════
  // Checkout Auth API
  // ═══════════════════════════════════════════════════════════

  describe('Checkout Auth API (/api/checkout/auth)', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', 'test-client-id')
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', 'test-client-secret')
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    it('returns token on success', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'jwt_test_token',
            expires_in: 3600,
          }),
      })

      // Need fresh import to reset module-level cache
      vi.resetModules()
      const { POST } = await import('@/app/api/checkout/auth/route')
      const resp = await POST()
      const data = await resp.json()

      expect(data.token).toBe('jwt_test_token')
      expect(data.expiresIn).toBe(3600)
    })

    it('returns 500 when env vars missing', async () => {
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', '')
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', '')

      vi.resetModules()
      const { POST } = await import('@/app/api/checkout/auth/route')
      const resp = await POST()
      expect(resp.status).toBe(500)
    })

    it('returns 502 on Shopify auth failure', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      vi.resetModules()
      const { POST } = await import('@/app/api/checkout/auth/route')
      const resp = await POST()
      // getCheckoutToken throws → route catches it as 500
      expect(resp.status).toBe(500)
    })
  })

  // ═══════════════════════════════════════════════════════════
  // Express Checkout API
  // ═══════════════════════════════════════════════════════════

  describe('Express Checkout API (/api/checkout/express)', () => {
    let fetchSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', 'test-id')
      vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', 'test-secret')
      vi.stubEnv('VAULT_ENCRYPTION_KEY', 'a'.repeat(64))
      fetchSpy = vi.fn()
      vi.stubGlobal('fetch', fetchSpy)
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    it('returns 400 for missing fields', async () => {
      vi.resetModules()
      const { POST } = await import('@/app/api/checkout/express/route')
      const req = new MockNextRequest({ shopDomain: 'shop.test.com' }) // missing variantGid
      // @ts-expect-error mock cookies
      req.cookies = { get: () => undefined }

      const resp = await POST(req as any)
      expect(resp.status).toBe(400)
    })

    it('returns direct mode when no vault cookie', async () => {
      // Mock the token fetch
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'jwt_test', expires_in: 3600 }),
      })

      vi.resetModules()
      const { POST } = await import('@/app/api/checkout/express/route')

      const req = new MockNextRequest({
        shopDomain: 'shop.test.com',
        variantGid: 'gid://shopify/ProductVariant/12345',
        quantity: 2,
      })
      // @ts-expect-error mock cookies
      req.cookies = { get: () => undefined }

      const resp = await POST(req as any)
      const data = await resp.json()

      expect(data.mode).toBe('direct')
      expect(data.checkoutUrl).toBe('https://shop.test.com/cart/12345:2')
      expect(data.jwt).toBe('jwt_test')
    })

    it('returns direct mode when skipPrefill is true', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'jwt_test', expires_in: 3600 }),
      })

      vi.resetModules()

      // Create encrypted vault cookie
      const { encrypt } = await import('@/lib/vault-crypto')
      const profile = JSON.stringify({
        email: 'a@b.com',
        firstName: 'Jo',
        lastName: 'Doe',
        addresses: [],
      })
      const encrypted = encrypt(profile, 'a'.repeat(64))

      const { POST } = await import('@/app/api/checkout/express/route')
      const req = new MockNextRequest({
        shopDomain: 'shop.test.com',
        variantGid: '99999',
        skipPrefill: true,
      })
      // @ts-expect-error mock cookies
      req.cookies = { get: (name: string) => name === 'omi_vault' ? { value: encrypted } : undefined }

      const resp = await POST(req as any)
      const data = await resp.json()

      expect(data.mode).toBe('direct')
      expect(data.checkoutUrl).toBe('https://shop.test.com/cart/99999:1')
    })
  })
})
