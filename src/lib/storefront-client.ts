/**
 * Shopify Storefront API Client — GraphQL
 * Handles cart creation, line management, and checkout URL generation.
 */

import type { StoreCredentials, CartState, CartLineItem } from '@/types'

export class StorefrontClient {
  private endpoint: string
  private headers: Record<string, string>

  constructor(credentials: StoreCredentials) {
    let url = credentials.storeUrl.trim().replace(/\/+$/, '')
    if (!url.startsWith('http')) url = `https://${url}`
    this.endpoint = `${url}/api/2024-01/graphql.json`
    this.headers = {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
    }
  }

  private async graphql(query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { query }
    if (variables) body.variables = variables
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Storefront API error: ${res.status}`)
    return res.json() as Promise<Record<string, unknown>>
  }

  async cartCreate(variantGid: string, quantity = 1): Promise<CartState | null> {
    const query = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 20) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price { amount currencyCode }
                      product { title }
                    }
                  }
                }
              }
            }
            cost { totalAmount { amount currencyCode } }
          }
          userErrors { field message }
        }
      }
    `
    const variables = {
      input: { lines: [{ merchandiseId: variantGid, quantity }] },
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.graphql(query, variables) as any
      const cart = data?.data?.cartCreate?.cart
      if (!cart) return null
      return this.parseCart(cart)
    } catch (e) {
      console.error('cartCreate failed:', e)
      return null
    }
  }

  async cartLinesAdd(cartId: string, variantGid: string, quantity = 1): Promise<CartState | null> {
    const query = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            lines(first: 20) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price { amount currencyCode }
                      product { title }
                    }
                  }
                }
              }
            }
            cost { totalAmount { amount currencyCode } }
          }
          userErrors { field message }
        }
      }
    `
    const variables = {
      cartId,
      lines: [{ merchandiseId: variantGid, quantity }],
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.graphql(query, variables) as any
      const cart = data?.data?.cartLinesAdd?.cart
      if (!cart) {
        // Cart might be expired, create a new one
        return this.cartCreate(variantGid, quantity)
      }
      return this.parseCart(cart)
    } catch {
      return this.cartCreate(variantGid, quantity)
    }
  }

  async getCart(cartId: string): Promise<CartState | null> {
    const query = `
      query cart($cartId: ID!) {
        cart(id: $cartId) {
          id
          checkoutUrl
          lines(first: 20) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price { amount currencyCode }
                    product { title }
                  }
                }
              }
            }
          }
          cost { totalAmount { amount currencyCode } }
        }
      }
    `
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.graphql(query, { cartId }) as any
      const cart = data?.data?.cart
      if (!cart) return null
      return this.parseCart(cart)
    } catch {
      return null
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCart(cart: any): CartState {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines: CartLineItem[] = (cart.lines?.edges || []).map((edge: any) => {
      const node = edge.node
      const merch = node.merchandise || {}
      return {
        lineId: node.id,
        variantId: merch.id || '',
        productTitle: merch.product?.title || '',
        variantTitle: merch.title || '',
        quantity: node.quantity || 1,
        price: merch.price?.amount || '0',
        currency: merch.price?.currencyCode || 'INR',
      }
    })

    const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0)

    return {
      cartId: cart.id || '',
      checkoutUrl: cart.checkoutUrl || '',
      lines,
      totalAmount: cart.cost?.totalAmount?.amount || '0',
      currency: cart.cost?.totalAmount?.currencyCode || 'INR',
      totalQuantity: totalQty,
    }
  }
}
