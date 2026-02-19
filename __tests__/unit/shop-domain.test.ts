import { describe, it, expect } from 'vitest'
import { extractShopDomain } from '@/lib/shop-domain'
import type { ProductDetail } from '@/types'

function makeProduct(overrides?: Partial<ProductDetail>): ProductDetail {
  return {
    productId: 1,
    title: 'Test Product',
    descriptionHtml: '<p>desc</p>',
    vendor: 'TestVendor',
    productType: 'tea',
    tags: [],
    status: 'active',
    handle: 'test-product',
    images: [],
    variants: [],
    priceRange: '$10.00',
    totalStock: 5,
    hasDiscount: false,
    ...overrides,
  }
}

describe('extractShopDomain', () => {
  describe('from directCheckoutUrl', () => {
    it('extracts domain from full checkout URL', () => {
      const product = makeProduct({
        directCheckoutUrl: 'https://greenteashop.myshopify.com/cart/12345:1',
      })
      expect(extractShopDomain(product)).toBe('greenteashop.myshopify.com')
    })

    it('extracts domain from checkout URL with path', () => {
      const product = makeProduct({
        directCheckoutUrl:
          'https://premium-store.myshopify.com/checkouts/cn/abc123?key=xyz',
      })
      expect(extractShopDomain(product)).toBe('premium-store.myshopify.com')
    })

    it('handles custom domain', () => {
      const product = makeProduct({
        directCheckoutUrl: 'https://shop.greenteaco.com/cart/99:1',
      })
      expect(extractShopDomain(product)).toBe('shop.greenteaco.com')
    })
  })

  describe('from shopUrl', () => {
    it('extracts from shopUrl when directCheckoutUrl is absent', () => {
      const product = makeProduct({
        shopUrl: 'https://greenteashop.myshopify.com',
      })
      expect(extractShopDomain(product)).toBe('greenteashop.myshopify.com')
    })

    it('handles shopUrl with trailing slash', () => {
      const product = makeProduct({
        shopUrl: 'https://greenteashop.myshopify.com/',
      })
      expect(extractShopDomain(product)).toBe('greenteashop.myshopify.com')
    })

    it('handles shopUrl without protocol', () => {
      const product = makeProduct({
        shopUrl: 'greenteashop.myshopify.com',
      })
      expect(extractShopDomain(product)).toBe('greenteashop.myshopify.com')
    })
  })

  describe('priority', () => {
    it('prefers directCheckoutUrl over shopUrl', () => {
      const product = makeProduct({
        directCheckoutUrl: 'https://checkout.shopify.com/cart/1:1',
        shopUrl: 'https://fallback.myshopify.com',
      })
      expect(extractShopDomain(product)).toBe('checkout.shopify.com')
    })

    it('falls back to shopUrl if directCheckoutUrl is invalid', () => {
      const product = makeProduct({
        directCheckoutUrl: 'not-a-url',
        shopUrl: 'https://valid-shop.myshopify.com',
      })
      // "not-a-url" won't have a dot when parsed as hostname
      // Actually it will parse as https://not-a-url which has no dot
      expect(extractShopDomain(product)).toBe('valid-shop.myshopify.com')
    })
  })

  describe('edge cases', () => {
    it('returns null when no URLs present', () => {
      const product = makeProduct()
      expect(extractShopDomain(product)).toBeNull()
    })

    it('returns null for empty strings', () => {
      const product = makeProduct({
        directCheckoutUrl: '',
        shopUrl: '',
      })
      expect(extractShopDomain(product)).toBeNull()
    })

    it('lowercases the domain', () => {
      const product = makeProduct({
        directCheckoutUrl: 'https://GreenTeaShop.MyShopify.COM/cart/1:1',
      })
      expect(extractShopDomain(product)).toBe('greenteashop.myshopify.com')
    })

    it('returns null for localhost with port (no dot in hostname)', () => {
      const product = makeProduct({
        shopUrl: 'https://localhost:3000',
      })
      // URL.hostname strips the port → "localhost" has no dot → null
      expect(extractShopDomain(product)).toBeNull()
    })

    it('returns null for localhost (no dot)', () => {
      const product = makeProduct({
        shopUrl: 'http://localhost',
      })
      expect(extractShopDomain(product)).toBeNull()
    })
  })
})
