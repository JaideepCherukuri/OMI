import { NextRequest, NextResponse } from 'next/server'
import { ShopifyClient } from '@/lib/shopify-client'
import type { StoreCredentials } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { storeCredentials, items } = body as {
      storeCredentials: StoreCredentials
      items: Array<{ variantId: number; quantity: number }>
    }

    if (!storeCredentials?.storeUrl || !storeCredentials?.accessToken) {
      return NextResponse.json(
        { error: 'Store credentials required' },
        { status: 400 },
      )
    }

    if (!items?.length) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 },
      )
    }

    const client = new ShopifyClient(storeCredentials)
    const checkout = await client.createCheckout(
      items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    )

    return NextResponse.json({
      checkoutUrl: checkout.web_url,
      totalPrice: checkout.total_price,
      currency: checkout.currency,
      lineItems: checkout.line_items,
    })
  } catch (err) {
    console.error('Checkout API error:', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
