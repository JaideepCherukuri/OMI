/**
 * Shopify MCP Client — JSON-RPC 2.0
 * Connects to the store's /api/mcp endpoint for product search, cart, and policies.
 */

interface MCPToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

interface MCPProduct {
  id: string
  title: string
  description: string
  descriptionHtml?: string
  handle: string
  vendor?: string
  productType?: string
  tags?: string[]
  images: Array<{ url: string; altText?: string }>
  variants: Array<{
    id: string
    title: string
    price: { amount: string; currencyCode: string }
    compareAtPrice?: { amount: string; currencyCode: string } | null
    availableForSale: boolean
    quantityAvailable?: number
    sku?: string
  }>
  priceRange?: {
    minVariantPrice: { amount: string; currencyCode: string }
    maxVariantPrice: { amount: string; currencyCode: string }
  }
}

export class ShopifyMCPClient {
  private storeUrl: string
  private mcpUrl: string
  private sessionId: string
  private requestId: number = 0
  private tools: string[] = []

  constructor(storeUrl: string) {
    // Normalize store URL
    let url = storeUrl.trim().replace(/\/+$/, '')
    if (!url.startsWith('http')) url = `https://${url}`
    this.storeUrl = url
    this.mcpUrl = `${this.storeUrl}/api/mcp`
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
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

  async searchProducts(query: string): Promise<MCPProduct[]> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('search_shop_catalog', { query, limit: 10 })
      const text = result.content?.find(c => c.type === 'text')?.text || '[]'

      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) return parsed
        if (parsed.products) return parsed.products
        if (parsed.results) return parsed.results
        return []
      } catch {
        return []
      }
    } catch {
      return []
    }
  }

  async getProductDetails(productId: string): Promise<MCPProduct | null> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('get_product_details', { productId })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async addToCart(
    items: Array<{ variantId: string; quantity: number }>,
    cartId?: string
  ): Promise<{ cartId: string; checkoutUrl: string; lines: unknown[]; total: string } | null> {
    try {
      if (!this.tools.length) await this.initialize()
      const args: Record<string, unknown> = { items }
      if (cartId) args.cartId = cartId
      const result = await this.callTool('update_cart', args)
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async getCart(cartId: string): Promise<unknown> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('get_cart', { cartId })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  async getStorePolicies(query: string): Promise<string> {
    try {
      if (!this.tools.length) await this.initialize()
      const result = await this.callTool('search_shop_policies_and_faqs', { query })
      return result.content?.find(c => c.type === 'text')?.text || ''
    } catch {
      return ''
    }
  }
}
