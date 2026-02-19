/**
 * Shopify Checkout Auth — shared token management.
 *
 * Used by:
 *   - /api/checkout/auth route (public endpoint for frontend)
 *   - /api/checkout/express route (internal pre-fill orchestrator)
 *
 * Caches the bearer token in-memory with a 5-minute safety margin.
 */

// ── Module-level token cache ──

let cachedToken: string | null = null
let cachedExpiresAt = 0 // Unix timestamp (ms)

const TOKEN_URL = 'https://api.shopify.com/auth/access_token'
const CACHE_MARGIN_MS = 5 * 60 * 1000 // refresh 5 min before expiry

/**
 * Get a valid Shopify bearer token.
 * Uses SHOPIFY_CATALOG_CLIENT_ID and SHOPIFY_CATALOG_CLIENT_SECRET.
 * Token is cached for ~55 minutes (60 min TTL minus 5 min margin).
 */
export async function getCheckoutToken(): Promise<string> {
  const clientId = process.env.SHOPIFY_CATALOG_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CATALOG_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing SHOPIFY_CATALOG_CLIENT_ID or SHOPIFY_CATALOG_CLIENT_SECRET')
  }

  if (cachedToken && Date.now() < cachedExpiresAt - CACHE_MARGIN_MS) {
    return cachedToken
  }

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })

  if (!resp.ok) {
    throw new Error(`Checkout token request failed: ${resp.status}`)
  }

  const data = await resp.json()
  cachedToken = data.access_token
  cachedExpiresAt = Date.now() + (data.expires_in || 3600) * 1000

  return cachedToken!
}

/**
 * Get remaining seconds until token expires. For API response.
 */
export function getTokenExpiresIn(): number {
  if (!cachedExpiresAt) return 0
  return Math.max(0, Math.floor((cachedExpiresAt - Date.now()) / 1000))
}

/** Reset the token cache (for testing). */
export function resetTokenCache(): void {
  cachedToken = null
  cachedExpiresAt = 0
}
