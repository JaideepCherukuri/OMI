/**
 * Express Checkout Orchestrator
 *
 * POST: Creates a pre-filled or direct checkout session.
 *
 * Flow:
 *   1. Read buyer vault (encrypted cookie)
 *   2. Get Shopify bearer token (cached JWT)
 *   3. If vault has data AND !skipPrefill → create a pre-filled checkout via MCP
 *   4. Otherwise → return a direct cart permalink
 *
 * Falls back to 'direct' mode gracefully if the Checkout MCP fails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/vault-crypto'
import { CheckoutMCPClient } from '@/lib/checkout-mcp'
import { getCheckoutToken } from '@/lib/checkout-auth'
import type { BuyerProfile } from '@/app/api/vault/route'
import type { CheckoutAddress } from '@/lib/checkout-mcp'

// ── Constants ──

const VAULT_COOKIE = 'omi_vault'

// ── Types ──

/** The ProductDetail shape sent by VoiceProvider */
interface ProductPayload {
  productId?: number
  title?: string
  shopName?: string
  shopUrl?: string
  directCheckoutUrl?: string
  variants?: Array<{
    variantId?: number
    gid?: string
  }>
  [key: string]: unknown
}

interface VariantPayload {
  variantId?: number
  gid?: string
}

/**
 * Accepts BOTH the flat format (shopDomain + variantGid) AND
 * the ProductDetail format (product + variant) from VoiceProvider.
 */
interface ExpressCheckoutRequest {
  // Flat format
  shopDomain?: string
  variantGid?: string
  quantity?: number
  skipPrefill?: boolean
  // ProductDetail format (from VoiceProvider)
  product?: ProductPayload
  variant?: VariantPayload | null
  vaultProfile?: unknown
}

interface ExpressCheckoutResponse {
  mode: 'prefilled' | 'direct'
  checkoutId?: string
  continueUrl?: string
  checkoutUrl?: string
  status?: string
  totals?: unknown
  jwt: string
}

// ── Helpers ──

/**
 * Read the buyer profile from the vault cookie (if present).
 */
function readVault(req: NextRequest): BuyerProfile | null {
  try {
    const cookie = req.cookies.get(VAULT_COOKIE)
    if (!cookie?.value) return null

    const json = decrypt(cookie.value)
    return JSON.parse(json) as BuyerProfile
  } catch {
    return null
  }
}

/**
 * Build a Shopify cart permalink URL for direct checkout.
 * Format: https://{shop}/cart/{numericVariantId}:{quantity}
 *
 * variantGid can be:
 *   - "gid://shopify/ProductVariant/12345"
 *   - "12345"
 */
function buildCartPermalink(
  shopDomain: string,
  variantGid: string,
  quantity: number,
): string {
  // Extract numeric ID from GID
  const numericId = variantGid.includes('/')
    ? variantGid.split('/').pop()
    : variantGid

  return `https://${shopDomain}/cart/${numericId}:${quantity}`
}

/**
 * Map a vault address to the checkout MCP address format.
 */
function mapVaultAddress(
  addr: BuyerProfile['addresses'][0],
): CheckoutAddress {
  return {
    firstName: addr.firstName,
    lastName: addr.lastName,
    address1: addr.streetAddress,
    city: addr.addressLocality,
    province: addr.addressRegion,
    zip: addr.postalCode,
    country: addr.addressCountry,
  }
}

// ── POST ──

export async function POST(req: NextRequest) {
  try {
    const body: ExpressCheckoutRequest = await req.json()

    // ── Extract shopDomain + variantGid from either request format ──
    let shopDomain = body.shopDomain
    let variantGid = body.variantGid
    let directCheckoutUrl: string | undefined
    const quantity = body.quantity ?? 1
    const skipPrefill = body.skipPrefill ?? false

    // VoiceProvider sends { product, variant } — extract fields from it
    if (!shopDomain && body.product) {
      const p = body.product

      // Extract shop domain from shopUrl or shopName
      if (p.shopUrl) {
        try {
          const url = new URL(p.shopUrl.startsWith('http') ? p.shopUrl : `https://${p.shopUrl}`)
          shopDomain = url.hostname
        } catch {
          shopDomain = p.shopUrl
        }
      }

      // directCheckoutUrl is the cart permalink from the Catalog
      directCheckoutUrl = p.directCheckoutUrl || undefined

      // Extract variant GID
      const v = body.variant || (p.variants && p.variants[0])
      if (v?.gid) {
        variantGid = v.gid
      } else if (v?.variantId) {
        variantGid = `gid://shopify/ProductVariant/${v.variantId}`
      }
    }

    // If we have a directCheckoutUrl from catalog but no domain/variant, use it directly
    if (!shopDomain && directCheckoutUrl) {
      try {
        const url = new URL(directCheckoutUrl)
        shopDomain = url.hostname
      } catch { /* ignore */ }
    }

    // We need at least a checkoutUrl or shopDomain to proceed
    if (!shopDomain && !directCheckoutUrl) {
      return NextResponse.json(
        { error: 'Missing shop domain. Provide shopDomain or product.shopUrl' },
        { status: 400 },
      )
    }

    // Step 1: Read vault
    const vault = readVault(req)

    // Step 2: Get JWT
    let jwt: string
    try {
      jwt = await getCheckoutToken()
    } catch (err) {
      console.error('Express checkout: token error', err)
      return NextResponse.json(
        { error: 'Failed to obtain checkout token' },
        { status: 502 },
      )
    }

    // Step 3: Pre-filled checkout (vault present, not skipped)
    if (vault && !skipPrefill) {
      try {
        const client = new CheckoutMCPClient(shopDomain, jwt)

        const shippingAddr = vault.addresses.length > 0
          ? mapVaultAddress(vault.addresses[0])
          : undefined

        const checkout = await client.createCheckout({
          variantId: variantGid,
          quantity,
          buyer: {
            email: vault.email,
            phone: vault.phone,
            firstName: vault.firstName,
            lastName: vault.lastName,
          },
          shippingAddress: shippingAddr,
        })

        const response: ExpressCheckoutResponse = {
          mode: 'prefilled',
          checkoutId: checkout.id,
          continueUrl: checkout.continueUrl,
          status: checkout.status,
          totals: checkout.totals,
          jwt,
        }

        return NextResponse.json(response)
      } catch (err) {
        // MCP failed — fall through to direct mode
        console.warn(
          'Express checkout: MCP prefill failed, falling back to direct',
          err instanceof Error ? err.message : err,
        )
      }
    }

    // Step 4: Direct mode (no vault, skipPrefill, or MCP failure)
    // Prefer the catalog's directCheckoutUrl (includes _gsid tracking), fallback to building one
    const checkoutUrl = directCheckoutUrl
      || (shopDomain && variantGid ? buildCartPermalink(shopDomain, variantGid, quantity) : null)

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Could not construct checkout URL' },
        { status: 400 },
      )
    }

    const response: ExpressCheckoutResponse = {
      mode: 'direct',
      checkoutUrl,
      jwt,
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Express checkout failed'
    console.error('Express checkout error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
