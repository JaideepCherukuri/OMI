/**
 * Shopify Catalog MCP Client — Global Product Search across ALL Shopify merchants.
 *
 * Auth: JWT bearer token from https://api.shopify.com/auth/access_token
 * MCP:  https://catalog.shopify.com/api/mcp (JSON-RPC 2.0)
 *
 * Tools:
 *   search_products → global search (requires query + context)
 *   get_product_details → product by UPID
 *   create_cart, update_cart, get_cart → universal cart
 */

// === Types ===

export interface CatalogOffer {
  id: string           // UPID: "gid://shopify/p/..."
  title: string
  description: string
  images: CatalogImage[]
  options: CatalogOption[]
  priceRange: { min: { amount: string; currencyCode: string }; max: { amount: string; currencyCode: string } }
  products: CatalogProduct[]
  availableForSale: boolean
}

export interface CatalogImage {
  url: string
  altText: string
  product?: {
    id: string
    title: string
    onlineStoreUrl: string
    shop: { name: string; onlineStoreUrl: string }
  }
}

export interface CatalogOption {
  name: string
  values: { value: string; availableForSale: boolean; exists: boolean }[]
}

export interface CatalogProduct {
  id: string
  title: string
  checkoutUrl: string
  description: string
  featuredImage?: { url: string; altText: string }
  onlineStoreUrl: string
  price: { amount: string; currencyCode: string }
  rating: number | null
  availableForSale: boolean
  shop: {
    name: string
    id: string
    onlineStoreUrl: string
    paymentSettings?: { supportedDigitalWallets: string[] }
  }
  selectedProductVariant?: {
    id: string
    availableForSale: boolean
    price: { amount: string; currencyCode: string }
    image?: { url: string; altText: string }
  }
}

interface MCPToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

// === Client ===

export class CatalogMCPClient {
  private static TOKEN_URL = 'https://api.shopify.com/auth/access_token'
  private static CATALOG_URL = 'https://catalog.shopify.com/api/mcp'

  private clientId: string
  private clientSecret: string
  private token: string | null = null
  private tokenExpiry = 0
  private requestId = 0
  private initialized = false

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  private async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry - 60000) return

    const resp = await fetch(CatalogMCPClient.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    if (!resp.ok) throw new Error(`Catalog token error: ${resp.status}`)
    const data = await resp.json()
    this.token = data.access_token
    this.tokenExpiry = Date.now() + 3500000 // ~58 minutes
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.ensureToken()
    this.requestId++

    const resp = await fetch(CatalogMCPClient.CATALOG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method,
        params: params || {},
      }),
    })

    if (!resp.ok) throw new Error(`Catalog MCP error: ${resp.status}`)
    const data = await resp.json()
    if (data.error) throw new Error(`Catalog MCP: ${data.error.message || JSON.stringify(data.error)}`)
    return data.result
  }

  async initialize(): Promise<boolean> {
    try {
      await this.rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'giftai-voice', version: '2.0.0' },
      })
      this.initialized = true
      return true
    } catch {
      return false
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.initialized) await this.initialize()
    const result = await this.rpc('tools/call', { name, arguments: args })
    return result as MCPToolResult
  }

  /**
   * Search across ALL Shopify merchants.
   * Returns CatalogOffers with checkout URLs and shop info.
   */
  async searchProducts(
    query: string,
    context: string,
    options?: {
      limit?: number
      maxPrice?: number
      minPrice?: number
      shipsTo?: string
      availableForSale?: boolean
    }
  ): Promise<CatalogOffer[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const args: Record<string, any> = {
        query,
        context,
        limit: options?.limit || 6,
        available_for_sale: options?.availableForSale ?? true,
      }
      if (options?.maxPrice) args.max_price = options.maxPrice
      if (options?.minPrice) args.min_price = options.minPrice
      if (options?.shipsTo) args.ships_to = options.shipsTo

      const result = await this.callTool('search_products', args)
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      const parsed = JSON.parse(text)

      // Response shape: { offers: [...], instructions: "..." }
      if (parsed.offers && Array.isArray(parsed.offers)) {
        return parsed.offers
      }
      if (Array.isArray(parsed)) return parsed
      return []
    } catch (e) {
      console.error('Catalog MCP searchProducts failed:', e)
      return []
    }
  }

  /**
   * Get product details by Universal Product ID (UPID).
   */
  async getProductDetails(upid: string, context?: string): Promise<CatalogOffer | null> {
    try {
      const result = await this.callTool('get_product_details', {
        upid,
        context: context || '',
      })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  /**
   * Create a universal cart (cross-merchant).
   */
  async createCart(
    items: Array<{ productVariantId: string; quantity: number; shopId?: string }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      const result = await this.callTool('create_cart', {
        items: items.map(i => ({
          merchandise_id: i.productVariantId,
          quantity: i.quantity,
          ...(i.shopId ? { shop_id: i.shopId } : {}),
        })),
      })
      const text = result.content?.find(c => c.type === 'text')?.text || '{}'
      return JSON.parse(text)
    } catch (e) {
      console.error('Catalog MCP createCart failed:', e)
      return null
    }
  }
}
