'use client'

/**
 * GiftAI — Voice-First Gift Shopping
 * HALO Design System Integration
 *
 * Two-mode layout:
 *
 *   PRE-CHAT (0 messages):
 *   ┌──────────────────────────────┐
 *   │ Branding + Theme Toggle      │
 *   │                              │
 *   │      ● 3D Orb (large)       │
 *   │      ✨ ShiningText         │
 *   │      Headline + Subtext      │
 *   │                              │
 *   │   [PromptCarousel]           │
 *   │   [AIInput + Voice]          │
 *   └──────────────────────────────┘
 *
 *   CHAT MODE (1+ messages):
 *   ┌──────────────────────────────┐
 *   │ Header (GiftAI + Cart badge) │
 *   ├──────────────────────────────┤
 *   │   CHAT FLOW (scrollable)     │
 *   │   ● AI messages              │
 *   │   [User bubbles]             │
 *   │   [Product cards inline]     │
 *   │   [Cart widgets inline]      │
 *   ├──────────────────────────────┤
 *   │   Suggestion Chips           │
 *   ├──────────────────────────────┤
 *   │   [AIInput + Voice]          │
 *   └──────────────────────────────┘
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { VoiceProvider, useVoice } from '@/components/VoiceProvider'
import { ChatMessage, ChatProductCard, ProductDetailPanel, InlineCartWidget, CheckoutModal, ThinkingIndicator } from '@/components/chat'
import VoiceControls from '@/components/VoiceControls'
import StoreSwapModal from '@/components/StoreSwapModal'
import Orb from '@/components/Orb'
import Orb3D from '@/components/Orb3D'
import { PromptCarousel } from '@/components/PromptCarousel'
import { AIInput } from '@/components/ui/ai-input'
import { ShiningText } from '@/components/ui/shining-text'
import { useOrbAudio } from '@/hooks/useOrbAudio'
import { cn } from '@/lib/utils'
import { AnimatePresence } from 'framer-motion'
import type { StoreCredentials, ProductDetail, VariantDetail, ChatMessage as ChatMessageType } from '@/types'
import { ShoppingBag, ArrowRightLeft, ChevronLeft, ChevronRight, Globe, Store, Sun, Moon } from 'lucide-react'

export type SearchMode = 'global' | 'storefront'
type Theme = 'light' | 'dark'

// ═══════════════════════════════════════════
// Main Page (with store credentials)
// ═══════════════════════════════════════════

export default function Home() {
  const [storeCredentials, setStoreCredentials] = useState<StoreCredentials>({
    storeUrl: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
    accessToken: process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN || '',
  })
  const [isConnected, setIsConnected] = useState(false)
  const [searchMode, setSearchMode] = useState<SearchMode>('storefront')

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
    <VoiceProvider storeCredentials={storeCredentials} searchMode={searchMode}>
      <GiftAIApp
        storeCredentials={storeCredentials}
        onStoreChange={(creds) => {
          setStoreCredentials(creds)
        }}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
      />
    </VoiceProvider>
  )
}

// ═══════════════════════════════════════════
// Theme Hook (HALO pattern)
// ═══════════════════════════════════════════

function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('halo-theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
    }
  }, [])

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('halo-theme', next)
  }, [theme])

  return { theme, isDark: theme === 'dark', toggleTheme }
}

// ═══════════════════════════════════════════
// Main App — Two-Mode Layout
// ═══════════════════════════════════════════

function GiftAIApp({
  storeCredentials,
  onStoreChange,
  searchMode,
  onSearchModeChange,
}: {
  storeCredentials: StoreCredentials
  onStoreChange: (creds: StoreCredentials) => void
  searchMode: SearchMode
  onSearchModeChange: (mode: SearchMode) => void
}) {
  const voice = useVoice()
  const { theme, isDark, toggleTheme } = useTheme()
  const orbAudio = useOrbAudio()
  const [storeSwapOpen, setStoreSwapOpen] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [detailProduct, setDetailProduct] = useState<ProductDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const isPreChat = voice.messages.length === 0

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [voice.messages.length, voice.products.length, voice.cartState])

  // ── Contextual suggestions ──
  const suggestions = useMemo(() => {
    if (voice.products.length > 0) {
      return [
        { label: 'Add first one', action: 'add_first' },
        { label: 'Tell me more', action: 'tell_more' },
        { label: 'Cheaper options', action: 'cheaper' },
        { label: 'More options', action: 'more' },
      ]
    }
    if (voice.cartState && voice.cartState.totalQuantity > 0) {
      return [
        { label: 'Checkout', action: 'checkout' },
        { label: 'Keep shopping', action: 'keep_shopping' },
      ]
    }
    if (voice.messages.length <= 1 && voice.messages.length > 0) {
      return [
        { label: "Valentine's gifts", action: 'search_valentines' },
        { label: 'Birthday ideas', action: 'search_birthday' },
        { label: 'Wedding gifts', action: 'search_wedding' },
        { label: 'Show everything', action: 'search_all' },
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
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setTextInput('')
      await voice.sendTextMessage(trimmed)
    },
    [voice],
  )

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      await handleSubmit(textInput)
    },
    [textInput, handleSubmit],
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

    if (!productsInserted && voice.products.length > 0) {
      items.push({ type: 'products', data: voice.products, key: 'products-end' })
    }

    if (!cartInserted && voice.cartState && voice.cartState.totalQuantity > 0) {
      items.push({ type: 'cart', data: voice.cartState, key: 'cart-end' })
    }

    return items
  }, [voice.messages, voice.products, voice.cartState])

  // Voice orb toggle
  const handleOrbToggle = useCallback(() => {
    if (voice.voiceState === 'disconnected') {
      voice.connectVoice()
    } else if (voice.voiceConnected) {
      voice.toggleMic()
    }
  }, [voice])

  // ═══════════════════════════════════════════
  // PRE-CHAT MODE
  // ═══════════════════════════════════════════

  if (isPreChat) {
    return (
      <div
        className={cn(
          "flex flex-col items-center h-[100dvh] w-screen font-sans overflow-hidden relative",
          "transition-colors duration-700 ease-halo",
        )}
        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      >
        {/* Dither Noise Overlay */}
        <div className="dither-noise-overlay" />

        {/* Top Bar: Branding + Theme Toggle */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-5 md:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2">
          <div className="flex items-center gap-2 sm:gap-3 select-none pointer-events-none">
            <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-[var(--muted-foreground)] leading-tight">
              GiftAI · Voice Shopping
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              "relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center",
              "border border-[var(--border)] bg-[var(--muted)]/30",
              "cursor-pointer select-none",
              "transition-all duration-300 ease-halo",
              "hover:border-[var(--accent)]",
            )}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            <Sun className={cn(
              "w-4 h-4 absolute text-[var(--foreground)] transition-all duration-300",
              isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"
            )} />
            <Moon className={cn(
              "w-4 h-4 absolute text-[var(--foreground)] transition-all duration-300",
              !isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
            )} />
          </button>
        </div>

        {/* Background Glow */}
        <div className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-colors duration-700",
          "w-[60vmin] h-[60vmin] max-w-[350px] max-h-[350px] blur-[60px] sm:blur-[80px] md:blur-[90px]",
          isDark ? "bg-[var(--cream)]/5" : "bg-olive/10"
        )} />

        {/* Upper Spacer */}
        <div className="flex-[1] min-h-[3rem] sm:min-h-[3.5rem]" />

        {/* Main Center Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-5 sm:px-6 max-w-3xl mx-auto opacity-100 scale-100">
          {/* 3D Orb */}
          <div
            className="relative rounded-full cursor-pointer transition-transform duration-300 ease-halo hover:scale-105 active:scale-95 group mx-auto w-[clamp(7rem,26vmin,11.5rem)] h-[clamp(7rem,26vmin,11.5rem)]"
            onClick={handleOrbToggle}
          >
            <div className={cn(
              "absolute inset-0 rounded-full transition-all duration-700",
              isDark
                ? "shadow-[0_0_40px_rgba(163,189,106,0.3),inset_0_0_20px_rgba(251,253,226,0.1)]"
                : "shadow-[0_0_50px_rgba(96,108,72,0.2),inset_0_0_20px_rgba(255,255,255,0.3)]"
            )} />
            <div className="w-full h-full rounded-full overflow-hidden relative">
              <Orb3D getFrequency={orbAudio.getFrequencyData} getAmplitude={orbAudio.getAmplitude} className="blur-[1.2px] scale-[1.45]" />
            </div>
          </div>

          {/* Status Text */}
          <div className="mt-5 sm:mt-7 md:mt-9 min-h-[1.25rem] w-full flex justify-center">
            <AnimatePresence mode="wait">
              <ShiningText
                key={voice.voiceState === 'listening' ? 'Listening...' : 'Tap to start'}
                text={voice.voiceState === 'listening' ? 'Listening...' : 'Tap to start'}
                className="tracking-[0.2em] uppercase text-[9px] sm:text-[10px] md:text-xs font-normal"
              />
            </AnimatePresence>
          </div>

          {/* Headline + Subtext */}
          <div className="flex flex-col items-center text-center w-full mt-3 sm:mt-5 md:mt-6 space-y-1.5 sm:space-y-2.5 md:space-y-3">
            <h2 className={cn(
              "font-medium tracking-tight bg-clip-text text-transparent w-full text-center",
              "text-[clamp(1.375rem,5.5vw,2rem)] leading-[1.15]",
              "bg-gradient-to-br",
              "from-[var(--foreground)] via-[var(--foreground)]/70 to-[var(--foreground)]/50"
            )}>
              GiftAI, your AI shopping assistant
            </h2>
            <p className="font-normal text-[var(--muted-foreground)] tracking-tight w-full text-center text-[clamp(0.8125rem,2.5vw,1rem)]">
              helps discover the right gifts for any occasion
            </p>
          </div>
        </div>

        {/* Lower Spacer */}
        <div className="flex-[0.8] min-h-[1rem] sm:min-h-[1.5rem]" />

        {/* Bottom Area: Carousel + Input */}
        <div className={cn(
          "w-full z-50 flex flex-col items-center",
          "gap-2.5 sm:gap-3 md:gap-4",
          "pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] sm:pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]"
        )}>
          <PromptCarousel onSelect={(prompt) => handleSubmit(prompt)} className="w-full" />

          <div className="w-full max-w-xl mx-auto px-4 sm:px-5 md:px-6 flex flex-col items-center">
            <AIInput
              onSubmit={handleSubmit}
              onMicClick={handleOrbToggle}
              placeholder="What gift are you looking for?"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={voice.isTextLoading}
              className="bg-transparent py-0"
            />
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // CHAT MODE
  // ═══════════════════════════════════════════

  return (
    <div className="h-dvh flex flex-col overflow-hidden font-sans" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Dither Noise Overlay */}
      <div className="dither-noise-overlay" />

      {/* ── Header ────────────────────────────── */}
      <header className="flex-shrink-0 px-4 py-3 bg-[var(--card)] border-b border-[var(--border)] relative z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Logo + Orb */}
          <div className="flex items-center gap-3">
            <Orb state={voice.voiceState} size="sm" />
            <div>
              <h1 className="text-lg font-bold text-[var(--card-foreground)]">GiftAI</h1>
              <p className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[180px] font-mono">
                {storeCredentials.storeUrl}
              </p>
            </div>
          </div>

          {/* Center: Search mode toggle — HALO styled */}
          <div className="flex items-center bg-[var(--muted)]/30 rounded-[var(--radius)] p-0.5">
            <button
              onClick={() => onSearchModeChange('storefront')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-all',
                searchMode === 'storefront'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              )}
            >
              <Store size={13} />
              <span className="hidden sm:inline">Our Store</span>
            </button>
            <button
              onClick={() => onSearchModeChange('global')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium transition-all',
                searchMode === 'global'
                  ? 'bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              )}
            >
              <Globe size={13} />
              <span className="hidden sm:inline">All Shopify</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? (
                <Sun size={18} className="text-[var(--muted-foreground)]" />
              ) : (
                <Moon size={18} className="text-[var(--muted-foreground)]" />
              )}
            </button>
            <button
              onClick={() => setStoreSwapOpen(true)}
              className="p-2 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
              title="Switch store"
            >
              <ArrowRightLeft size={18} className="text-[var(--muted-foreground)]" />
            </button>
            <button
              onClick={() => {
                if (voice.cartState?.checkoutUrl) {
                  setCheckoutOpen(true)
                }
              }}
              className="relative p-2 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
              title="Cart"
            >
              <ShoppingBag size={20} className="text-[var(--foreground)]" />
              {cartBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--brand)] text-[var(--brand-foreground)] text-[10px] font-bold rounded-full flex items-center justify-center">
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

          {voice.isTextLoading && <ThinkingIndicator />}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Suggestion Chips — HALO styled ──────── */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-[var(--border)] bg-[var(--card)]">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {suggestions.map((s) => (
              <button
                key={s.action}
                onClick={() => handleSuggestion(s.action)}
                className="flex-shrink-0 px-3.5 py-1.5 text-xs font-mono uppercase tracking-[0.1em] bg-[var(--muted)]/20 hover:bg-[var(--muted)]/40 border border-[var(--border)] rounded-[var(--radius)] transition-colors text-[var(--foreground)]"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input + Voice ─────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 bg-[var(--card)] border-t border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <AIInput
              onSubmit={handleSubmit}
              onMicClick={handleOrbToggle}
              value={textInput}
              onValueChange={setTextInput}
              placeholder="What are you looking for?"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={voice.isTextLoading}
              className="py-0"
            />
          </div>
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

      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 bg-[var(--card)] shadow-md rounded-full flex items-center justify-center hover:bg-[var(--muted)]/30 transition-colors z-10 border border-[var(--border)]"
        >
          <ChevronLeft size={16} className="text-[var(--foreground)]" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 bg-[var(--card)] shadow-md rounded-full flex items-center justify-center hover:bg-[var(--muted)]/30 transition-colors z-10 border border-[var(--border)]"
        >
          <ChevronRight size={16} className="text-[var(--foreground)]" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Connect Screen — HALO styled
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
    <div className="h-dvh flex items-center justify-center font-sans" style={{ backgroundColor: 'var(--background)' }}>
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-olive to-forest flex items-center justify-center shadow-lg shadow-olive/20">
            <span className="text-3xl">🎁</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">GiftAI</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Voice-First Gift Shopping</p>
        </div>

        <div className="space-y-4 bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] p-6 shadow-sm">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-4 py-3 bg-transparent border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full px-4 py-3 bg-transparent border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>
          {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
          <button
            onClick={handleConnect}
            className="w-full py-3 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium transition-all"
          >
            Connect Store
          </button>
        </div>
      </div>
    </div>
  )
}
