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

// === App Types ===

export interface StoreCredentials {
  storeUrl: string
  accessToken: string
}

export type AppMode = 'user'

export interface VariantDetail {
  variantId: number
  name: string
  sku: string
  price: number
  compareAtPrice: number | null
  inventoryQuantity: number
  deliveryTime: string | null
  availableRegions: string | null
  gid?: string
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
  // Global Catalog MCP fields (present for products from cross-merchant search)
  isGlobal?: boolean
  shopName?: string
  shopUrl?: string
  directCheckoutUrl?: string
}

// === Cart Types ===

export interface CartLineItem {
  lineId: string
  variantId: string
  productTitle: string
  variantTitle: string
  quantity: number
  price: string
  currency: string
  imageUrl?: string
}

// Convenience alias
export type CartLine = CartLineItem

export interface CartState {
  cartId: string
  checkoutUrl: string
  lines: CartLineItem[]
  totalAmount: string
  currency: string
  totalQuantity: number
}

// === Chat Types ===

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  source?: 'voice' | 'text' | 'system'
  products?: ProductDetail[]
  checkoutUrl?: string
  cartState?: CartState
  streaming?: boolean
}

export interface HistoryEntry {
  role: string
  content: string
  products?: ProductDetail[]
}

export interface ChatRequest {
  message: string
  storeCredentials: StoreCredentials
  history: HistoryEntry[]
  cartId?: string
}

export interface ChatResponse {
  message: string
  products?: ProductDetail[]
  checkoutUrl?: string
  cartState?: CartState
  mcpSessionId?: string
}

// === Voice Types ===

export type VoiceState = 'disconnected' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking'

export type StageContent = 'welcome' | 'products' | 'product_detail' | 'cart' | 'checkout'

export interface AgentProductsEvent {
  type: 'products_found'
  products: ProductDetail[]
  query: string
}

export interface AgentCartEvent {
  type: 'cart_updated'
  cart: CartState
}

export interface AgentCheckoutEvent {
  type: 'checkout_ready'
  url: string
}

export interface AgentProductDetailEvent {
  type: 'product_detail'
  product: ProductDetail
}

export type AgentDataEvent = AgentProductsEvent | AgentCartEvent | AgentCheckoutEvent | AgentProductDetailEvent

// === Express Checkout Types ===

export interface BuyerAddress {
  label?: string
  firstName: string
  lastName: string
  streetAddress: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

export interface BuyerVaultProfile {
  email: string
  phone?: string
  defaultAddressIndex: number
  addresses: BuyerAddress[]
}

export interface ExpressCheckoutState {
  isOpen: boolean
  checkoutUrl: string | null
  jwt: string | null
  mode: 'prefilled' | 'direct' | null
  checkoutId: string | null
  productTitle: string | null
  shopName: string | null
  productImage: string | null
  productPrice: string | null
  status: 'loading' | 'ready' | 'completed' | 'error'
  error: string | null
}
