/**
 * Gemini function calling tool definitions.
 */

export const userTools = [
  {
    name: 'search_products',
    description: 'Search the gift store catalog by query, occasion, budget, or recipient. Always call this for product recommendations — never guess.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query (e.g. "wedding gifts", "gifts for her", "luxury watches")' },
        max_price: { type: 'number', description: 'Maximum price filter (optional)' },
        occasion: { type: 'string', description: 'Occasion like "Valentine\'s Day", "Birthday", "Wedding Anniversary"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get detailed info about a specific product by title.',
    parameters: {
      type: 'object' as const,
      properties: {
        product_title: { type: 'string', description: 'Product title to look up' },
      },
      required: ['product_title'],
    },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart. Must call this function to add items — never fake it in text.',
    parameters: {
      type: 'object' as const,
      properties: {
        product_title: { type: 'string', description: 'The product title to add' },
        variant_name: { type: 'string', description: 'Specific variant name (e.g. "Ruby Red", "Large")' },
      },
      required: ['product_title'],
    },
  },
  {
    name: 'view_cart',
    description: 'View the current shopping cart contents and total.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_store_policies',
    description: 'Look up store policies like shipping, returns, or refunds.',
    parameters: {
      type: 'object' as const,
      properties: {
        policy_type: { type: 'string', description: 'Type of policy: "shipping", "returns", "refund", "privacy"' },
      },
      required: ['policy_type'],
    },
  },
  {
    name: 'list_products',
    description: 'List all products in the store catalog.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'search_global_products',
    description:
      'Search across ALL Shopify stores worldwide for products. Use for broad discovery, when the user wants to compare options across merchants, or for products our store doesn\'t carry. Results include shop name and direct checkout URLs.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g. "matcha tea set", "leather journal")',
        },
        max_price: {
          type: 'number',
          description: 'Maximum price in USD (optional)',
        },
        min_price: {
          type: 'number',
          description: 'Minimum price in USD (optional)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'express_checkout',
    description:
      'Trigger Express Checkout for a product. Opens the in-app checkout sheet. Use when the user says "buy", "checkout", or "purchase" a specific product.',
    parameters: {
      type: 'object' as const,
      properties: {
        product_title: {
          type: 'string',
          description: 'The product title to checkout',
        },
        variant_name: {
          type: 'string',
          description: 'Specific variant name (optional)',
        },
      },
      required: ['product_title'],
    },
  },
  {
    name: 'get_buyer_profile',
    description:
      'Check if the buyer has a saved shipping profile for Express Checkout. Returns whether profile exists (never reveal details). Use before express_checkout to determine if pre-fill is possible.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  },
]

export function getToolsForMode(_mode: string = 'user') {
  return userTools
}
