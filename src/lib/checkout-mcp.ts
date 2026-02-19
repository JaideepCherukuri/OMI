/**
 * Shopify Checkout MCP Client — JSON-RPC 2.0
 *
 * Connects to a shop's Unified Checkout Protocol (UCP) endpoint to
 * create, read, update, and cancel checkout sessions.
 *
 * Endpoint: https://{shopDomain}/api/ucp/mcp
 * Auth:     Bearer token from Shopify Catalog auth
 *
 * Follows the same JSON-RPC 2.0 pattern as mcp-client.ts and catalog-mcp.ts.
 */

// === Types ===

export type CheckoutStatus =
  | 'incomplete'
  | 'requires_escalation'
  | 'ready_for_complete'
  | 'complete_in_progress'
  | 'completed'
  | 'canceled'

export interface CheckoutBuyer {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
}

export interface CheckoutAddress {
  firstName?: string
  lastName?: string
  address1?: string
  address2?: string
  city?: string
  province?: string
  country?: string
  zip?: string
  phone?: string
}

export interface CheckoutLineItem {
  variantId: string
  quantity: number
  title?: string
  price?: { amount: string; currencyCode: string }
}

export interface CheckoutTotals {
  subtotal?: { amount: string; currencyCode: string }
  total?: { amount: string; currencyCode: string }
  tax?: { amount: string; currencyCode: string }
  shipping?: { amount: string; currencyCode: string }
}

export interface CheckoutFulfillment {
  shippingAddress?: CheckoutAddress
  billingAddress?: CheckoutAddress
}

export interface CheckoutMessage {
  type: 'info' | 'warning' | 'error'
  message: string
}

export interface CheckoutSession {
  id: string
  status: CheckoutStatus
  currency?: string
  buyer?: CheckoutBuyer
  lineItems?: CheckoutLineItem[]
  totals?: CheckoutTotals
  fulfillment?: CheckoutFulfillment
  continueUrl?: string
  messages?: CheckoutMessage[]
  expiresAt?: string
}

export interface CreateCheckoutArgs {
  variantId: string
  quantity?: number
  buyer?: CheckoutBuyer
  shippingAddress?: CheckoutAddress
  billingAddress?: CheckoutAddress
}

export interface UpdateCheckoutArgs {
  buyer?: CheckoutBuyer
  shippingAddress?: CheckoutAddress
  billingAddress?: CheckoutAddress
  lineItems?: Array<{ variantId: string; quantity: number }>
}

// MCP JSON-RPC result shape
interface MCPToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

// === Client ===

export class CheckoutMCPClient {
  private mcpUrl: string
  private bearerToken: string
  private requestId = 0
  private initialized = false

  constructor(shopDomain: string, bearerToken: string) {
    // Normalize domain — strip protocol, trailing slash
    let domain = shopDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    this.mcpUrl = `https://${domain}/api/ucp/mcp`
    this.bearerToken = bearerToken
  }

  /**
   * Low-level JSON-RPC 2.0 call.
   */
  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    this.requestId++

    const resp = await fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.bearerToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.requestId,
        method,
        params: params || {},
      }),
    })

    if (!resp.ok) {
      throw new Error(`Checkout MCP request failed: ${resp.status} ${resp.statusText}`)
    }

    const data = await resp.json()
    if (data.error) {
      throw new Error(
        `Checkout MCP error: ${data.error.message || JSON.stringify(data.error)}`,
      )
    }
    return data.result
  }

  /**
   * Initialize the MCP session (handshake).
   */
  async initialize(): Promise<boolean> {
    try {
      await this.rpc('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'omi-express-checkout', version: '1.0.0' },
      })
      this.initialized = true
      return true
    } catch {
      return false
    }
  }

  /**
   * Call an MCP tool and return the raw result.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.initialized) await this.initialize()
    const result = await this.rpc('tools/call', { name, arguments: args })
    return result as MCPToolResult
  }

  /**
   * Parse the checkout session from an MCP tool result.
   */
  private parseCheckout(result: MCPToolResult): CheckoutSession {
    const text = result.content?.find(c => c.type === 'text')?.text
    if (!text) {
      throw new Error('Checkout MCP: empty response')
    }

    if (result.isError) {
      throw new Error(`Checkout MCP tool error: ${text}`)
    }

    return JSON.parse(text) as CheckoutSession
  }

  /**
   * Create a new checkout session with a single variant.
   * Optionally pre-fill buyer info and shipping address.
   */
  async createCheckout(args: CreateCheckoutArgs): Promise<CheckoutSession> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolArgs: Record<string, any> = {
      variant_id: args.variantId,
      quantity: args.quantity || 1,
    }

    if (args.buyer) {
      toolArgs.buyer = {
        ...(args.buyer.email && { email: args.buyer.email }),
        ...(args.buyer.phone && { phone: args.buyer.phone }),
        ...(args.buyer.firstName && { first_name: args.buyer.firstName }),
        ...(args.buyer.lastName && { last_name: args.buyer.lastName }),
      }
    }

    if (args.shippingAddress) {
      toolArgs.shipping_address = this.serializeAddress(args.shippingAddress)
    }

    if (args.billingAddress) {
      toolArgs.billing_address = this.serializeAddress(args.billingAddress)
    }

    const result = await this.callTool('create_checkout', toolArgs)
    return this.parseCheckout(result)
  }

  /**
   * Get an existing checkout session by ID.
   */
  async getCheckout(checkoutId: string): Promise<CheckoutSession> {
    const result = await this.callTool('get_checkout', {
      checkout_id: checkoutId,
    })
    return this.parseCheckout(result)
  }

  /**
   * Update an existing checkout session.
   */
  async updateCheckout(
    checkoutId: string,
    args: UpdateCheckoutArgs,
  ): Promise<CheckoutSession> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolArgs: Record<string, any> = {
      checkout_id: checkoutId,
    }

    if (args.buyer) {
      toolArgs.buyer = {
        ...(args.buyer.email && { email: args.buyer.email }),
        ...(args.buyer.phone && { phone: args.buyer.phone }),
        ...(args.buyer.firstName && { first_name: args.buyer.firstName }),
        ...(args.buyer.lastName && { last_name: args.buyer.lastName }),
      }
    }

    if (args.shippingAddress) {
      toolArgs.shipping_address = this.serializeAddress(args.shippingAddress)
    }

    if (args.billingAddress) {
      toolArgs.billing_address = this.serializeAddress(args.billingAddress)
    }

    if (args.lineItems) {
      toolArgs.line_items = args.lineItems.map(li => ({
        variant_id: li.variantId,
        quantity: li.quantity,
      }))
    }

    const result = await this.callTool('update_checkout', toolArgs)
    return this.parseCheckout(result)
  }

  /**
   * Cancel a checkout session.
   *
   * @param checkoutId    - The checkout session ID
   * @param idempotencyKey - Unique key to prevent duplicate cancellations
   */
  async cancelCheckout(
    checkoutId: string,
    idempotencyKey: string,
  ): Promise<CheckoutSession> {
    const result = await this.callTool('cancel_checkout', {
      checkout_id: checkoutId,
      idempotency_key: idempotencyKey,
    })
    return this.parseCheckout(result)
  }

  /**
   * Serialize a CheckoutAddress to snake_case for the MCP API.
   */
  private serializeAddress(addr: CheckoutAddress): Record<string, string> {
    const out: Record<string, string> = {}
    if (addr.firstName) out.first_name = addr.firstName
    if (addr.lastName) out.last_name = addr.lastName
    if (addr.address1) out.address1 = addr.address1
    if (addr.address2) out.address2 = addr.address2
    if (addr.city) out.city = addr.city
    if (addr.province) out.province = addr.province
    if (addr.country) out.country = addr.country
    if (addr.zip) out.zip = addr.zip
    if (addr.phone) out.phone = addr.phone
    return out
  }
}
