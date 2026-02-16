/**
 * Shopify Admin REST API client.
 * TypeScript port of the Python SDK at github.com/JaideepCherukuri/shopify-gift-store-agent
 *
 * Handles all authenticated HTTP communication with a Shopify store,
 * including automatic rate-limit retry and pagination.
 */

import type {
  ShopifyProduct,
  ShopifyShop,
  ShopifyLocation,
  ShopifyVariant,
  ProductDetail,
  VariantDetail,
  StoreCredentials,
} from '@/types'

// Local checkout interface (legacy Admin API checkout)
interface ShopifyCheckout {
  token: string
  web_url: string
  line_items: Array<{
    variant_id: number
    quantity: number
    title: string
    price: string
  }>
  total_price: string
  currency: string
}

// === Standalone helper: convert raw Shopify product to ProductDetail ===

export function shopifyProductToDetail(product: ShopifyProduct): ProductDetail {
  const variants: VariantDetail[] = product.variants.map(v => ({
    variantId: v.id,
    gid: `gid://shopify/ProductVariant/${v.id}`,
    name: v.option1 || v.title || 'Default',
    sku: v.sku || '',
    price: parseFloat(v.price),
    compareAtPrice: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
    inventoryQuantity: v.inventory_quantity || 0,
    deliveryTime: null,
    availableRegions: null,
  }))

  const images = (product.images || []).map(img => img.src)
  const prices = variants.map(v => v.price).filter(p => p > 0)
  const minP = prices.length > 0 ? Math.min(...prices) : 0
  const maxP = prices.length > 0 ? Math.max(...prices) : 0
  const priceRange = prices.length === 0
    ? 'Price not available'
    : minP === maxP ? `$${minP.toFixed(2)}` : `$${minP.toFixed(2)}–$${maxP.toFixed(2)}`

  const totalStock = variants.reduce((sum, v) => sum + v.inventoryQuantity, 0)
  const hasDiscount = variants.some(v => v.compareAtPrice !== null && v.compareAtPrice > v.price)
  const tags = product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return {
    productId: product.id,
    title: product.title,
    descriptionHtml: product.body_html || '',
    vendor: product.vendor || '',
    productType: product.product_type || '',
    tags,
    status: product.status || 'active',
    handle: product.handle || '',
    images,
    variants,
    priceRange,
    totalStock,
    hasDiscount,
  }
}

export class ShopifyAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(`Shopify API Error (${statusCode}): ${message}`)
    this.name = 'ShopifyAPIError'
  }
}

export class ShopifyClient {
  private baseUrl: string
  private headers: Record<string, string>
  private static readonly API_VERSION = '2024-01'
  private static readonly MAX_RETRIES = 3

  constructor(credentials: StoreCredentials) {
    let storeUrl = credentials.storeUrl.replace(/\/+$/, '')
    if (!storeUrl.startsWith('https://')) {
      storeUrl = `https://${storeUrl}`
    }
    this.baseUrl = `${storeUrl}/admin/api/${ShopifyClient.API_VERSION}`
    this.headers = {
      'X-Shopify-Access-Token': credentials.accessToken,
      'Content-Type': 'application/json',
    }
  }

  // === Core HTTP with retry ===

  private async request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= ShopifyClient.MAX_RETRIES; attempt++) {
      const resp = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      if (resp.status === 429 && attempt < ShopifyClient.MAX_RETRIES) {
        const retryAfter = parseFloat(
          resp.headers.get('Retry-After') || String(2 ** attempt),
        )
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        continue
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => 'Unknown error')
        throw new ShopifyAPIError(resp.status, text)
      }

      return resp
    }

    throw new ShopifyAPIError(429, 'Rate limit exceeded after retries')
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }
    const resp = await this.request('GET', url.toString())
    return resp.json()
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const resp = await this.request('POST', `${this.baseUrl}${path}`, body)
    return resp.json()
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const resp = await this.request('PUT', `${this.baseUrl}${path}`, body)
    return resp.json()
  }

  private async del(path: string): Promise<void> {
    await this.request('DELETE', `${this.baseUrl}${path}`)
  }

  // === Shop ===

  async getShop(): Promise<ShopifyShop> {
    const data = await this.get<{ shop: ShopifyShop }>('/shop.json')
    return data.shop
  }

  // === Products ===

  async getProducts(
    limit = 250,
    status?: string,
  ): Promise<ShopifyProduct[]> {
    const params: Record<string, string> = { limit: String(Math.min(limit, 250)) }
    if (status) params.status = status

    const allProducts: ShopifyProduct[] = []
    let url: string | null = `${this.baseUrl}/products.json?${new URLSearchParams(params)}`

    while (url) {
      const resp = await this.request('GET', url)
      const data = await resp.json()
      allProducts.push(...(data.products || []))

      // Handle Shopify link-header pagination
      const linkHeader = resp.headers.get('link') || ''
      url = null
      if (linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
        if (match) url = match[1]
      }
    }

    return allProducts
  }

  async getProduct(productId: number): Promise<ShopifyProduct> {
    const data = await this.get<{ product: ShopifyProduct }>(
      `/products/${productId}.json`,
    )
    return data.product
  }

  async createProduct(
    productData: Record<string, unknown>,
  ): Promise<ShopifyProduct> {
    const data = await this.post<{ product: ShopifyProduct }>(
      '/products.json',
      { product: productData },
    )
    return data.product
  }

  async updateProduct(
    productId: number,
    updates: Record<string, unknown>,
  ): Promise<ShopifyProduct> {
    const data = await this.put<{ product: ShopifyProduct }>(
      `/products/${productId}.json`,
      { product: { ...updates, id: productId } },
    )
    return data.product
  }

  async deleteProduct(productId: number): Promise<void> {
    await this.del(`/products/${productId}.json`)
  }

  async getProductCount(): Promise<number> {
    const data = await this.get<{ count: number }>('/products/count.json')
    return data.count
  }

  // === Variants ===

  async getVariant(variantId: number): Promise<ShopifyVariant> {
    const data = await this.get<{ variant: ShopifyVariant }>(
      `/variants/${variantId}.json`,
    )
    return data.variant
  }

  async updateVariant(
    variantId: number,
    updates: Record<string, unknown>,
  ): Promise<ShopifyVariant> {
    const data = await this.put<{ variant: ShopifyVariant }>(
      `/variants/${variantId}.json`,
      { variant: { ...updates, id: variantId } },
    )
    return data.variant
  }

  // === Inventory ===

  async getLocations(): Promise<ShopifyLocation[]> {
    const data = await this.get<{ locations: ShopifyLocation[] }>(
      '/locations.json',
    )
    return data.locations
  }

  async getPrimaryLocationId(): Promise<number> {
    const locations = await this.getLocations()
    return locations[0].id
  }

  async setInventoryLevel(
    inventoryItemId: number,
    locationId: number,
    available: number,
  ): Promise<unknown> {
    return this.post('/inventory_levels/set.json', {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available,
    })
  }

  // === Metafields ===

  async getVariantMetafields(
    variantId: number,
  ): Promise<Array<{ id: number; namespace: string; key: string; value: string }>> {
    const data = await this.get<{ metafields: Array<{ id: number; namespace: string; key: string; value: string }> }>(
      `/variants/${variantId}/metafields.json`,
    )
    return data.metafields
  }

  async setVariantMetafield(
    variantId: number,
    namespace: string,
    key: string,
    value: string,
    valueType = 'single_line_text_field',
  ): Promise<unknown> {
    const existing = await this.getVariantMetafields(variantId)
    const match = existing.find(
      (mf) => mf.namespace === namespace && mf.key === key,
    )

    if (match) {
      return this.put(`/variants/${variantId}/metafields/${match.id}.json`, {
        metafield: { id: match.id, value },
      })
    }

    return this.post(`/variants/${variantId}/metafields.json`, {
      metafield: { namespace, key, value, type: valueType },
    })
  }

  // === Checkout ===

  async createCheckout(
    lineItems: Array<{ variant_id: number; quantity: number }>,
  ): Promise<ShopifyCheckout> {
    const data = await this.post<{ checkout: ShopifyCheckout }>(
      '/checkouts.json',
      { checkout: { line_items: lineItems } },
    )
    return data.checkout
  }

  // === High-level helpers ===

  /**
   * Get all products as ProductDetail[] using the fast shopifyProductToDetail helper.
   * No metafield fetching — suitable for search/browse operations.
   */
  async getProductsFormatted(): Promise<ProductDetail[]> {
    const rawProducts = await this.getProducts()
    return rawProducts.map(shopifyProductToDetail)
  }

  async fetchProductDetails(includeMetafields = false): Promise<ProductDetail[]> {
    const rawProducts = await this.getProducts()
    const products: ProductDetail[] = []

    for (const p of rawProducts) {
      const images = (p.images || []).map((img) => img.src)
      const variants: VariantDetail[] = []

      for (const v of p.variants || []) {
        const detail: VariantDetail = {
          variantId: v.id,
          name: v.option1 || v.title || 'Default',
          sku: v.sku || '',
          price: parseFloat(v.price),
          compareAtPrice: v.compare_at_price
            ? parseFloat(v.compare_at_price)
            : null,
          inventoryQuantity: v.inventory_quantity || 0,
          deliveryTime: null,
          availableRegions: null,
        }

        if (includeMetafields) {
          try {
            const mfs = await this.getVariantMetafields(v.id)
            for (const mf of mfs) {
              if (mf.key === 'delivery_time') detail.deliveryTime = mf.value
              if (mf.key === 'available_regions')
                detail.availableRegions = mf.value
            }
          } catch {
            // Metafields are optional
          }
        }

        variants.push(detail)
      }

      const prices = variants.map((v) => v.price)
      const lo = Math.min(...prices)
      const hi = Math.max(...prices)
      const priceRange =
        prices.length === 0
          ? 'N/A'
          : lo === hi
            ? `$${lo.toFixed(2)}`
            : `$${lo.toFixed(2)}–$${hi.toFixed(2)}`

      const tags = (p.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      products.push({
        productId: p.id,
        title: p.title,
        descriptionHtml: p.body_html || '',
        vendor: p.vendor || '',
        productType: p.product_type || '',
        tags,
        status: p.status || 'active',
        handle: p.handle || '',
        images,
        variants,
        priceRange,
        totalStock: variants.reduce((sum, v) => sum + v.inventoryQuantity, 0),
        hasDiscount: variants.some(
          (v) => v.compareAtPrice !== null && v.compareAtPrice > v.price,
        ),
      })
    }

    return products
  }

  async recommendProducts(opts: {
    occasion?: string
    region?: string
    budgetMax?: number
    topN?: number
  }): Promise<ProductDetail[]> {
    const { occasion, region, budgetMax, topN = 5 } = opts
    const products = await this.fetchProductDetails(true)

    type Scored = { score: number; product: ProductDetail }
    const candidates: Scored[] = []

    for (const p of products) {
      if (p.status !== 'active') continue
      if (p.totalStock <= 0) continue

      if (occasion) {
        const match = p.tags.some((t) =>
          t.toLowerCase().includes(occasion.toLowerCase()),
        )
        if (!match) continue
      }

      if (region) {
        const match = p.variants.some(
          (v) =>
            v.availableRegions &&
            v.availableRegions.toLowerCase().includes(region.toLowerCase()),
        )
        if (!match) continue
      }

      if (budgetMax !== undefined) {
        const cheapest = Math.min(...p.variants.map((v) => v.price))
        if (cheapest > budgetMax) continue
      }

      let score = 0
      if (p.hasDiscount) score += 20
      score += Math.min(p.totalStock / 10, 10)
      score += p.variants.length * 3
      score += p.images.length * 2
      if (occasion) {
        const exactMatch = p.tags.some(
          (t) => t.toLowerCase() === occasion.toLowerCase(),
        )
        score += exactMatch ? 15 : 5
      }

      candidates.push({ score, product: p })
    }

    candidates.sort((a, b) => b.score - a.score)
    return candidates.slice(0, topN).map((c) => c.product)
  }
}
