import { describe, it, expect, vi, beforeEach } from 'vitest'

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
})
