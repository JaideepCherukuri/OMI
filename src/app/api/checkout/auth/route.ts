/**
 * Checkout Auth API — JWT for Shopify Checkout Kit
 *
 * POST: Generates a bearer token using Shopify's client_credentials flow.
 * Token logic lives in @/lib/checkout-auth (shared with express route).
 */

import { NextResponse } from 'next/server'
import { getCheckoutToken, getTokenExpiresIn } from '@/lib/checkout-auth'

export async function POST() {
  try {
    const clientId = process.env.SHOPIFY_CATALOG_CLIENT_ID
    const clientSecret = process.env.SHOPIFY_CATALOG_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET' },
        { status: 500 },
      )
    }

    const token = await getCheckoutToken()
    const expiresIn = getTokenExpiresIn()

    return NextResponse.json({ token, expiresIn })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auth failed'
    console.error('Checkout auth error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
