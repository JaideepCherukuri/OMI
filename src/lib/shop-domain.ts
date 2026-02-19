/**
 * Shop Domain Extractor
 *
 * Parses the Shopify shop domain from product data returned by the
 * Catalog MCP or storefront APIs. Returns just the hostname
 * (e.g. "greenteashop.myshopify.com").
 */

import type { ProductDetail } from '@/types'

/**
 * Extract the Shopify shop domain from a product.
 *
 * Checks, in order:
 *   1. product.directCheckoutUrl  (e.g. "https://shop.myshopify.com/cart/...")
 *   2. product.shopUrl            (e.g. "https://shop.myshopify.com")
 *
 * @returns The bare hostname, or null if no valid domain found.
 */
export function extractShopDomain(product: ProductDetail): string | null {
  // Try directCheckoutUrl first — most reliable for checkout
  if (product.directCheckoutUrl) {
    const domain = parseDomain(product.directCheckoutUrl)
    if (domain) return domain
  }

  // Fallback to shopUrl
  if (product.shopUrl) {
    const domain = parseDomain(product.shopUrl)
    if (domain) return domain
  }

  return null
}

/**
 * Parse a hostname from a URL string.
 * Handles URLs with or without protocol prefix.
 *
 * @returns Hostname string or null if invalid.
 */
function parseDomain(input: string): string | null {
  try {
    // Ensure it has a protocol so URL() can parse it
    const url = input.startsWith('http')
      ? new URL(input)
      : new URL(`https://${input}`)

    const host = url.hostname.toLowerCase()

    // Basic validation: must have at least one dot
    if (!host.includes('.')) return null

    return host
  } catch {
    return null
  }
}
