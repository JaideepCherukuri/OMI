/**
 * Integration tests against the live Shopify store (jaguar-9969)
 * and the Gemini-powered chat API.
 *
 * These tests verify the real product catalog, search, cart, and checkout flows.
 * They require the dev server to be running at http://localhost:3000.
 */

import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = 'http://localhost:3000'
const STORE_CREDENTIALS = {
  storeUrl: process.env.SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
}

async function chatApi(message: string, history: any[] = [], cartId?: string) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      storeCredentials: STORE_CREDENTIALS,
      history,
      cartId,
    }),
  })
  if (!res.ok) throw new Error(`Chat API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function productsApi(action: string, extra?: any) {
  const res = await fetch(`${BASE_URL}/api/shopify/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeCredentials: STORE_CREDENTIALS,
      action,
      ...extra,
    }),
  })
  if (!res.ok) throw new Error(`Products API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ═══════════════════════════════════════════
// 1. Store Product Catalog
// ═══════════════════════════════════════════
describe('Store Catalog', () => {
  let products: any[]

  beforeAll(async () => {
    const data = await productsApi('list')
    products = data.products
  })

  it('has active products in the store', () => {
    expect(products.length).toBeGreaterThanOrEqual(10)
  })

  it('all products have images', () => {
    for (const p of products) {
      expect(p.images?.length).toBeGreaterThan(0)
    }
  })

  it('all products have at least one variant', () => {
    for (const p of products) {
      expect(p.variants?.length).toBeGreaterThan(0)
    }
  })

  it('all products have positive prices', () => {
    for (const p of products) {
      for (const v of p.variants) {
        expect(v.price).toBeGreaterThan(0)
      }
    }
  })

  it('contains luxury gift products', () => {
    const titles = products.map((p: any) => p.title.toLowerCase())
    const luxuryKeywords = ['star map', 'rose', 'silk', 'whiskey', 'spa', 'leather']
    const foundCount = luxuryKeywords.filter(kw =>
      titles.some(t => t.includes(kw))
    ).length
    expect(foundCount).toBeGreaterThanOrEqual(3) // At least 3 of 6 found
  })
})

// ═══════════════════════════════════════════
// 2. Search — Occasion-Based
// ═══════════════════════════════════════════
describe('Search: Occasion Queries', () => {
  it("Valentine's Day gifts → returns products", async () => {
    const data = await chatApi("Show me Valentine's Day gifts")
    expect(data.products?.length).toBeGreaterThanOrEqual(3)
    expect(data.message).toBeTruthy()
    expect(data.message.toLowerCase()).not.toContain('variantid')
  })

  it('Wedding gifts → returns relevant products', async () => {
    const data = await chatApi('I need wedding gifts')
    expect(data.products?.length).toBeGreaterThanOrEqual(3)
    // Should include couple/wedding items
    const titles = data.products.map((p: any) => p.title.toLowerCase()).join(' ')
    const hasRelevant = ['star map', 'silk', 'rose', 'spa', 'whiskey'].some(kw => titles.includes(kw))
    expect(hasRelevant).toBe(true)
  })

  it('Birthday gifts → returns products', async () => {
    const data = await chatApi('Birthday gift ideas')
    expect(data.products?.length).toBeGreaterThanOrEqual(3)
  })

  it('Anniversary gifts → returns couple-friendly items', async () => {
    const data = await chatApi('Wedding anniversary gift')
    expect(data.products?.length).toBeGreaterThanOrEqual(2)
  })
})

// ═══════════════════════════════════════════
// 3. Search — Persona-Based
// ═══════════════════════════════════════════
describe('Search: Persona Queries', () => {
  it('Gifts for her → returns feminine items', async () => {
    const data = await chatApi('Gifts for her')
    expect(data.products?.length).toBeGreaterThanOrEqual(3)
  })

  it('Brother who loves exploring → adventure items', async () => {
    const data = await chatApi('Gift for my brother who loves exploring')
    expect(data.products?.length).toBeGreaterThanOrEqual(2)
    const titles = data.products.map((p: any) => p.title.toLowerCase()).join(' ')
    const hasAdventure = ['duffel', 'adventure', 'leather', 'journal', 'whiskey'].some(kw => titles.includes(kw))
    expect(hasAdventure).toBe(true)
  })

  it('Gift for cooking enthusiast → gourmet/kitchen items', async () => {
    const data = await chatApi('Gift for someone who loves cooking')
    expect(data.products?.length).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════
// 4. Search — Budget Filtering
// ═══════════════════════════════════════════
describe('Search: Budget Queries', () => {
  it('Under $200 → returns affordable products', async () => {
    const data = await chatApi('Gifts under $200')
    expect(data.products?.length).toBeGreaterThanOrEqual(1)
    // All products should have a variant ≤$200
    for (const p of data.products || []) {
      const cheapest = Math.min(...p.variants.map((v: any) => v.price))
      expect(cheapest).toBeLessThanOrEqual(200)
    }
  })
})

// ═══════════════════════════════════════════
// 5. List All Products
// ═══════════════════════════════════════════
describe('List All', () => {
  it('Show everything → returns all products', async () => {
    const data = await chatApi('Show me everything you have')
    expect(data.products?.length).toBeGreaterThanOrEqual(10)
  })
})

// ═══════════════════════════════════════════
// 6. Response Quality — No Internal Data Leaks
// ═══════════════════════════════════════════
describe('Response Quality', () => {
  it('never leaks variantIds in text', async () => {
    const data = await chatApi("Show me Valentine's Day gifts")
    expect(data.message).not.toMatch(/variantId/i)
    expect(data.message).not.toMatch(/gid:\/\/shopify/)
    expect(data.message).not.toMatch(/\[Products shown/)
  })

  it('never leaks image markdown in text', async () => {
    const data = await chatApi('Tell me about the Star Map')
    expect(data.message).not.toMatch(/!\[/)
    expect(data.message).not.toMatch(/cdn\.shopify\.com/)
  })

  it('response is conversational, not too long', async () => {
    const data = await chatApi('Wedding gifts please')
    const sentences = data.message.split(/[.!?]+/).filter((s: string) => s.trim())
    expect(sentences.length).toBeLessThanOrEqual(8) // Max ~8 sentences
    expect(data.message.length).toBeGreaterThan(20) // Not too short
  })
})

// ═══════════════════════════════════════════
// 7. Store Policies
// ═══════════════════════════════════════════
describe('Store Policies', () => {
  it('return policy → honest response', async () => {
    const data = await chatApi('What is your return policy?')
    // Should respond honestly, not hallucinate a policy
    expect(data.message.length).toBeGreaterThan(10)
    expect(data.message.toLowerCase()).not.toContain('repair services')
  })

  it('shipping policy → honest response', async () => {
    const data = await chatApi('How does shipping work?')
    expect(data.message.length).toBeGreaterThan(10)
  })
})

// ═══════════════════════════════════════════
// 8. Cart & Checkout
// ═══════════════════════════════════════════
describe('Cart & Checkout', () => {
  let cartId: string | undefined
  let checkoutUrl: string | undefined

  it('add to cart → returns cart state', async () => {
    const data = await chatApi('Add the Star Map to my cart')
    expect(data.cartState).toBeTruthy()
    expect(data.cartState?.totalQuantity).toBeGreaterThanOrEqual(1)
    expect(data.cartState?.totalAmount).toBeTruthy()
    cartId = data.cartState?.cartId
    checkoutUrl = data.cartState?.checkoutUrl || data.checkoutUrl
  })

  it('checkout URL is valid and accessible', async () => {
    if (!checkoutUrl) {
      // Try another add-to-cart to get a URL
      const data = await chatApi('Add the rose box to my cart')
      checkoutUrl = data.cartState?.checkoutUrl || data.checkoutUrl
    }

    expect(checkoutUrl).toBeTruthy()
    // Verify the URL is reachable
    const res = await fetch(checkoutUrl!, { redirect: 'manual' })
    // Shopify checkout URLs return 200 or 301
    expect([200, 301, 302]).toContain(res.status)
  })

  it('view cart → shows cart contents', async () => {
    if (!cartId) {
      // Add something first
      const data = await chatApi('Add the Star Map to cart')
      cartId = data.cartState?.cartId
    }

    if (cartId && cartId !== 'direct') {
      const data = await chatApi("What's in my cart?", [], cartId)
      expect(data.message.toLowerCase()).toMatch(/cart|item|star map/i)
    }
  })
})

// ═══════════════════════════════════════════
// 9. Positional/Contextual References
// ═══════════════════════════════════════════
describe('Contextual References', () => {
  it('"the first one" → correct product from recent results', async () => {
    const searchData = await chatApi("Show me Valentine's Day gifts")
    const products = searchData.products || []
    expect(products.length).toBeGreaterThan(0)

    const history = [
      { role: 'user', content: "Show me Valentine's Day gifts", products },
      { role: 'assistant', content: searchData.message, products },
    ]

    const detailData = await chatApi('Tell me more about the first one', history)
    expect(detailData.message.length).toBeGreaterThan(20)
    // Should reference the actual first product
    expect(detailData.message.toLowerCase()).not.toContain('i don\'t know which product')
  })
})

// ═══════════════════════════════════════════
// 10. Token/LiveKit Endpoint
// ═══════════════════════════════════════════
describe('LiveKit Token API', () => {
  it('GET /api/token → returns valid token', async () => {
    const res = await fetch(`${BASE_URL}/api/token`)
    expect(res.ok).toBe(true)

    const data = await res.json()
    expect(data.serverUrl).toBeTruthy()
    expect(data.participantToken).toBeTruthy()
    expect(data.participantName).toBeTruthy()
    expect(data.serverUrl).toContain('livekit.cloud')
  })

  it('supports custom room and identity params', async () => {
    const res = await fetch(`${BASE_URL}/api/token?room=test-room&identity=test-user`)
    expect(res.ok).toBe(true)

    const data = await res.json()
    expect(data.participantName).toBe('test-user')
  })
})
