/**
 * Gemini API integration with function calling.
 *
 * Orchestrates the chat loop: user message → Gemini → tool calls → results → final response.
 */

import { ShopifyClient } from './shopify-client'
import { getToolsForMode } from './tools'
import type {
  StoreCredentials,
  ProductDetail,
  ChatResponse,
  AppMode,
} from '@/types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<{
    text?: string
    functionCall?: { name: string; args: Record<string, unknown> }
    functionResponse?: { name: string; response: { result: unknown } }
  }>
}

function buildSystemPrompt(mode: AppMode): string {
  if (mode === 'admin') {
    return `You are a Shopify store management assistant. You help store admins manage their inventory through natural language conversation.

Your capabilities:
- View store info, products, variants, stock levels, and pricing
- Create new products with variants, images, and metadata
- Update product details (title, description, status, tags, vendor)
- Update variant prices and inventory levels
- Delete products

Guidelines:
- When the user asks to see products, ALWAYS call list_products first to get actual data
- When creating products, include relevant details: description, vendor, type, tags, variants with prices/SKUs
- For inventory updates, first list products to find the correct variant IDs, then update
- Format your responses cleanly with product details, prices, and stock info
- Be precise with numbers — always show real data from the store
- If an operation fails, explain what happened and suggest alternatives
- When showing products, include images, prices, and all variant details`
  }

  return `You are a luxury gift shopping assistant. You help customers find perfect gifts through natural language conversation.

Your capabilities:
- Browse the store's product catalog with images, prices, and availability
- Recommend gifts by occasion (Valentine's Day, Birthday, Anniversary, etc.), region, and budget
- Show detailed product information including variants, stock, delivery times, and regions
- Create checkout links so customers can purchase items

Guidelines:
- Be warm, helpful, and knowledgeable about the products
- When a user asks for recommendations, use the recommend_products tool with appropriate filters
- Always show product images, prices, and key details in your responses
- If the user wants to buy something, create a checkout and provide the link
- Mention delivery times and region availability when relevant
- For budget questions, filter by price and show the best options
- If no products match, suggest broadening the criteria
- Format product information clearly — name, price range, and what makes it special`
}

// === Tool execution ===

async function executeTool(
  client: ShopifyClient,
  toolName: string,
  args: Record<string, unknown>,
  mode: AppMode,
): Promise<{ result: unknown; products?: ProductDetail[] }> {
  switch (toolName) {
    case 'get_store_info': {
      const shop = await client.getShop()
      return { result: shop }
    }

    case 'list_products': {
      const includeMetafields = (args.includeMetafields as boolean) ?? true
      const products = await client.fetchProductDetails(includeMetafields)
      return { result: products, products }
    }

    case 'get_product': {
      const product = await client.getProduct(args.productId as number)
      return { result: product }
    }

    case 'create_product': {
      const payload: Record<string, unknown> = {
        title: args.title as string,
        body_html: (args.descriptionHtml as string) || '',
        vendor: (args.vendor as string) || '',
        product_type: (args.productType as string) || '',
        tags: ((args.tags as string[]) || []).join(', '),
        status: 'active',
      }

      const variants = args.variants as Array<{
        option: string
        price: string
        sku: string
        inventory?: number
      }> | undefined

      if (variants?.length) {
        payload.options = [{ name: 'Style' }]
        payload.variants = variants.map((v) => ({
          option1: v.option,
          price: v.price,
          sku: v.sku || '',
          inventory_management: 'shopify',
        }))
      }

      const imageUrls = args.imageUrls as string[] | undefined
      if (imageUrls?.length) {
        payload.images = imageUrls.map((url, i) => ({
          src: url,
          position: i + 1,
        }))
      }

      const created = await client.createProduct(payload)

      // Set inventory for each variant
      if (variants?.length && created.variants) {
        const locationId = await client.getPrimaryLocationId()
        for (let i = 0; i < created.variants.length; i++) {
          const inputVariant = variants[i]
          if (inputVariant?.inventory) {
            const variantData = await client.getVariant(created.variants[i].id)
            await client.setInventoryLevel(
              variantData.inventory_item_id,
              locationId,
              inputVariant.inventory,
            )
          }
        }
      }

      return { result: { success: true, product: created } }
    }

    case 'update_product': {
      const { productId, ...updates } = args as Record<string, unknown>
      const shopifyUpdates: Record<string, unknown> = {}
      if (updates.title) shopifyUpdates.title = updates.title
      if (updates.descriptionHtml)
        shopifyUpdates.body_html = updates.descriptionHtml
      if (updates.status) shopifyUpdates.status = updates.status
      if (updates.tags) shopifyUpdates.tags = updates.tags
      if (updates.vendor) shopifyUpdates.vendor = updates.vendor

      const updated = await client.updateProduct(
        productId as number,
        shopifyUpdates,
      )
      return { result: { success: true, product: updated } }
    }

    case 'delete_product': {
      await client.deleteProduct(args.productId as number)
      return { result: { success: true, message: 'Product deleted' } }
    }

    case 'update_variant_price': {
      const updated = await client.updateVariant(args.variantId as number, {
        price: args.price as string,
      })
      return { result: { success: true, variant: updated } }
    }

    case 'set_inventory': {
      const variant = await client.getVariant(args.variantId as number)
      const locationId = await client.getPrimaryLocationId()
      await client.setInventoryLevel(
        variant.inventory_item_id,
        locationId,
        args.quantity as number,
      )
      return {
        result: {
          success: true,
          message: `Inventory set to ${args.quantity}`,
        },
      }
    }

    case 'recommend_products': {
      const products = await client.recommendProducts({
        occasion: args.occasion as string | undefined,
        region: args.region as string | undefined,
        budgetMax: args.budgetMax as number | undefined,
        topN: (args.topN as number) || 5,
      })
      return { result: products, products }
    }

    case 'create_checkout': {
      const items = (
        args.items as Array<{ variantId: number; quantity: number }>
      ).map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      }))
      const checkout = await client.createCheckout(items)
      return {
        result: {
          checkoutUrl: checkout.web_url,
          totalPrice: checkout.total_price,
          currency: checkout.currency,
        },
      }
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` } }
  }
}

// === Main chat function ===

export async function chat(
  message: string,
  mode: AppMode,
  credentials: StoreCredentials,
  history: Array<{ role: string; content: string }>,
): Promise<ChatResponse> {
  const client = new ShopifyClient(credentials)
  const tools = getToolsForMode(mode)
  const systemPrompt = buildSystemPrompt(mode)

  // Build Gemini conversation history
  const geminiHistory: GeminiMessage[] = []

  for (const msg of history.slice(-10)) {
    geminiHistory.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })
  }

  geminiHistory.push({
    role: 'user',
    parts: [{ text: message }],
  })

  // Gemini request with function calling
  const geminiTools = [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ]

  let allProducts: ProductDetail[] | undefined
  let checkoutUrl: string | undefined

  // Multi-turn loop for function calling
  const MAX_TURNS = 6
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiHistory,
      tools: geminiTools,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }

    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Gemini API error:', errText)
      throw new Error(`Gemini API error (${resp.status}): ${errText}`)
    }

    const data = await resp.json()
    const candidate = data.candidates?.[0]
    if (!candidate?.content?.parts) {
      return {
        message:
          'I had trouble processing that request. Could you try rephrasing?',
      }
    }

    const parts = candidate.content.parts

    // Check for function calls
    const functionCalls = parts.filter(
      (p: Record<string, unknown>) => p.functionCall,
    )

    if (functionCalls.length === 0) {
      // No function calls — extract text response
      const textParts = parts
        .filter((p: Record<string, unknown>) => p.text)
        .map((p: Record<string, unknown>) => p.text)
        .join('')

      return {
        message: textParts || 'I processed your request.',
        products: allProducts,
        checkoutUrl,
      }
    }

    // Add model response to history
    geminiHistory.push({
      role: 'model',
      parts: parts,
    })

    // Execute each function call and add results
    const responseParts: GeminiMessage['parts'] = []

    for (const fc of functionCalls) {
      const { name, args } = fc.functionCall
      try {
        const result = await executeTool(client, name, args || {}, mode)
        if (result.products) allProducts = result.products
        if (
          result.result &&
          typeof result.result === 'object' &&
          'checkoutUrl' in (result.result as Record<string, unknown>)
        ) {
          checkoutUrl = (result.result as Record<string, unknown>)
            .checkoutUrl as string
        }

        // Truncate large results to avoid token limits
        let resultStr = JSON.stringify(result.result)
        if (resultStr.length > 30000) {
          // Summarize large product lists
          if (Array.isArray(result.result)) {
            const summarized = (result.result as ProductDetail[]).map((p) => ({
              productId: p.productId,
              title: p.title,
              vendor: p.vendor,
              priceRange: p.priceRange,
              totalStock: p.totalStock,
              tags: p.tags,
              images: p.images?.slice(0, 1),
              variants: p.variants?.map((v) => ({
                variantId: v.variantId,
                name: v.name,
                price: v.price,
                sku: v.sku,
                inventoryQuantity: v.inventoryQuantity,
                deliveryTime: v.deliveryTime,
                availableRegions: v.availableRegions,
              })),
            }))
            resultStr = JSON.stringify(summarized)
          }
        }

        responseParts.push({
          functionResponse: {
            name,
            response: { result: JSON.parse(resultStr) },
          },
        })
      } catch (err) {
        responseParts.push({
          functionResponse: {
            name,
            response: {
              result: {
                error: err instanceof Error ? err.message : String(err),
              },
            },
          },
        })
      }
    }

    geminiHistory.push({
      role: 'user',
      parts: responseParts,
    })
  }

  return {
    message: 'I completed the operations. Let me know if you need anything else.',
    products: allProducts,
    checkoutUrl,
  }
}
