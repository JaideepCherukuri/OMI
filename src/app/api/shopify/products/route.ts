import { NextRequest, NextResponse } from 'next/server'
import { ShopifyClient } from '@/lib/shopify-client'
import type { StoreCredentials } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { storeCredentials, action, ...params } = body as {
      storeCredentials: StoreCredentials
      action: string
      [key: string]: unknown
    }

    if (!storeCredentials?.storeUrl || !storeCredentials?.accessToken) {
      return NextResponse.json(
        { error: 'Store credentials required' },
        { status: 400 },
      )
    }

    const client = new ShopifyClient(storeCredentials)

    switch (action) {
      case 'list': {
        const products = await client.fetchProductDetails(
          (params.includeMetafields as boolean) ?? false,
        )
        return NextResponse.json({ products })
      }

      case 'get': {
        const product = await client.getProduct(params.productId as number)
        return NextResponse.json({ product })
      }

      case 'create': {
        const created = await client.createProduct(
          params.productData as Record<string, unknown>,
        )
        return NextResponse.json({ product: created })
      }

      case 'update': {
        const updated = await client.updateProduct(
          params.productId as number,
          params.updates as Record<string, unknown>,
        )
        return NextResponse.json({ product: updated })
      }

      case 'delete': {
        await client.deleteProduct(params.productId as number)
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        )
    }
  } catch (err) {
    console.error('Products API error:', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
