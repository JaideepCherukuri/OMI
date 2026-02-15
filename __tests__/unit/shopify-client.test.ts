import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShopifyClient, ShopifyAPIError } from '@/lib/shopify-client'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Map(Object.entries(headers)),
  }
}

describe('ShopifyClient', () => {
  let client: ShopifyClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new ShopifyClient({
      storeUrl: 'test-store.myshopify.com',
      accessToken: 'shpat_test_token_123',
    })
  })

  describe('constructor', () => {
    it('normalizes store URL without https prefix', () => {
      const c = new ShopifyClient({
        storeUrl: 'test-store.myshopify.com',
        accessToken: 'token',
      })
      // Verify by checking getShop constructs the right URL
      mockFetch.mockResolvedValueOnce(
        mockResponse({ shop: { name: 'Test' } }),
      )
      c.getShop()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://test-store.myshopify.com'),
        expect.anything(),
      )
    })

    it('strips trailing slashes from URL', () => {
      const c = new ShopifyClient({
        storeUrl: 'https://store.myshopify.com///',
        accessToken: 'token',
      })
      mockFetch.mockResolvedValueOnce(
        mockResponse({ shop: { name: 'Test' } }),
      )
      c.getShop()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://store.myshopify.com/admin/api/'),
        expect.anything(),
      )
    })
  })

  describe('getShop', () => {
    it('returns shop data', async () => {
      const shopData = {
        id: 1,
        name: 'Test Store',
        email: 'test@example.com',
        domain: 'test-store.myshopify.com',
      }
      mockFetch.mockResolvedValueOnce(mockResponse({ shop: shopData }))

      const result = await client.getShop()
      expect(result).toEqual(shopData)
    })
  })

  describe('getProducts', () => {
    it('fetches products', async () => {
      const products = [
        { id: 1, title: 'Product A', variants: [], images: [] },
        { id: 2, title: 'Product B', variants: [], images: [] },
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ products }),
        headers: { get: () => '' },
      })

      const result = await client.getProducts()
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Product A')
    })

    it('handles pagination via link headers', async () => {
      const page1 = [{ id: 1, title: 'A', variants: [], images: [] }]
      const page2 = [{ id: 2, title: 'B', variants: [], images: [] }]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ products: page1 }),
          headers: {
            get: (name: string) =>
              name === 'link'
                ? '<https://test.myshopify.com/admin/api/2024-01/products.json?page_info=abc>; rel="next"'
                : '',
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ products: page2 }),
          headers: { get: () => '' },
        })

      const result = await client.getProducts()
      expect(result).toHaveLength(2)
    })
  })

  describe('createProduct', () => {
    it('creates a product', async () => {
      const created = {
        id: 99,
        title: 'New Gift',
        variants: [{ id: 1, price: '29.99' }],
      }
      mockFetch.mockResolvedValueOnce(
        mockResponse({ product: created }),
      )

      const result = await client.createProduct({ title: 'New Gift' })
      expect(result.id).toBe(99)
      expect(result.title).toBe('New Gift')
    })
  })

  describe('updateProduct', () => {
    it('updates a product', async () => {
      const updated = { id: 99, title: 'Updated Gift' }
      mockFetch.mockResolvedValueOnce(
        mockResponse({ product: updated }),
      )

      const result = await client.updateProduct(99, { title: 'Updated Gift' })
      expect(result.title).toBe('Updated Gift')
    })
  })

  describe('deleteProduct', () => {
    it('deletes a product', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      })

      await expect(client.deleteProduct(99)).resolves.not.toThrow()
    })
  })

  describe('error handling', () => {
    it('throws ShopifyAPIError on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
        headers: { get: () => '' },
      })

      await expect(client.getShop()).rejects.toThrow(ShopifyAPIError)
    })

    it('retries on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limited'),
          headers: { get: () => '0.1' },
        })
        .mockResolvedValueOnce(
          mockResponse({ shop: { name: 'Test' } }),
        )

      const result = await client.getShop()
      expect(result.name).toBe('Test')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('createCheckout', () => {
    it('creates a checkout', async () => {
      const checkout = {
        token: 'abc',
        web_url: 'https://store.myshopify.com/checkout/abc',
        total_price: '299.95',
        currency: 'USD',
        line_items: [],
      }
      mockFetch.mockResolvedValueOnce(
        mockResponse({ checkout }),
      )

      const result = await client.createCheckout([
        { variant_id: 123, quantity: 1 },
      ])
      expect(result.web_url).toContain('checkout')
    })
  })

  describe('fetchProductDetails', () => {
    it('transforms raw products into ProductDetail format', async () => {
      const rawProducts = [
        {
          id: 1,
          title: 'Gift Box',
          body_html: '<p>A nice gift</p>',
          vendor: 'TestVendor',
          product_type: 'Gift',
          handle: 'gift-box',
          status: 'active',
          tags: "Valentine's Day, Birthday",
          variants: [
            {
              id: 101,
              title: 'Small',
              option1: 'Small',
              price: '29.99',
              compare_at_price: '39.99',
              sku: 'GB-S',
              inventory_quantity: 10,
              inventory_item_id: 201,
            },
            {
              id: 102,
              title: 'Large',
              option1: 'Large',
              price: '49.99',
              compare_at_price: null,
              sku: 'GB-L',
              inventory_quantity: 5,
              inventory_item_id: 202,
            },
          ],
          images: [{ src: 'https://cdn.shopify.com/img1.jpg' }],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ products: rawProducts }),
        headers: { get: () => '' },
      })

      const result = await client.fetchProductDetails(false)
      expect(result).toHaveLength(1)

      const product = result[0]
      expect(product.title).toBe('Gift Box')
      expect(product.variants).toHaveLength(2)
      expect(product.priceRange).toBe('$29.99–$49.99')
      expect(product.totalStock).toBe(15)
      expect(product.hasDiscount).toBe(true)
      expect(product.tags).toContain("Valentine's Day")
    })
  })

  describe('recommendProducts', () => {
    it('filters and ranks products', async () => {
      const rawProducts = [
        {
          id: 1, title: 'Valentine Rose', body_html: '', vendor: 'V1',
          product_type: 'Gift', handle: 'rose', status: 'active',
          tags: "Valentine's Day",
          variants: [{
            id: 10, option1: 'Red', price: '99.00', compare_at_price: null,
            sku: 'R1', inventory_quantity: 20, inventory_item_id: 100,
            title: 'Red',
          }],
          images: [{ src: 'https://example.com/rose.jpg' }],
        },
        {
          id: 2, title: 'Birthday Box', body_html: '', vendor: 'V2',
          product_type: 'Gift', handle: 'bday', status: 'active',
          tags: 'Birthday',
          variants: [{
            id: 20, option1: 'Gold', price: '150.00', compare_at_price: null,
            sku: 'B1', inventory_quantity: 5, inventory_item_id: 200,
            title: 'Gold',
          }],
          images: [],
        },
        {
          id: 3, title: 'Archived Gift', body_html: '', vendor: 'V3',
          product_type: 'Gift', handle: 'arch', status: 'archived',
          tags: "Valentine's Day",
          variants: [{
            id: 30, option1: 'A', price: '50.00', compare_at_price: null,
            sku: 'A1', inventory_quantity: 10, inventory_item_id: 300,
            title: 'A',
          }],
          images: [],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ products: rawProducts }),
        headers: { get: () => '' },
      })

      const results = await client.recommendProducts({
        occasion: "Valentine's Day",
        topN: 5,
      })

      // Should only return the active Valentine's product (not archived, not Birthday)
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Valentine Rose')
    })

    it('filters by budget', async () => {
      const rawProducts = [
        {
          id: 1, title: 'Cheap Gift', body_html: '', vendor: '',
          product_type: '', handle: 'cheap', status: 'active', tags: '',
          variants: [{
            id: 10, option1: 'A', price: '25.00', compare_at_price: null,
            sku: '', inventory_quantity: 10, inventory_item_id: 100, title: 'A',
          }],
          images: [],
        },
        {
          id: 2, title: 'Expensive Gift', body_html: '', vendor: '',
          product_type: '', handle: 'exp', status: 'active', tags: '',
          variants: [{
            id: 20, option1: 'A', price: '500.00', compare_at_price: null,
            sku: '', inventory_quantity: 10, inventory_item_id: 200, title: 'A',
          }],
          images: [],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ products: rawProducts }),
        headers: { get: () => '' },
      })

      const results = await client.recommendProducts({ budgetMax: 100 })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Cheap Gift')
    })
  })
})
