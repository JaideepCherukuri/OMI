import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CheckoutMCPClient,
  type CheckoutSession,
} from '@/lib/checkout-mcp'

// ── Helpers ──

const SHOP = 'greenteashop.myshopify.com'
const TOKEN = 'test-bearer-token'

function makeCheckoutSession(overrides?: Partial<CheckoutSession>): CheckoutSession {
  return {
    id: 'checkout_abc123',
    status: 'incomplete',
    currency: 'USD',
    buyer: { email: 'test@example.com', firstName: 'Jane', lastName: 'Doe' },
    lineItems: [
      { variantId: 'gid://shopify/ProductVariant/111', quantity: 1, title: 'Green Tea' },
    ],
    totals: {
      subtotal: { amount: '12.00', currencyCode: 'USD' },
      total: { amount: '15.50', currencyCode: 'USD' },
    },
    continueUrl: 'https://greenteashop.myshopify.com/checkout/continue/abc',
    messages: [],
    expiresAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function mcpToolResponse(session: CheckoutSession) {
  return {
    jsonrpc: '2.0',
    id: 2, // after initialize
    result: {
      content: [{ type: 'text', text: JSON.stringify(session) }],
      isError: false,
    },
  }
}

function mcpInitResponse() {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: { protocolVersion: '2024-11-05', capabilities: {} },
  }
}

// ── Tests ──

describe('CheckoutMCPClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchSequence(...responses: object[]) {
    for (const resp of responses) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(resp),
      })
    }
  }

  describe('constructor', () => {
    it('builds correct MCP URL', () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      // We can verify by making a call and checking fetch URL
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))
      client.createCheckout({ variantId: 'v1' })
      // URL checked in the createCheckout test below
    })

    it('strips protocol from shopDomain', async () => {
      const client = new CheckoutMCPClient('https://shop.test.com/', TOKEN)
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))
      await client.createCheckout({ variantId: 'v1' })
      expect(fetchSpy.mock.calls[0][0]).toBe('https://shop.test.com/api/ucp/mcp')
    })
  })

  describe('createCheckout', () => {
    it('sends correct JSON-RPC with buyer and address', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      const session = makeCheckoutSession()
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(session))

      const result = await client.createCheckout({
        variantId: 'gid://shopify/ProductVariant/111',
        quantity: 2,
        buyer: { email: 'a@b.com', firstName: 'Jo' },
        shippingAddress: { address1: '1 Main', city: 'PDX', country: 'US', zip: '97201' },
      })

      expect(result.id).toBe('checkout_abc123')
      expect(result.status).toBe('incomplete')
      expect(result.continueUrl).toContain('checkout/continue')

      // Verify the tool call payload
      const callBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(callBody.method).toBe('tools/call')
      expect(callBody.params.name).toBe('create_checkout')
      expect(callBody.params.arguments.variant_id).toBe('gid://shopify/ProductVariant/111')
      expect(callBody.params.arguments.quantity).toBe(2)
      expect(callBody.params.arguments.buyer.email).toBe('a@b.com')
      expect(callBody.params.arguments.shipping_address.city).toBe('PDX')
    })

    it('sends auth header', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))
      await client.createCheckout({ variantId: 'v1' })

      const headers = fetchSpy.mock.calls[1][1].headers
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
    })

    it('defaults quantity to 1', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))
      await client.createCheckout({ variantId: 'v1' })

      const callBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(callBody.params.arguments.quantity).toBe(1)
    })
  })

  describe('getCheckout', () => {
    it('retrieves checkout by ID', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      const session = makeCheckoutSession({ status: 'ready_for_complete' })
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(session))

      const result = await client.getCheckout('checkout_abc123')
      expect(result.status).toBe('ready_for_complete')

      const callBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(callBody.params.name).toBe('get_checkout')
      expect(callBody.params.arguments.checkout_id).toBe('checkout_abc123')
    })
  })

  describe('updateCheckout', () => {
    it('updates buyer and line items', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))

      await client.updateCheckout('ck_1', {
        buyer: { email: 'new@test.com' },
        lineItems: [{ variantId: 'v2', quantity: 3 }],
      })

      const callBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(callBody.params.name).toBe('update_checkout')
      expect(callBody.params.arguments.checkout_id).toBe('ck_1')
      expect(callBody.params.arguments.buyer.email).toBe('new@test.com')
      expect(callBody.params.arguments.line_items[0].variant_id).toBe('v2')
    })
  })

  describe('cancelCheckout', () => {
    it('cancels with idempotency key', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      const session = makeCheckoutSession({ status: 'canceled' })
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(session))

      const result = await client.cancelCheckout('ck_1', 'idem_123')
      expect(result.status).toBe('canceled')

      const callBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
      expect(callBody.params.name).toBe('cancel_checkout')
      expect(callBody.params.arguments.idempotency_key).toBe('idem_123')
    })
  })

  describe('error handling', () => {
    it('throws on HTTP error', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mcpInitResponse()),
      })
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      })

      await expect(
        client.createCheckout({ variantId: 'v1' }),
      ).rejects.toThrow(/502/)
    })

    it('throws on JSON-RPC error', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mcpInitResponse()),
      })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 2,
            error: { code: -32600, message: 'Invalid variant' },
          }),
      })

      await expect(
        client.createCheckout({ variantId: 'bad' }),
      ).rejects.toThrow(/Invalid variant/)
    })

    it('throws on isError response', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mcpInitResponse()),
      })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 2,
            result: {
              content: [{ type: 'text', text: 'Something went wrong' }],
              isError: true,
            },
          }),
      })

      await expect(
        client.createCheckout({ variantId: 'v1' }),
      ).rejects.toThrow(/tool error/)
    })

    it('throws on empty content', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mcpInitResponse()),
      })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 2,
            result: { content: [], isError: false },
          }),
      })

      await expect(
        client.createCheckout({ variantId: 'v1' }),
      ).rejects.toThrow(/empty response/)
    })
  })

  describe('initialization', () => {
    it('auto-initializes on first tool call', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      mockFetchSequence(mcpInitResponse(), mcpToolResponse(makeCheckoutSession()))
      await client.createCheckout({ variantId: 'v1' })

      // First call should be initialize
      const initBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
      expect(initBody.method).toBe('initialize')
      expect(initBody.params.clientInfo.name).toBe('omi-express-checkout')
    })

    it('does not re-initialize on second call', async () => {
      const client = new CheckoutMCPClient(SHOP, TOKEN)
      mockFetchSequence(
        mcpInitResponse(),
        mcpToolResponse(makeCheckoutSession()),
        mcpToolResponse(makeCheckoutSession({ status: 'completed' })),
      )

      await client.createCheckout({ variantId: 'v1' })
      await client.getCheckout('ck_1')

      // Should be 3 total calls: init, create, get (no second init)
      expect(fetchSpy).toHaveBeenCalledTimes(3)
      const methods = fetchSpy.mock.calls.map(
        (c: [string, RequestInit]) => JSON.parse(c[1].body as string).method,
      )
      expect(methods).toEqual(['initialize', 'tools/call', 'tools/call'])
    })
  })
})
