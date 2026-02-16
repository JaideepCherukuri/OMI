/**
 * Server-side API route for Shopify Catalog MCP (global search).
 * Keeps client_secret server-side while exposing search to the frontend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { CatalogMCPClient } from '@/lib/catalog-mcp'

// Singleton client (reused across requests — token auto-refreshes)
let catalogClient: CatalogMCPClient | null = null

function getClient(): CatalogMCPClient | null {
  if (catalogClient) return catalogClient

  const clientId = process.env.SHOPIFY_CATALOG_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CATALOG_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('Catalog MCP: Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET')
    return null
  }

  catalogClient = new CatalogMCPClient(clientId, clientSecret)
  return catalogClient
}

export async function POST(req: NextRequest) {
  try {
    const client = getClient()
    if (!client) {
      return NextResponse.json(
        { error: 'Catalog MCP not configured', offers: [] },
        { status: 200 } // Return 200 with empty results (graceful fallback)
      )
    }

    const body = await req.json()
    const { query, context, limit, maxPrice, minPrice, shipsTo } = body

    if (!query) {
      return NextResponse.json({ error: 'Missing query', offers: [] }, { status: 400 })
    }

    const offers = await client.searchProducts(query, context || query, {
      limit: limit || 6,
      maxPrice,
      minPrice,
      shipsTo,
      availableForSale: true,
    })

    return NextResponse.json({ offers })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Catalog search failed'
    console.error('Catalog API error:', message)
    return NextResponse.json({ error: message, offers: [] }, { status: 200 })
  }
}
