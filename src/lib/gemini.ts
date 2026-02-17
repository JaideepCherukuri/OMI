/**
 * Gemini chat orchestration with Shopify tool execution.
 * Handles: MCP search + Admin API fallback, MCP cart, response cleaning.
 */

import { ShopifyClient } from './shopify-client'
import { ShopifyMCPClient } from './mcp-client'
import type { MCPProduct } from './mcp-client'
import { CatalogMCPClient } from './catalog-mcp'
import type { CatalogOffer } from './catalog-mcp'
import { getToolsForMode } from './tools'
import type {
  StoreCredentials,
  ProductDetail,
  ChatResponse,
  CartState,
  CartLineItem,
  HistoryEntry,
} from '@/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

// Synonym expansion map
const SYNONYMS: Record<string, string[]> = {
  valentine: ['romance', 'love', 'couple', 'her', 'romantic'],
  birthday: ['celebration', 'party', 'gift'],
  wedding: ['couple', 'anniversary', 'bride', 'groom', 'marriage'],
  anniversary: ['couple', 'wedding', 'romance'],
  explore: ['adventure', 'travel', 'duffel', 'outdoor', 'journey'],
  cooking: ['gourmet', 'artisan', 'chef', 'kitchen', 'culinary'],
  luxury: ['premium', 'elegant', 'exquisite', 'upscale'],
  man: ['men', 'him', 'husband', 'boyfriend', 'masculine'],
  men: ['man', 'him', 'husband', 'boyfriend'],
  him: ['man', 'men', 'husband', 'boyfriend'],
  woman: ['women', 'her', 'wife', 'girlfriend', 'feminine'],
  women: ['woman', 'her', 'wife', 'girlfriend'],
  her: ['woman', 'women', 'wife', 'girlfriend'],
  spa: ['wellness', 'relaxation', 'self-care', 'bath'],
  watch: ['timepiece', 'accessories'],
  perfume: ['fragrance', 'scent', 'cologne'],
  chocolate: ['sweet', 'dessert', 'confection'],
  wine: ['drink', 'beverage'],
  tea: ['beverage', 'drink', 'wellness'],
  journal: ['writing', 'stationery', 'notebook'],
  leather: ['bag', 'travel', 'accessories'],
  brother: ['him', 'men', 'man', 'masculine'],
  sister: ['her', 'women', 'woman', 'feminine'],
  father: ['him', 'men', 'man', 'dad'],
  mother: ['her', 'women', 'woman', 'mom'],
  friend: ['friendship', 'bestie'],
}

/** Fuzzy product match: checks if most words in the query appear in the product title */
function findProductFuzzy(products: ProductDetail[], query: string): ProductDetail | undefined {
  const words = query.toLowerCase().match(/\w{3,}/g) || [] // words 3+ chars
  if (words.length === 0) return undefined

  let bestProduct: ProductDetail | undefined
  let bestScore = 0

  for (const p of products) {
    const titleLower = p.title.toLowerCase()
    // Exact substring match (highest priority)
    if (titleLower.includes(query.toLowerCase()) || query.toLowerCase().includes(titleLower)) {
      return p
    }
    // Word-overlap score
    const matchedWords = words.filter(w => titleLower.includes(w))
    const score = matchedWords.length / words.length
    if (score > bestScore) {
      bestScore = score
      bestProduct = p
    }
  }

  // Need at least 50% word overlap
  return bestScore >= 0.5 ? bestProduct : undefined
}

function expandQuery(query: string): string[] {
  const words = query.toLowerCase().match(/\w+/g) || []
  const expanded = new Set(words)
  for (const word of words) {
    if (SYNONYMS[word]) {
      SYNONYMS[word].forEach(s => expanded.add(s))
    }
  }
  return Array.from(expanded)
}

function scoreProduct(product: ProductDetail, terms: string[], maxPrice?: number): number {
  const tags = product.tags || []
  if (tags.length === 0) return 0 // CRITICAL: empty tags = no match

  const titleLower = product.title.toLowerCase()
  const descLower = (product.descriptionHtml || '').toLowerCase()
  const tagsLower = tags.map(t => t.toLowerCase())
  const typeLower = (product.productType || '').toLowerCase()

  let score = 0
  for (const term of terms) {
    if (tagsLower.some(tag => tag.includes(term))) score += 3
    if (titleLower.includes(term)) score += 2
    if (descLower.includes(term)) score += 1
    if (typeLower.includes(term)) score += 2
  }

  if (maxPrice !== undefined) {
    const minPrice = Math.min(...product.variants.map(v => v.price).filter(p => p > 0))
    if (minPrice > maxPrice) return 0
  }

  return score
}

// Clean Gemini response of internal data
function cleanResponse(text: string): string {
  let cleaned = text
  // Remove [Products shown...] annotations
  cleaned = cleaned.replace(/\[Products shown[^\]]*\]/gi, '')
  // Remove variantId references
  cleaned = cleaned.replace(/\(variantId[^)]*\)/gi, '')
  cleaned = cleaned.replace(/variantId:\s*"[^"]*"/gi, '')
  cleaned = cleaned.replace(/variantId:\s*\S+/gi, '')
  // Remove raw GIDs
  cleaned = cleaned.replace(/gid:\/\/shopify\/\w+\/\d+/g, '')
  cleaned = cleaned.replace(/<gid:\/\/[^>]+>/g, '')
  // Remove image markdown (UI handles images)
  cleaned = cleaned.replace(/\[Image[^\]]*\]\([^)]*\)/gi, '')
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/gi, '')
  // Clean up excess whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return cleaned
}

// Build product context string for system prompt injection
function buildProductContext(history: HistoryEntry[]): string {
  const products: ProductDetail[] = []
  for (const entry of history) {
    if (entry.products) {
      products.push(...entry.products)
    }
  }
  if (products.length === 0) return ''

  // Deduplicate by productId
  const seen = new Set<number>()
  const unique = products.filter(p => {
    if (seen.has(p.productId)) return false
    seen.add(p.productId)
    return true
  })

  const lines = unique.map(p => {
    const variants = p.variants.map(v =>
      `"${v.name}" (variantId:${v.variantId}, gid:gid://shopify/ProductVariant/${v.variantId}, $${v.price})`
    ).join(', ')
    return `- ${p.title} [${variants}]`
  })

  return `\n\nPRODUCTS FROM PREVIOUS TURNS (use these variantIds for add_to_cart):\n${lines.join('\n')}`
}

const SYSTEM_PROMPT = `You are GiftAI, a warm and enthusiastic gift shopping assistant.

══ MANDATORY TOOL-CALLING RULES (NEVER SKIP) ══

🔴 RULE 1 — ALWAYS SEARCH: For EVERY message that involves finding, showing, recommending, or comparing products, you MUST call search_products or search_global_products. This includes:
  • Initial requests: "find me a gift", "show birthday gifts", "gift ideas for mom"
  • Follow-ups: "show cheaper options", "more options", "something different", "anything under $30"
  • Refinements: "but in blue", "something more luxury", "similar but for men"
  • Comparisons: "what else do you have", "show me alternatives"
  → NEVER respond with product suggestions from memory. ALWAYS call the search tool.

🔴 RULE 2 — ALWAYS USE TOOLS FOR CART: When a user says "add to cart", "buy this", "I'll take it", "add the first one", or any purchase intent:
  → You MUST call the add_to_cart function with the correct product_title and variant_name.
  → NEVER say "I've added X to your cart" without actually calling add_to_cart.

🔴 RULE 3 — FOLLOW-UP SEARCH STRATEGY:
  • "Show cheaper options" → call search with a lower max_price (e.g., half the cheapest price from last results)
  • "More options" or "show me more" → call search with a broader or rephrased query
  • "Something different" → call search with alternative keywords for the same occasion
  • "Under $X" → call search with max_price set to X

══ RESPONSE FORMAT ══

1. Keep text to 2-3 SHORT sentences. The UI renders product cards with images, prices, variants, and ratings — do NOT list those in text.
2. Good: "Here are some lovely birthday gifts! Each comes beautifully packaged. Want to add any to your cart?"
3. Bad: Listing products with prices and descriptions (the cards already show this).
4. Use **bold** for product names. Use bullet points only for very short lists.
5. NEVER include variantId, GID, image URLs, markdown images, or [Products shown...] annotations.
6. After showing products, ask if they'd like to add something to cart or see more options.
7. Be genuine and helpful — like a knowledgeable friend at a boutique gift shop.

══ SEARCH MODE ══

• When in global mode, use search_global_products for ALL searches. When in storefront mode, use search_products.
• For global results, ALWAYS mention the store/shop name. Global products have direct checkout via Shop Pay.

══ CART & POLICIES ══

• When user says "the first one" or "that rose one", match to products from your last search results, then call add_to_cart.
• For store policies: if data is sparse, say "This store hasn't published detailed [X] information yet."
• When a user wants to check out, call view_cart to confirm their items.`

interface GeminiMessage {
  role: string
  parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } }>
}

// Helper: extract numeric variant ID from GID or string
function extractNumericVariantId(id: string): string {
  const match = id.match(/(\d+)$/)
  return match ? match[1] : id
}

// Build multi-item Shopify checkout URL from cart lines (fallback only)
function buildCheckoutUrl(storeUrl: string, lines: CartLineItem[]): string {
  const host = storeUrl.replace(/^https?:\/\//, '')
  const cartParts = lines.map(l =>
    `${extractNumericVariantId(l.variantId)}:${l.quantity}`
  ).join(',')
  return `https://${host}/cart/${cartParts}`
}

// Convert MCP product response to our ProductDetail type
function mcpProductToDetail(mp: MCPProduct): ProductDetail {
  return {
    productId: parseInt(mp.product_id?.split('/')?.pop() || '0'),
    title: mp.title || '',
    descriptionHtml: mp.description || '',
    vendor: mp.vendor || '',
    productType: mp.product_type || '',
    tags: mp.tags || [],
    status: 'active',
    handle: '',
    images: mp.image_url ? [mp.image_url] : [],
    variants: (mp.variants || []).map(v => ({
      variantId: parseInt(v.variant_id?.split('/')?.pop() || '0'),
      gid: v.variant_id || '',
      name: v.title || 'Default',
      sku: '',
      price: parseFloat(v.price || '0'),
      compareAtPrice: null,
      inventoryQuantity: v.available ? 10 : 0,
      deliveryTime: null,
      availableRegions: null,
    })),
    priceRange: mp.price_range
      ? `$${parseFloat(mp.price_range.min).toFixed(2)}–$${parseFloat(mp.price_range.max).toFixed(2)}`
      : 'Price varies',
    totalStock: (mp.variants || []).filter(v => v.available).length * 10,
    hasDiscount: false,
  }
}

/**
 * Convert a Catalog MCP global offer → our ProductDetail type.
 * Enriches with shopName, shopUrl, directCheckoutUrl, isGlobal flag.
 */
function catalogOfferToDetail(offer: CatalogOffer): ProductDetail {
  const firstProduct = offer.products?.[0]
  const shopName = firstProduct?.shop?.name || ''
  const shopUrl = firstProduct?.shop?.onlineStoreUrl || ''
  const checkoutUrl = firstProduct?.checkoutUrl || ''
  const imageUrl =
    offer.images?.[0]?.url ||
    firstProduct?.featuredImage?.url ||
    ''
  const price = firstProduct?.price
    ? parseFloat(firstProduct.price.amount)
    : parseFloat(offer.priceRange?.min?.amount || '0')
  const variantId = firstProduct?.selectedProductVariant?.id || firstProduct?.id || offer.id

  return {
    productId: Math.abs(hashString(offer.id || offer.title)),
    title: offer.title || '',
    descriptionHtml: offer.description || firstProduct?.description || '',
    vendor: shopName,
    productType: '',
    tags: [],
    status: 'active',
    handle: '',
    images: imageUrl ? [imageUrl] : [],
    variants: [{
      variantId: Math.abs(hashString(variantId)),
      gid: variantId,
      name: 'Default',
      sku: '',
      price,
      compareAtPrice: null,
      inventoryQuantity: offer.availableForSale ? 10 : 0,
      deliveryTime: null,
      availableRegions: null,
    }],
    priceRange:
      offer.priceRange
        ? `$${parseFloat(offer.priceRange.min.amount).toFixed(2)}` +
          (offer.priceRange.min.amount !== offer.priceRange.max.amount
            ? `–$${parseFloat(offer.priceRange.max.amount).toFixed(2)}`
            : '')
        : `$${price.toFixed(2)}`,
    totalStock: offer.availableForSale ? 10 : 0,
    hasDiscount: false,
    // Global catalog fields
    isGlobal: true,
    shopName,
    shopUrl,
    directCheckoutUrl: checkoutUrl,
  }
}

/** Simple string hash for generating stable numeric IDs from GID strings */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return hash
}

// Singleton Catalog MCP client (server-side, reused across requests)
let catalogClient: CatalogMCPClient | null = null
function getCatalogClient(): CatalogMCPClient | null {
  if (catalogClient) return catalogClient
  const id = process.env.SHOPIFY_CATALOG_CLIENT_ID
  const secret = process.env.SHOPIFY_CATALOG_CLIENT_SECRET
  if (!id || !secret) return null
  catalogClient = new CatalogMCPClient(id, secret)
  return catalogClient
}

export async function chat(
  message: string,
  credentials: StoreCredentials,
  history: HistoryEntry[] = [],
  cartId?: string,
  clientCartState?: CartState,
  mcpSessionId?: string,
  searchMode?: 'global' | 'storefront'
): Promise<ChatResponse> {
  const shopifyClient = new ShopifyClient(credentials)
  const mcpClient = new ShopifyMCPClient(credentials.storeUrl, mcpSessionId)
  const allTools = getToolsForMode('user')

  // Filter tools based on search mode — toggle decides, not the AI
  const tools = allTools.filter(t => {
    if (searchMode === 'global') {
      // In global mode: remove local search (search_products, list_products), keep everything else
      return t.name !== 'search_products' && t.name !== 'list_products'
    }
    if (searchMode === 'storefront') {
      // In storefront mode: remove global search
      return t.name !== 'search_global_products'
    }
    return true // default: all tools
  })

  let currentCartId = cartId || ''
  let cartState: CartState | undefined = clientCartState || undefined
  let foundProducts: ProductDetail[] = []

  // Build Gemini messages
  const productContext = buildProductContext(history)
  const systemPrompt = SYSTEM_PROMPT + productContext

  const messages: GeminiMessage[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood! I\'m GiftAI, ready to help find the perfect gift. How can I help you today?' }] },
  ]

  // Add history
  for (const entry of history.slice(-12)) {
    messages.push({
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: entry.content }],
    })
  }

  // Add current message
  messages.push({ role: 'user', parts: [{ text: message }] })

  // Gemini API call with function calling
  const geminiTools = [{
    functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }]

  let responseText = ''
  let maxIterations = 5

  while (maxIterations-- > 0) {
    const body = {
      contents: messages,
      tools: geminiTools,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${errText}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const candidate = data.candidates?.[0]
    if (!candidate) throw new Error('No Gemini response candidate')

    const parts = candidate.content?.parts || []

    // Check for text response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.text)
    if (textPart) responseText = textPart.text

    // Check for function call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functionCallPart = parts.find((p: any) => p.functionCall)
    if (!functionCallPart) break // No more function calls, we're done

    const { name: fnName, args: fnArgs } = functionCallPart.functionCall
    messages.push({ role: 'model', parts: [{ functionCall: { name: fnName, args: fnArgs } }] })

    // Execute the tool
    let toolResult: Record<string, unknown> = {}

    try {
      switch (fnName) {
        case 'search_products': {
          const query = (fnArgs.query as string) || ''
          const maxPrice = fnArgs.max_price as number | undefined
          const occasion = fnArgs.occasion as string | undefined
          const searchQuery = occasion ? `${query} ${occasion}` : query

          // 1. Try MCP first (with required context param)
          let mcpProducts: ProductDetail[] = []
          try {
            const mcpResults = await mcpClient.searchProducts(searchQuery, `User searching for: ${searchQuery}`)
            mcpProducts = mcpResults.map((mp: MCPProduct) => mcpProductToDetail(mp))
          } catch {
            // MCP failed, will fall back to Admin API
          }

          // 2. If MCP returned <3, supplement with Admin API tag-based search
          if (mcpProducts.length < 3) {
            try {
              const allProducts = await shopifyClient.getProductsFormatted()
              const terms = expandQuery(searchQuery)
              const scored = allProducts
                .map(p => ({ product: p, score: scoreProduct(p, terms, maxPrice) }))
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)

              const mcpIds = new Set(mcpProducts.map(p => p.productId))
              for (const { product } of scored) {
                if (!mcpIds.has(product.productId)) {
                  mcpProducts.push(product)
                }
              }
            } catch {
              // Admin API also failed
            }
          }

          // Apply price filter
          let results = mcpProducts
          if (maxPrice) {
            results = results.filter(p => {
              const minPrice = Math.min(...p.variants.map(v => v.price).filter(pr => pr > 0))
              return minPrice <= maxPrice
            })
          }

          // Cap at 6
          results = results.slice(0, 6)
          foundProducts = results

          toolResult = {
            products: results.map(p => ({
              title: p.title,
              priceRange: p.priceRange,
              variants: p.variants.map(v => ({ name: v.name, price: v.price, variantId: v.variantId })),
              tags: p.tags,
              totalStock: p.totalStock,
            })),
            count: results.length,
            message: results.length > 0
              ? `Found ${results.length} products matching "${query}"`
              : `No products found matching "${query}". Try a different search.`,
          }
          break
        }

        case 'get_product_details': {
          const title = (fnArgs.product_title as string) || ''
          // Search in found products first (fuzzy match), then all products
          let product = findProductFuzzy(foundProducts, title)

          if (!product) {
            const allProducts = await shopifyClient.getProductsFormatted()
            product = findProductFuzzy(allProducts, title)
          }

          if (product) {
            toolResult = {
              title: product.title,
              description: product.descriptionHtml?.replace(/<[^>]+>/g, ' ').trim(),
              priceRange: product.priceRange,
              variants: product.variants.map(v => ({
                name: v.name,
                price: v.price,
                stock: v.inventoryQuantity,
              })),
              vendor: product.vendor,
              tags: product.tags,
            }
          } else {
            toolResult = { error: `Product "${title}" not found` }
          }
          break
        }

        case 'add_to_cart': {
          const productTitle = (fnArgs.product_title as string) || ''
          const variantName = (fnArgs.variant_name as string) || ''

          // Find product (fuzzy match for natural language like "tea collection")
          let product = findProductFuzzy(foundProducts, productTitle)

          if (!product) {
            const allProducts = await shopifyClient.getProductsFormatted()
            product = findProductFuzzy(allProducts, productTitle)
          }

          if (!product || product.variants.length === 0) {
            toolResult = { error: `Could not find product "${productTitle}"` }
            break
          }

          // Find variant
          let variant = product.variants[0]
          if (variantName) {
            const match = product.variants.find(v =>
              v.name.toLowerCase().includes(variantName.toLowerCase())
            )
            if (match) variant = match
          }

          const variantGid = variant.gid || `gid://shopify/ProductVariant/${variant.variantId}`

          // 1. Try MCP cart (server-side, real Shopify checkout URLs)
          let cart: CartState | null = null
          try {
            const mcpCartId = (currentCartId && currentCartId !== 'direct') ? currentCartId : undefined
            cart = await mcpClient.addToCart(
              [{ variantId: variantGid, quantity: 1 }],
              mcpCartId
            )
          } catch {
            // MCP cart failed, will fall back to client-side
          }

          if (cart) {
            currentCartId = cart.cartId
            cartState = cart

            toolResult = {
              message: `Added ${product.title} (${variant.name}) to cart!`,
              total: cart.totalAmount,
              currency: cart.currency,
              checkoutUrl: cart.checkoutUrl,
              itemCount: cart.totalQuantity,
            }
          } else {
            // 2. Fallback: client-side cart with multi-item checkout URL
            const newLine: CartLineItem = {
              lineId: String(Date.now()),
              variantId: String(variant.variantId),
              productTitle: product.title,
              variantTitle: variant.name,
              quantity: 1,
              price: String(variant.price),
              currency: 'USD',
            }

            const existingLines = cartState?.lines || []
            const existingIdx = existingLines.findIndex(
              l => extractNumericVariantId(l.variantId) === String(variant.variantId)
            )

            let updatedLines: CartLineItem[]
            if (existingIdx >= 0) {
              updatedLines = existingLines.map((l, i) =>
                i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l
              )
            } else {
              updatedLines = [...existingLines, newLine]
            }

            const totalQty = updatedLines.reduce((sum, l) => sum + l.quantity, 0)
            const totalAmount = updatedLines.reduce(
              (sum, l) => sum + parseFloat(l.price) * l.quantity, 0
            )
            const checkoutUrl = buildCheckoutUrl(credentials.storeUrl, updatedLines)

            currentCartId = 'direct'
            cartState = {
              cartId: 'direct',
              checkoutUrl,
              lines: updatedLines,
              totalAmount: String(totalAmount),
              currency: 'USD',
              totalQuantity: totalQty,
            }

            toolResult = {
              message: `Added ${product.title} (${variant.name}) to cart!`,
              total: String(totalAmount),
              currency: cartState.currency,
              checkoutUrl,
              itemCount: totalQty,
            }
          }
          break
        }

        case 'view_cart': {
          // 1. Try MCP get_cart for real cart IDs
          if (currentCartId && currentCartId !== 'direct') {
            let cart: CartState | null = null
            try {
              cart = await mcpClient.getCartById(currentCartId)
            } catch {
              // MCP get_cart failed
            }
            if (cart) {
              cartState = cart
              toolResult = {
                items: cart.lines.map(l => ({
                  product: l.productTitle,
                  variant: l.variantTitle,
                  quantity: l.quantity,
                  price: l.price,
                })),
                total: cart.totalAmount,
                currency: cart.currency,
                itemCount: cart.totalQuantity,
                checkoutUrl: cart.checkoutUrl,
              }
            } else {
              toolResult = { message: 'Cart is empty or expired.' }
            }
          } else if (cartState) {
            toolResult = {
              items: cartState.lines.map(l => ({
                product: l.productTitle,
                variant: l.variantTitle,
                quantity: l.quantity,
                price: l.price,
              })),
              total: cartState.totalAmount,
              currency: cartState.currency,
              itemCount: cartState.totalQuantity,
              checkoutUrl: cartState.checkoutUrl,
            }
          } else {
            toolResult = { message: 'Your cart is empty. Add some gifts!' }
          }
          break
        }

        case 'get_store_policies': {
          const policyType = (fnArgs.policy_type as string) || ''
          let policyText = ''
          try {
            policyText = await mcpClient.getStorePolicies(policyType)
          } catch {
            // MCP policy fetch failed
          }

          if (!policyText || policyText.length < 20) {
            // Fallback to Admin API
            try {
              const res = await fetch(
                `https://${credentials.storeUrl}/admin/api/2024-01/policies.json`,
                { headers: { 'X-Shopify-Access-Token': credentials.accessToken } }
              )
              if (res.ok) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = await res.json() as any
                const policies = data.policies || []
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const match = policies.find((p: any) =>
                  p.title?.toLowerCase().includes(policyType.toLowerCase())
                )
                if (match) {
                  policyText = `${match.title}: ${match.body}`
                }
              }
            } catch {
              // Admin API policy fetch also failed
            }
          }

          toolResult = policyText
            ? { policy: policyText }
            : { message: `This store hasn't published detailed ${policyType} information yet. Contact the store directly for specifics.` }
          break
        }

        case 'list_products': {
          const allProducts = await shopifyClient.getProductsFormatted()
          foundProducts = allProducts.slice(0, 16)
          toolResult = {
            products: allProducts.map(p => ({
              title: p.title,
              priceRange: p.priceRange,
              tags: p.tags,
              totalStock: p.totalStock,
            })),
            count: allProducts.length,
          }
          break
        }

        case 'search_global_products': {
          const gQuery = (fnArgs.query as string) || ''
          const gMaxPrice = fnArgs.max_price as number | undefined
          const gMinPrice = fnArgs.min_price as number | undefined

          const catClient = getCatalogClient()
          if (!catClient) {
            toolResult = { error: 'Global catalog search is not configured.', products: [], count: 0 }
            break
          }

          try {
            const offers = await catClient.searchProducts(
              gQuery,
              `User is looking for: ${gQuery}`,
              {
                limit: 6,
                maxPrice: gMaxPrice,
                minPrice: gMinPrice,
                availableForSale: true,
              }
            )

            const globalProducts = offers.map(o => catalogOfferToDetail(o))
            foundProducts = [...foundProducts, ...globalProducts]

            toolResult = {
              products: globalProducts.map(p => ({
                title: p.title,
                priceRange: p.priceRange,
                shopName: p.shopName,
                shopUrl: p.shopUrl,
                directCheckoutUrl: p.directCheckoutUrl,
                isGlobal: true,
              })),
              count: globalProducts.length,
              message: globalProducts.length > 0
                ? `Found ${globalProducts.length} products from Shopify merchants worldwide for "${gQuery}"`
                : `No global results found for "${gQuery}". Try a different search.`,
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Global search failed'
            toolResult = { error: errMsg, products: [], count: 0 }
          }
          break
        }

        default:
          toolResult = { error: `Unknown tool: ${fnName}` }
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Tool execution failed'
      toolResult = { error: errMsg }
    }

    // Send tool result back to Gemini
    messages.push({
      role: 'function',
      parts: [{ functionResponse: { name: fnName, response: toolResult } }],
    })
  }

  // Clean the response
  responseText = cleanResponse(responseText)

  // Server-side hallucination retry: if Gemini said "added to cart" but no cartState
  if (
    responseText.toLowerCase().includes('added') &&
    responseText.toLowerCase().includes('cart') &&
    !cartState &&
    foundProducts.length > 0
  ) {
    // Gemini hallucinated an add-to-cart. Strip false claim.
    responseText = responseText.replace(/I['']ve added.*?cart[.!]?/gi, '')
    responseText = responseText.replace(/Added.*?to.*?cart[.!]?/gi, '')
    responseText = responseText.trim()
    if (!responseText) {
      responseText = 'Which product would you like to add to your cart? Just let me know!'
    }
  }

  return {
    message: responseText,
    products: foundProducts.length > 0 ? foundProducts : undefined,
    cartState,
    checkoutUrl: cartState?.checkoutUrl,
    mcpSessionId: mcpClient.getSessionId(),
  }
}
