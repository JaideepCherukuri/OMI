'use client'

/**
 * GiftAI — Voice-First Gift Shopping
 *
 * Layout v2 (Shopify-inspired chat-first):
 *
 *   ┌──────────────────────────────┐
 *   │ Header (GiftAI + Cart badge) │
 *   ├──────────────────────────────┤
 *   │                              │
 *   │   CHAT FLOW (scrollable)     │
 *   │   ● AI messages              │
 *   │   [User bubbles]             │
 *   │   [Product cards inline]     │
 *   │   [Cart widgets inline]      │
 *   │                              │
 *   ├──────────────────────────────┤
 *   │   Suggestion Chips           │
 *   ├──────────────────────────────┤
 *   │   Input + 🎤 Voice Orb      │
 *   └──────────────────────────────┘
 *
 *   + ProductDetailPanel (right-side slide-in)
 *   + CheckoutModal (overlay)
 *
 * Products, cart widgets, and checkout render INLINE in the chat flow,
 * inspired by Shopify's Agentic Commerce demo (Feb 2026).
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { VoiceProvider, useVoice } from '@/components/VoiceProvider'
import { ChatMessage, ChatProductCard, ProductDetailPanel, InlineCartWidget, CheckoutModal, ThinkingIndicator } from '@/components/chat'
import VoiceControls from '@/components/VoiceControls'
import StoreSwapModal from '@/components/StoreSwapModal'
import Orb from '@/components/Orb'
import type { StoreCredentials, ProductDetail, VariantDetail, ChatMessage as ChatMessageType } from '@/types'
import { ShoppingBag, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react'

// ═══════════════════════════════════════════
// Main Page (with store credentials)
// ═══════════════════════════════════════════

export default function Home() {
  const [storeCredentials, setStoreCredentials] = useState<StoreCredentials>({
    storeUrl: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
    accessToken: process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN || '',
  })
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (storeCredentials.accessToken) {
      setIsConnected(true)
    }
  }, [storeCredentials.accessToken])

  if (!isConnected) {
    return (
      <ConnectScreen
        onConnect={(creds) => {
          setStoreCredentials(creds)
          setIsConnected(true)
        }}
      />
    )
  }

  return (
    <VoiceProvider storeCredentials={storeCredentials}>
      <GiftAIApp
        storeCredentials={storeCredentials}
        onStoreChange={(creds) => {
          setStoreCredentials(creds)
        }}
      />
    </VoiceProvider>
  )
}

// ═══════════════════════════════════════════
// Main App — Chat-First Layout
// ═══════════════════════════════════════════

function GiftAIApp({
  storeCredentials,
  onStoreChange,
}: {
  storeCredentials: StoreCredentials
  onStoreChange: (creds: StoreCredentials) => void
}) {
  const voice = useVoice()
  const [storeSwapOpen, setStoreSwapOpen] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [detailProduct, setDetailProduct] = useState<ProductDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages or products
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [voice.messages.length, voice.products.length, voice.cartState])

  // ── Contextual suggestions ──
  const suggestions = useMemo(() => {
    if (voice.products.length > 0) {
      return [
        { label: '🛒 Add first one', action: 'add_first' },
        { label: '💡 Tell me more', action: 'tell_more' },
        { label: '💰 Cheaper options', action: 'cheaper' },
        { label: '🎁 More options', action: 'more' },
      ]
    }
    if (voice.cartState && voice.cartState.totalQuantity > 0) {
      return [
        { label: '✅ Checkout', action: 'checkout' },
        { label: '🛍️ Keep shopping', action: 'keep_shopping' },
      ]
    }
    if (voice.messages.length <= 1) {
      return [
        { label: '💝 Valentine\'s gifts', action: 'search_valentines' },
        { label: '🎂 Birthday ideas', action: 'search_birthday' },
        { label: '💍 Wedding gifts', action: 'search_wedding' },
        { label: '✨ Show everything', action: 'search_all' },
      ]
    }
    return []
  }, [voice.products, voice.cartState, voice.messages])

  const handleSuggestion = useCallback(
    async (action: string) => {
      const map: Record<string, string> = {
        add_first: voice.products[0]?.title
          ? `Add ${voice.products[0].title} to my cart`
          : 'Add the first one to my cart',
        tell_more: voice.products[0]?.title
          ? `Tell me more about ${voice.products[0].title}`
          : 'Tell me more about the first one',
        cheaper: 'Show me cheaper options',
        more: 'Show me more gift options',
        checkout: 'Checkout please',
        keep_shopping: 'Show me more gifts',
        search_valentines: "Show me Valentine's Day gifts",
        search_birthday: 'Birthday gift ideas',
        search_wedding: 'Wedding gift suggestions',
        search_all: 'Show me everything you have',
      }
      await voice.sendTextMessage(map[action] || action)
    },
    [voice],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = textInput.trim()
      if (!text) return
      setTextInput('')
      await voice.sendTextMessage(text)
    },
    [textInput, voice],
  )

  // ── Product actions ──
  const handleProductClick = useCallback((product: ProductDetail) => {
    setDetailProduct(product)
    setDetailOpen(true)
  }, [])

  const handleAddToCart = useCallback(
    (product: ProductDetail, variant?: VariantDetail) => {
      const msg = variant && variant.name !== 'Default Title'
        ? `Add ${product.title} (${variant.name}) to my cart`
        : `Add ${product.title} to my cart`
      voice.sendTextMessage(msg)
    },
    [voice],
  )

  const handleBuyNow = useCallback(
    (product: ProductDetail, variant?: VariantDetail) => {
      const msg = variant && variant.name !== 'Default Title'
        ? `I want to buy ${product.title} (${variant.name})`
        : `I want to buy ${product.title}`
      voice.sendTextMessage(msg)
    },
    [voice],
  )

  // ── Typing-pauses-mic ──
  const handleInputFocus = useCallback(() => {
    if (voice.voiceConnected && voice.micEnabled) {
      voice.toggleMic()
    }
  }, [voice])

  const handleInputBlur = useCallback(() => {
    if (voice.voiceConnected && !voice.micEnabled && !textInput) {
      voice.toggleMic()
    }
  }, [voice, textInput])

  const cartBadge = voice.cartState?.totalQuantity || 0

  // ── Interleave messages with product cards and cart widgets ──
  const chatItems = useMemo(() => {
    const items: Array<{
      type: 'message' | 'products' | 'cart'
      data: any
      key: string
    }> = []

    let productsInserted = false
    let cartInserted = false

    for (const msg of voice.messages) {
      items.push({ type: 'message', data: msg, key: `msg-${msg.id}` })

      // After AI mentions products, insert product cards
      if (
        !productsInserted &&
        msg.role === 'assistant' &&
        voice.products.length > 0 &&
        (msg.content.toLowerCase().includes('found') ||
          msg.content.toLowerCase().includes('option') ||
          msg.content.toLowerCase().includes('product') ||
          msg.content.toLowerCase().includes('here'))
      ) {
        items.push({
          type: 'products',
          data: voice.products,
          key: `products-${msg.id}`,
        })
        productsInserted = true
      }

      // After AI mentions cart, insert cart widget
      if (
        !cartInserted &&
        msg.role === 'assistant' &&
        voice.cartState &&
        voice.cartState.totalQuantity > 0 &&
        (msg.content.toLowerCase().includes('cart') ||
          msg.content.toLowerCase().includes('added') ||
          msg.content.toLowerCase().includes('checkout'))
      ) {
        items.push({
          type: 'cart',
          data: voice.cartState,
          key: `cart-${msg.id}`,
        })
        cartInserted = true
      }
    }

    // If products exist but weren't inserted after a message, add at the end
    if (!productsInserted && voice.products.length > 0) {
      items.push({
        type: 'products',
        data: voice.products,
        key: 'products-end',
      })
    }

    // Same for cart
    if (!cartInserted && voice.cartState && voice.cartState.totalQuantity > 0) {
      items.push({
        type: 'cart',
        data: voice.cartState,
        key: 'cart-end',
      })
    }

    return items
  }, [voice.messages, voice.products, voice.cartState])

  return (
    <div className="h-dvh flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      {/* ── Header ────────────────────────────── */}
      <header className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Logo + Orb */}
          <div className="flex items-center gap-3">
            <Orb state={voice.voiceState} size="sm" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">GiftAI</h1>
              <p className="text-[11px] text-gray-400 truncate max-w-[180px]">
                {storeCredentials.storeUrl}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStoreSwapOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Switch store"
            >
              <ArrowRightLeft size={18} className="text-gray-400" />
            </button>
            <button
              onClick={() => {
                if (voice.cartState?.checkoutUrl) {
                  setCheckoutOpen(true)
                }
              }}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Cart"
            >
              <ShoppingBag size={20} className="text-gray-600" />
              {cartBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartBadge}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Chat Flow ─────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-1">
          {/* Welcome state (no messages yet) */}
          {voice.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <Orb
                state={voice.voiceState}
                size="lg"
                onClick={() => {
                  if (voice.voiceState === 'disconnected') {
                    voice.connectVoice()
                  }
                }}
              />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">
                  What are you looking for?
                </h2>
                <p className="text-sm text-gray-500 max-w-xs">
                  {voice.voiceState === 'disconnected'
                    ? 'Tap the mic to start voice shopping, or type below'
                    : 'Listening... tell me what gift you need'}
                </p>
              </div>
            </div>
          )}

          {/* Chat items (messages + inline products + inline cart) */}
          {chatItems.map((item) => {
            if (item.type === 'message') {
              return <ChatMessage key={item.key} message={item.data} />
            }

            if (item.type === 'products') {
              const products = item.data as ProductDetail[]
              return (
                <div key={item.key} className="py-3">
                  <ProductCarouselInline
                    products={products}
                    onProductClick={handleProductClick}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    highlightedProductId={voice.highlightedProductId}
                  />
                </div>
              )
            }

            if (item.type === 'cart') {
              return (
                <div key={item.key} className="py-2 max-w-lg">
                  <InlineCartWidget
                    cartState={item.data}
                    storeName={storeCredentials.storeUrl.replace('.myshopify.com', '')}
                    onCheckout={() => setCheckoutOpen(true)}
                  />
                </div>
              )
            }

            return null
          })}

          {/* Loading indicator while waiting for AI response */}
          {voice.isTextLoading && <ThinkingIndicator />}

          {/* Scroll anchor */}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Suggestion Chips ──────────────────── */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-0.5">
            {suggestions.map((s) => (
              <button
                key={s.action}
                onClick={() => handleSuggestion(s.action)}
                className="flex-shrink-0 px-3.5 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full transition-colors text-gray-700"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input + Voice ─────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <form onSubmit={handleSubmit} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="What are you looking for?"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition-all"
              disabled={voice.isTextLoading}
            />
          </form>
          <VoiceControls
            voiceState={voice.voiceState}
            micEnabled={voice.micEnabled}
            speakerEnabled={voice.speakerEnabled}
            onToggleMic={voice.toggleMic}
            onToggleSpeaker={voice.toggleSpeaker}
            onConnect={voice.connectVoice}
            onDisconnect={voice.disconnectVoice}
          />
        </div>
      </div>

      {/* ── Panels & Modals ───────────────────── */}
      <ProductDetailPanel
        product={detailProduct}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAddToCart={(product, variant, qty) => {
          handleAddToCart(product, variant)
          setDetailOpen(false)
        }}
        onBuyNow={(product, variant, qty) => {
          handleBuyNow(product, variant)
          setDetailOpen(false)
        }}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        checkoutUrl={voice.cartState?.checkoutUrl}
        storeName={storeCredentials.storeUrl.replace('.myshopify.com', '')}
        cartState={voice.cartState}
      />

      <StoreSwapModal
        isOpen={storeSwapOpen}
        onClose={() => setStoreSwapOpen(false)}
        onConnect={(creds) => {
          onStoreChange(creds)
          setStoreSwapOpen(false)
        }}
        currentStore={storeCredentials.storeUrl}
      />
    </div>
  )
}

// ═══════════════════════════════════════════
// Inline Product Carousel (within chat flow)
// ═══════════════════════════════════════════

function ProductCarouselInline({
  products,
  onProductClick,
  onAddToCart,
  onBuyNow,
  highlightedProductId,
}: {
  products: ProductDetail[]
  onProductClick?: (p: ProductDetail) => void
  onAddToCart?: (p: ProductDetail, v?: VariantDetail) => void
  onBuyNow?: (p: ProductDetail, v?: VariantDetail) => void
  highlightedProductId?: number | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll, { passive: true })
    return () => { el?.removeEventListener('scroll', checkScroll) }
  }, [products])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: dir === 'left' ? -260 : 260,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {products.map((p, i) => (
          <ChatProductCard
            key={p.productId}
            product={p}
            staggerIndex={i}
            onProductClick={onProductClick}
            onAddToCart={onAddToCart}
            onBuyNow={onBuyNow}
            isHighlighted={p.productId === highlightedProductId}
          />
        ))}
      </div>

      {/* Scroll arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors z-10 border border-gray-200"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors z-10 border border-gray-200"
        >
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Connect Screen
// ═══════════════════════════════════════════

function ConnectScreen({
  onConnect,
}: {
  onConnect: (creds: StoreCredentials) => void
}) {
  const [storeUrl, setStoreUrl] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  const handleConnect = () => {
    if (!storeUrl.trim()) {
      setError('Store URL is required')
      return
    }
    if (!token.trim()) {
      setError('Access token is required')
      return
    }
    if (!token.startsWith('shpat_')) {
      setError('Token should start with shpat_')
      return
    }
    setError('')
    onConnect({ storeUrl: storeUrl.trim(), accessToken: token.trim() })
  }

  return (
    <div className="h-dvh flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-200/50">
            <span className="text-3xl">🎁</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">GiftAI</h1>
          <p className="text-gray-500 mt-2">Voice-First Gift Shopping</p>
        </div>

        <div className="space-y-4 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleConnect}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
          >
            Connect Store
          </button>
        </div>
      </div>
    </div>
  )
}
