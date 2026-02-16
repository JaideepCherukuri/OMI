/**
 * Shopify MCP Client — JSON-RPC 2.0
 * Connects to the store's /api/mcp endpoint for product search, cart, and policies.
 *
 * MCP response format (Feb 2026):
 *   search_shop_catalog → {products, pagination, available_filters, instructions}
 *   update_cart → {instructions, cart, errors}
 *   get_cart → {instructions, cart, errors}
 */

import type { CartState, CartLineItem } from '@/types'

// ── MCP product shape (as returned by search_shop_catalog) ──

export interface MCPProduct {
  product_id: string
  title: string
  description: string
  image_url: string
  price_range: { min: string; max: string; currency: string }
  product_type?: string
  tags?: string[]
  vendor?: string
  variants: MCPVariant[]
}

export interface MCPVariant {
  variant_id: string
  title: string
  price: string
  currency: string
  image_url?: string
  available: boolean
}

// ── MCP cart shape (as returned by update_cart / get_cart) ──

interface MCPCartLine {
  id: string
  quantity: number
  cost: {
    total_amount: { amount: string; currency: string }
    subtotal_amount?: { amount: string; currency: string }
  }
  merchandise: {
    id: string
    title: string
    product: { id: string; title: string }
  }
}

interface MCPCart {
  id: string
  created_at?: string
  updated_at?: string
  lines: MCPCartLine[]
  cost: {
    total_amount: { amount: string; currency: string }
    subtotal_amount?: { amount: string; currency: string }
  }
  total_quantity: number
  checkout_url: string
  delivery?: unknown
  discounts?: unknown
  gift_cards?: unknown[]
}

interface MCPCartResponse {
  instructions?: string
  cart: MCPCart
  errors: Array<{ message: string }> | []
}

interface MCPSearchResponse {
  products: MCPProduct[]
  pagination?: unknown
  available_filters?: unknown
  instructions?: string
}

interface MCPToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

// ═══════════════════════════════════════════

export class ShopifyMCPClient {
  private storeUrl: string
  private mcpUrl: string
  private sessionId: string
  private requestId: number = 0
  private tools: string[] = []

  constructor(storeUrl: string, sessionId?: string) {
    let url = storeUrl.trim().replace(/\/+$/, '')
    if (!url.startsWith('http')) url = `https://${url}`
    this.storeUrl = url
    this.mcpUrl = `${this.storeUrl}/api/mcp`
    // Use provided session ID for persistence, or generate a new one
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  getSessionId(): string {
    return this.sessionId
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    this.requestId++
    const body = {
      jsonrpc: '2.0',
      id: this.requestId,
      method,
      params: params || {},
    }

    const res = await fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-MCP-Session-Id': this.sessionId,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`MCP request failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    if (data.error) {
      throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`)
    }
    return data.result
  }

  async initialize(): Promise<boolean> {
    try {
      await this.rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'giftai-chat', version: '2.0.0' },
      })

      const toolsResult = await this.rpc('tools/list') as { tools?: Array<{ name: string }> }
      this.tools = (toolsResult?.tools || []).map(t => t.name)
      return this.tools.length > 0
    } catch {
      return false
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.rpc('tools/call', { name, arguments: args })
    return result as MCPToolResult
  }

  // ── Product Search ──

  async searchProducts(query: string, context?: string): Promise<MCPProduct[]> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('search_shop_catalog', {
        query,
        context: context || query,
        limit: 10,
      })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'

      try {
        const parsed = JSON.parse(text) as MCPSearchResponse
        return parsed.products || []
      } catch {
        return []
      }
    } catch {
      return []
    }
  }

  // ── Cart Operations ──

  /**
   * Add items to cart (or create a new cart if no cartId provided).
   * Uses `product_variant_id` field as required by MCP.
   */
  async addToCart(
    items: Array<{ variantId: string; quantity: number }>,
    cartId?: string
  ): Promise<CartState | null> {
    try {
      if (!this.tools.length) await this.initialize()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args: Record<string, any> = {
        add_items: items.map(item => ({
          product_variant_id: item.variantId,
          quantity: item.quantity,
        })),
      }
      if (cartId) args.cart_id = cartId

      const result = await this.callTool('update_cart', args)
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      const parsed = JSON.parse(text) as MCPCartResponse

      if (parsed.errors?.length) {
        console.error('MCP cart errors:', parsed.errors)
      }

      if (!parsed.cart) return null
      return this.parseMCPCart(parsed.cart)
    } catch (e) {
      console.error('MCP addToCart failed:', e)
      return null
    }
  }

  /**
   * Get cart by ID. Returns null if cart not found.
   */
  async getCartById(cartId: string): Promise<CartState | null> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('get_cart', { cart_id: cartId })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      const parsed = JSON.parse(text) as MCPCartResponse

      if (!parsed.cart) return null
      return this.parseMCPCart(parsed.cart)
    } catch {
      return null
    }
  }

  // ── Policies ──

  async getStorePolicies(query: string): Promise<string> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('search_shop_policies_and_faqs', { query })
      return result.content?.find(c => c.type === 'text')?.text || ''
    } catch {
      return ''
    }
  }

  // ── Product Details ──

  async getProductDetails(productId: string): Promise<MCPProduct | null> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('get_product_details', { product_id: productId })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  // ── Helpers ──

  private parseMCPCart(cart: MCPCart): CartState {
    const lines: CartLineItem[] = cart.lines.map(line => ({
      lineId: line.id,
      variantId: line.merchandise.id,
      productTitle: line.merchandise.product?.title || '',
      variantTitle: line.merchandise.title || '',
      quantity: line.quantity,
      price: line.cost.total_amount.amount,
      currency: line.cost.total_amount.currency,
    }))

    return {
      cartId: cart.id,
      checkoutUrl: cart.checkout_url,
      lines,
      totalAmount: cart.cost.total_amount.amount,
      currency: cart.cost.total_amount.currency,
      totalQuantity: cart.total_quantity,
    }
  }
}
