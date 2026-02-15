// === Shopify Types ===

export interface ShopifyVariant {
  id: number
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  price: string
  compare_at_price: string | null
  sku: string
  inventory_quantity: number
  inventory_item_id: number
  inventory_management: string | null
  weight: number
  weight_unit: string
}

export interface ShopifyImage {
  id: number
  src: string
  alt: string | null
  position: number
  width: number
  height: number
}

export interface ShopifyProduct {
  id: number
  title: string
  body_html: string
  vendor: string
  product_type: string
  handle: string
  status: string
  tags: string
  variants: ShopifyVariant[]
  images: ShopifyImage[]
  created_at: string
  updated_at: string
}

export interface ShopifyShop {
  id: number
  name: string
  email: string
  domain: string
  myshopify_domain: string
  currency: string
  money_format: string
  plan_display_name: string
}

export interface ShopifyLocation {
  id: number
  name: string
  active: boolean
  address1: string
  city: string
  country: string
}

export interface ShopifyCheckout {
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

// === App Types ===

export type AppMode = 'admin' | 'user'

export interface StoreCredentials {
  storeUrl: string
  accessToken: string
}

export interface VariantDetail {
  variantId: number
  name: string
  sku: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  deliveryTime: string | null
  availableRegions: string | null
}

export interface ProductDetail {
  productId: number
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  tags: string[]
  status: string
  handle: string
  images: string[]
  variants: VariantDetail[]
  priceRange: string
  totalStock: number
  hasDiscount: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  products?: ProductDetail[]
  checkoutUrl?: string
}

export interface ChatRequest {
  message: string
  mode: AppMode
  storeCredentials: StoreCredentials
  history: Array<{ role: string; content: string }>
}

export interface ChatResponse {
  message: string
  products?: ProductDetail[]
  checkoutUrl?: string
}
