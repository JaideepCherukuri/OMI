/**
 * Gemini function-calling tool definitions.
 * These mirror the ShopifyClient methods and are passed to Gemini
 * so the LLM can invoke Shopify operations via natural language.
 */

export const adminTools = [
  {
    name: 'get_store_info',
    description:
      'Get basic store information including name, domain, currency, and plan.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'list_products',
    description:
      'List all products in the store with their variants, prices, stock levels, images, delivery times, and available regions.',
    parameters: {
      type: 'object' as const,
      properties: {
        includeMetafields: {
          type: 'boolean',
          description:
            'Include variant-level metafields like delivery_time and available_regions. Slower but more complete.',
        },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Get details for a specific product by its ID.',
    parameters: {
      type: 'object' as const,
      properties: {
        productId: {
          type: 'number',
          description: 'The Shopify product ID.',
        },
      },
      required: ['productId'],
    },
  },
  {
    name: 'create_product',
    description:
      'Create a new product in the store. Accepts title, description, vendor, type, tags, variants with prices/SKUs, and image URLs.',
    parameters: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Product title.' },
        descriptionHtml: {
          type: 'string',
          description: 'HTML description of the product.',
        },
        vendor: { type: 'string', description: 'Product vendor name.' },
        productType: { type: 'string', description: 'Product type/category.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization (occasion, etc).',
        },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              option: { type: 'string', description: 'Variant option name.' },
              price: { type: 'string', description: 'Variant price.' },
              sku: { type: 'string', description: 'Variant SKU.' },
              inventory: {
                type: 'number',
                description: 'Stock quantity.',
              },
            },
          },
          description: 'Product variants with pricing and stock.',
        },
        imageUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Image URLs for the product.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_product',
    description:
      'Update an existing product. Can change title, description, status, tags, etc.',
    parameters: {
      type: 'object' as const,
      properties: {
        productId: { type: 'number', description: 'Product ID to update.' },
        title: { type: 'string', description: 'New title.' },
        descriptionHtml: { type: 'string', description: 'New description HTML.' },
        status: {
          type: 'string',
          enum: ['active', 'draft', 'archived'],
          description: 'Product status.',
        },
        tags: { type: 'string', description: 'Comma-separated tags.' },
        vendor: { type: 'string', description: 'New vendor name.' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'delete_product',
    description: 'Delete a product from the store by its ID.',
    parameters: {
      type: 'object' as const,
      properties: {
        productId: { type: 'number', description: 'Product ID to delete.' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'update_variant_price',
    description: 'Update the price of a specific product variant.',
    parameters: {
      type: 'object' as const,
      properties: {
        variantId: { type: 'number', description: 'Variant ID to update.' },
        price: { type: 'string', description: 'New price.' },
      },
      required: ['variantId', 'price'],
    },
  },
  {
    name: 'set_inventory',
    description:
      'Set inventory level for a variant at the primary location.',
    parameters: {
      type: 'object' as const,
      properties: {
        variantId: { type: 'number', description: 'Variant ID.' },
        quantity: {
          type: 'number',
          description: 'New inventory quantity.',
        },
      },
      required: ['variantId', 'quantity'],
    },
  },
]

export const userTools = [
  {
    name: 'list_products',
    description:
      'List all available products with images, prices, descriptions, variants, stock, delivery times, and available regions.',
    parameters: {
      type: 'object' as const,
      properties: {
        includeMetafields: {
          type: 'boolean',
          description: 'Include delivery times and regions.',
        },
      },
    },
  },
  {
    name: 'recommend_products',
    description:
      'Get gift recommendations filtered by occasion, region, and budget. Returns scored and ranked products.',
    parameters: {
      type: 'object' as const,
      properties: {
        occasion: {
          type: 'string',
          description:
            "Filter by occasion tag, e.g. Valentine's Day, Birthday, Wedding Anniversary.",
        },
        region: {
          type: 'string',
          description:
            'Filter by available delivery region, e.g. India, USA, UK.',
        },
        budgetMax: {
          type: 'number',
          description: 'Maximum budget — at least one variant must be ≤ this.',
        },
        topN: {
          type: 'number',
          description: 'Number of recommendations to return (default 5).',
        },
      },
    },
  },
  {
    name: 'get_product',
    description:
      'Get full details for a specific product including all variant info.',
    parameters: {
      type: 'object' as const,
      properties: {
        productId: { type: 'number', description: 'Product ID.' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'create_checkout',
    description:
      'Create a Shopify checkout with the specified items. Returns a checkout URL the user can visit to complete purchase.',
    parameters: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              variantId: { type: 'number', description: 'Variant ID.' },
              quantity: { type: 'number', description: 'Quantity.' },
            },
            required: ['variantId', 'quantity'],
          },
          description: 'Line items for the checkout.',
        },
      },
      required: ['items'],
    },
  },
]

export function getToolsForMode(mode: 'admin' | 'user') {
  return mode === 'admin' ? adminTools : userTools
}
