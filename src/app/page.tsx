'use client'

/**
 * GiftAI — Voice-First Gift Shopping
 * Built on orbdesign's App.tsx layout (HALO Design System)
 *
 * Architecture (per Jai's constraint):
 *   - orbdesign IS the base layout — its components are ported AS-IS
 *   - isOrbMinimized = false: Big Orb centered, headline, PromptCarousel
 *   - isOrbMinimized = true: Orb minimizes into AIInput, center area → chat
 *   - Chat components are layered INTO the space where the Orb/headline faded out
 *   - VoiceProvider state drives everything
 *
 *   ┌──────────────────────────────┐
 *   │ Top Bar (branding/theme)     │
 *   ├──────────────────────────────┤
 *   │                              │
 *   │  if !minimized:              │
 *   │    ● 3D Orb (large)         │  ← orbdesign (fades out)
 *   │    ✨ ShiningText           │
 *   │    Headline + Subtext        │
 *   │                              │
 *   │  if minimized:               │
 *   │    CHAT FLOW (scrollable)    │  ← GiftAI chat layer
 *   │    ● AI messages             │
 *   │    [Product cards]           │
 *   │    [Cart widgets]            │
 *   │                              │
 *   ├──────────────────────────────┤
 *   │  PromptCarousel (if !min)    │  ← orbdesign (hides when minimized)
 *   │  Status indicator            │
 *   │  AIInput + minimized orb     │  ← orbdesign (always visible)
 *   └──────────────────────────────┘
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { VoiceProvider, useVoice } from '@/components/VoiceProvider'
import { ChatMessage, ChatProductCard, ProductDetailPanel, InlineCartWidget, CheckoutModal, ThinkingIndicator, ExpressCheckoutSheet, SaveProfilePrompt, BuyerVaultModal } from '@/components/chat'
// StoreSwapModal removed — OMI defaults to global mode
import Orb3D from '@/components/Orb3D'
import { PromptCarousel } from '@/components/PromptCarousel'
import { AIInput } from '@/components/ui/ai-input'
import { ShiningText } from '@/components/ui/shining-text'
import { useOrbAudio } from '@/hooks/useOrbAudio'
import { cn } from '@/lib/utils'
import { AnimatePresence } from 'framer-motion'
import type { StoreCredentials, ProductDetail, VariantDetail } from '@/types'
import { ShoppingBag, ChevronLeft, ChevronRight, MicOff, Shield } from 'lucide-react'

export type SearchMode = 'global' | 'storefront'
type Theme = 'light' | 'dark'

// ═══════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════

export default function Home() {
  const [storeCredentials, setStoreCredentials] = useState<StoreCredentials>({
    storeUrl: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
    accessToken: process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN || '',
  })
  // Skip ConnectScreen entirely — always auto-connect in global mode
  const [isConnected, setIsConnected] = useState(true)
  const [searchMode, setSearchMode] = useState<SearchMode>('global')

  if (!isConnected) {
    return <ConnectScreen onConnect={(creds) => { setStoreCredentials(creds); setIsConnected(true) }} />
  }

  return (
    <VoiceProvider storeCredentials={storeCredentials} searchMode={searchMode}>
      <GiftAIApp
        storeCredentials={storeCredentials}
        onStoreChange={setStoreCredentials}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
      />
    </VoiceProvider>
  )
}

// ═══════════════════════════════════════════
// GiftAI App — orbdesign layout + chat layer
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

  // ── orbdesign state (exact same pattern) ──
  const { mode, startMic, startSim, stopAll, getFrequencyData, getAmplitude } = useOrbAudio()
  const [theme, setTheme] = useState<Theme>('dark')
  const [isOrbMinimized, setIsOrbMinimized] = useState(false)
  const isDarkMode = theme === 'dark'

  // ── GiftAI state ──
  // storeSwapOpen removed — OMI defaults to global
  const [detailProduct, setDetailProduct] = useState<ProductDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [hasVaultData, setHasVaultData] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Streaming welcome message while agent connects ──
  const WELCOME_TEXT = "Search for products across 5 million+ global Shopify stores. Live AI is kicking off..."
  const [welcomeText, setWelcomeText] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)
  const welcomeStartedRef = useRef(false)
  const welcomeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start typewriter when orb minimizes and no real messages yet
  // Uses a ref (not state) for the "started" flag to avoid re-triggering the effect
  useEffect(() => {
    if (isOrbMinimized && voice.messages.length === 0 && !welcomeStartedRef.current) {
      welcomeStartedRef.current = true
      setShowWelcome(true)
      let i = 0
      welcomeTimerRef.current = setInterval(() => {
        i++
        if (i <= WELCOME_TEXT.length) {
          setWelcomeText(WELCOME_TEXT.slice(0, i))
        } else {
          if (welcomeTimerRef.current) clearInterval(welcomeTimerRef.current)
        }
      }, 25)
    }
  }, [isOrbMinimized, voice.messages.length])

  // Hide welcome when real agent messages arrive
  useEffect(() => {
    if (voice.messages.length > 0 && showWelcome) {
      setShowWelcome(false)
      welcomeStartedRef.current = false
      if (welcomeTimerRef.current) {
        clearInterval(welcomeTimerRef.current)
        welcomeTimerRef.current = null
      }
    }
  }, [voice.messages.length, showWelcome])

  // Cleanup interval on unmount only
  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current) clearInterval(welcomeTimerRef.current)
    }
  }, [])

  // Trigger isOrbMinimized when first message arrives
  useEffect(() => {
    if (voice.messages.length > 0 && !isOrbMinimized) {
      setIsOrbMinimized(true)
    }
  }, [voice.messages.length, isOrbMinimized])

  // Auto-scroll chat
  useEffect(() => {
    if (isOrbMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [voice.messages.length, voice.products.length, voice.cartState, isOrbMinimized])

  // ── orbdesign theme persistence (exact same) ──
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

  // ── Check vault on mount ──
  useEffect(() => {
    fetch('/api/vault')
      .then((r) => r.json())
      .then((data) => setHasVaultData(!!data.profile))
      .catch(() => {})
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('halo-theme', next)
  }, [theme])

  // ── orbdesign mic toggle (exact same) ──
  const handleToggle = useCallback(() => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50)
    }
    // Instant audio chime (880Hz, 150ms)
    try {
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = actx.createOscillator()
      const gain = actx.createGain()
      osc.connect(gain)
      gain.connect(actx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.12, actx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15)
      osc.start(actx.currentTime)
      osc.stop(actx.currentTime + 0.15)
    } catch {}

    if (mode === 'IDLE') {
      // Same transition as first text message — orb fades into input bar
      if (!isOrbMinimized) {
        setIsOrbMinimized(true)
      }
      startMic()
      // Also connect voice if disconnected
      if (voice.voiceState === 'disconnected') {
        voice.connectVoice()
      } else if (voice.voiceConnected && !voice.micEnabled) {
        voice.toggleMic()
      }
    } else {
      stopAll()
      if (voice.voiceConnected && voice.micEnabled) {
        voice.toggleMic()
      }
    }
  }, [mode, startMic, stopAll, voice, isOrbMinimized])

  // ── Submit handler — triggers isOrbMinimized via orbdesign pattern ──
  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return

    // orbdesign pattern: minimize on first submit
    if (!isOrbMinimized) {
      setIsOrbMinimized(true)
    }

    // Start sim for visual feedback while waiting
    startSim()

    // Send message through VoiceProvider
    await voice.sendTextMessage(trimmed)

    // Stop sim after response received (prevents lingering "Speaking" status)
    stopAll()
  }, [isOrbMinimized, startSim, stopAll, voice])

  const handlePromptSelect = useCallback((prompt: string) => {
    handleSubmit(prompt)
  }, [handleSubmit])

  // ── orbdesign status text — synced with actual voice state ──
  const statusText = useMemo(() => {
    if (voice.voiceState === 'speaking') return 'Speaking...'
    if (voice.voiceState === 'thinking') return 'Thinking...'
    // Don't show "Listening" when mic is muted
    if ((voice.voiceState === 'listening' || mode === 'MIC') && voice.micEnabled) return 'Listening...'
    if (voice.voiceConnecting) return 'Connecting...'
    if (mode === 'SIM') return 'Processing...'
    if (voice.voiceConnected && !voice.micEnabled) return 'Tap to start'
    return 'Tap to start'
  }, [voice.voiceState, voice.voiceConnecting, voice.voiceConnected, voice.micEnabled, mode])

  // ── Active status message (above input bar) ──
  let activeStatusMessage: string | null = null
  if (voice.isTextLoading) {
    activeStatusMessage = 'Omi is Thinking'
  } else if (voice.voiceState === 'speaking') {
    activeStatusMessage = 'Omi is Speaking'
  } else if (voice.voiceState === 'thinking') {
    activeStatusMessage = 'Omi is Thinking'
  } else if ((voice.voiceState === 'listening' || mode === 'MIC') && voice.micEnabled) {
    // Only show "Listening" when mic is actually enabled
    activeStatusMessage = 'Omi is Listening'
  } else if (mode === 'SIM') {
    activeStatusMessage = 'Omi is Processing'
  } else if (isOrbMinimized && voice.voiceConnected && !voice.micEnabled) {
    activeStatusMessage = null // No "Listening" status when mic is muted
  } else if (isOrbMinimized && voice.voiceConnected) {
    activeStatusMessage = 'Omi is Ready'
  } else if (isOrbMinimized) {
    activeStatusMessage = null // No status in text-only mode when idle
  }

  // ── orbdesign active mic icon (exact same) ──
  const activeMicIcon = (
    <div className={cn(
      "flex items-center gap-1 sm:gap-1.5 px-1 transition-all duration-300",
      isOrbMinimized && "drop-shadow-[0_0_8px_rgba(251,253,226,0.8)]"
    )}>
      {[
        "animate-[pulse_1s_ease-in-out_infinite]",
        "animate-[pulse_1.2s_ease-in-out_infinite_0.1s]",
        "animate-[pulse_0.8s_ease-in-out_infinite_0.2s]"
      ].map((anim, i) => (
        <div key={i} className={cn(
          "w-0.5 sm:w-1 rounded-full",
          i === 1 ? "h-4 sm:h-5" : "h-2.5 sm:h-3",
          anim,
          isOrbMinimized
            ? "bg-cream"
            : "bg-foreground opacity-70"
        )} />
      ))}
    </div>
  )

  // ── Product actions ──
  const handleProductClick = useCallback((product: ProductDetail) => {
    setDetailProduct(product)
    setDetailOpen(true)
  }, [])

  const handleAddToCart = useCallback(
    (product: ProductDetail, variant?: VariantDetail) => {
      // For global products with checkout URL, open directly
      if (product.isGlobal && product.directCheckoutUrl) {
        window.open(product.directCheckoutUrl, '_blank')
        return
      }
      const msg = variant && variant.name !== 'Default Title'
        ? `Add ${product.title} (${variant.name}) to my cart`
        : `Add ${product.title} to my cart`
      voice.sendTextMessage(msg)
    },
    [voice],
  )

  const handleBuyNow = useCallback(
    (product: ProductDetail, variant?: VariantDetail) => {
      // For global products with checkout URL, open directly
      if (product.isGlobal && product.directCheckoutUrl) {
        window.open(product.directCheckoutUrl, '_blank')
        return
      }
      const msg = variant && variant.name !== 'Default Title'
        ? `I want to buy ${product.title} (${variant.name})`
        : `I want to buy ${product.title}`
      voice.sendTextMessage(msg)
    },
    [voice],
  )

  const handleExpressCheckout = useCallback(
    (product: ProductDetail, variant?: VariantDetail) => {
      voice.openExpressCheckout(product, variant)
    },
    [voice],
  )

  // ── Contextual suggestion chips (for chat mode) ──
  // Uses agent-provided suggestions if available, otherwise generates smart defaults.
  const chatSuggestions = useMemo(() => {
    if (!isOrbMinimized) return []

    // Prefer agent-provided dynamic suggestions
    if (voice.agentSuggestions.length > 0) {
      return voice.agentSuggestions
    }

    // Fallback: generate context-aware suggestions
    if (voice.products.length > 0) {
      const firstProduct = voice.products[0]
      const secondProduct = voice.products[1]
      const hasCheckout = firstProduct?.directCheckoutUrl

      // Dynamic chips based on actual product context
      const chips: Array<{ label: string; text: string }> = []

      if (hasCheckout) {
        chips.push({ label: `Checkout ${firstProduct.title?.split(' ').slice(0, 3).join(' ') || 'first one'}`, text: `I want to buy ${firstProduct?.title || 'the first one'}` })
      } else {
        chips.push({ label: 'Buy first one', text: `I want to buy ${firstProduct?.title || 'the first one'}` })
      }

      if (secondProduct) {
        chips.push({ label: `Compare options`, text: `Compare ${firstProduct?.title?.split(' ').slice(0, 2).join(' ')} and ${secondProduct?.title?.split(' ').slice(0, 2).join(' ')}` })
      } else {
        chips.push({ label: 'Tell me more', text: `Tell me more about ${firstProduct?.title || 'this product'}` })
      }

      chips.push({ label: 'Different style', text: 'Show me something in a different style' })
      chips.push({ label: 'Under $30', text: 'Show me options under $30' })

      return chips
    }

    if (voice.cartState && voice.cartState.totalQuantity > 0) {
      return [
        { label: 'Checkout now', text: 'I\'m ready to checkout' },
        { label: 'Add more gifts', text: 'Show me more gifts to add' },
        { label: 'Gift wrap?', text: 'Do you have gift wrapping options?' },
      ]
    }

    return []
  }, [isOrbMinimized, voice.products, voice.cartState, voice.agentSuggestions])

  // ── Interleave messages with product cards + cart ──
  const chatItems = useMemo(() => {
    const items: Array<{ type: 'message' | 'products' | 'cart'; data: any; key: string }> = []
    let cartInserted = false
    let lastShownProductIds = new Set<number>()

    for (const msg of voice.messages) {
      items.push({ type: 'message', data: msg, key: `msg-${msg.id}` })

      // Show product cards for EVERY assistant message that has products attached
      if (msg.role === 'assistant' && msg.products?.length) {
        items.push({ type: 'products', data: msg.products, key: `products-${msg.id}` })
        lastShownProductIds = new Set(msg.products.map((p: any) => p.productId))
      }

      if (!cartInserted && msg.role === 'assistant' && (msg.cartState || voice.cartState) &&
        (voice.cartState?.totalQuantity ?? 0) > 0 &&
        (msg.content.toLowerCase().includes('cart') || msg.content.toLowerCase().includes('added') ||
         msg.content.toLowerCase().includes('checkout'))) {
        items.push({ type: 'cart', data: msg.cartState || voice.cartState, key: `cart-${msg.id}` })
        cartInserted = true
      }
    }

    // Fallback: show voice.products at end if they differ from the last shown set
    // This catches cases where Gemini returned products but they weren't attached to msg.products
    if (voice.products.length > 0) {
      const currentProductIds = new Set(voice.products.map(p => p.productId))
      const isDifferent = voice.products.some(p => !lastShownProductIds.has(p.productId))
      if (isDifferent || lastShownProductIds.size === 0) {
        items.push({ type: 'products', data: voice.products, key: `products-latest-${voice.products[0]?.productId}` })
      }
    }
    if (!cartInserted && voice.cartState && voice.cartState.totalQuantity > 0) {
      items.push({ type: 'cart', data: voice.cartState, key: 'cart-end' })
    }
    return items
  }, [voice.messages, voice.products, voice.cartState])

  const cartBadge = voice.cartState?.totalQuantity || 0

  // ═══════════════════════════════════════════
  // RENDER — orbdesign's App.tsx layout (exact)
  // with chat layer in center when minimized
  // ═══════════════════════════════════════════

  return (
    <div
      className={cn(
        "flex flex-col items-center h-[100dvh] w-screen font-sans overflow-hidden relative",
        "transition-colors duration-700 ease-halo",
        isDarkMode ? "dark" : ""
      )}
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* ── Dither Noise Overlay (orbdesign) ──────────── */}
      <div className="dither-noise-overlay" />

      {/* ── Top Bar (OMI branding + controls) ──────── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-5 md:px-6 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-2">
        {/* Left: spacer (branding removed per Jai) */}
        <div className="flex items-center gap-2 sm:gap-3 select-none pointer-events-none" />

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Voice/Text toggle + Cart (only when chat is active) */}
          {isOrbMinimized && (
            <>
              {/* Buyer Vault */}
              <button
                onClick={() => setVaultOpen(true)}
                className="relative p-1.5 rounded-[var(--radius)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Buyer Vault"
              >
                <Shield size={16} className="text-[var(--foreground)]" />
                {hasVaultData && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-[var(--background)]" />
                )}
              </button>

              {/* Cart */}
              <button
                onClick={() => setCheckoutOpen(true)}
                className="relative p-1.5 rounded-[var(--radius)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Cart"
              >
                <ShoppingBag size={16} className="text-[var(--foreground)]" />
                {cartBadge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--brand)] text-[var(--brand-foreground)] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {cartBadge}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Theme Toggle (orbdesign exact) */}
          <button
            onClick={toggleTheme}
            className={cn(
              "relative w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center",
              "border border-[var(--border)] bg-[var(--muted)]",
              "cursor-pointer select-none",
              "transition-all duration-300 ease-halo",
              "hover:border-[var(--accent)]",
              "focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
            )}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"
              className={cn("w-4 h-4 absolute text-[var(--foreground)] transition-all duration-300",
                isDarkMode ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"
              )} fill="currentColor">
              <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"
              className={cn("w-4 h-4 absolute text-[var(--foreground)] transition-all duration-300",
                !isDarkMode ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
              )} fill="currentColor">
              <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.36A88,88,0,0,1,65.64,67.09,89,89,0,0,1,81.2,40.42C81.73,91.69,121.28,132.59,172,136.48a88.83,88.83,0,0,1-3.19,9.79,8,8,0,0,0,4.79,10.25A89.43,89.43,0,0,1,188.9,190.36Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Background Glow (orbdesign exact) ────────── */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-colors duration-700",
        "w-[60vmin] h-[60vmin] max-w-[350px] max-h-[350px] blur-[60px] sm:blur-[80px] md:blur-[90px]",
        isDarkMode ? "bg-[var(--cream)]/5" : "bg-olive/10"
      )} />

      {/* ── Upper Spacer (orbdesign exact — only when orb is showing) ── */}
      {!isOrbMinimized && <div className="flex-[1] min-h-[3rem] sm:min-h-[3.5rem]" />}

      {/* ══════════════════════════════════════════════════
          CENTER AREA — This is where the magic happens.

          NOT minimized → orbdesign's Orb + headline (fades out)
          minimized → GiftAI chat flow (fades in)
      ══════════════════════════════════════════════════ */}

      {/* orbdesign center content (fades out when minimized) */}
      <div className={cn(
        "relative z-10 flex flex-col items-center justify-center w-full px-5 sm:px-6",
        "transition-all duration-700 ease-halo",
        "max-w-3xl mx-auto",
        isOrbMinimized ? "opacity-0 scale-95 translate-y-10 pointer-events-none absolute" : "opacity-100 scale-100"
      )}>
        {/* Orb (orbdesign exact) */}
        <div
          className="relative rounded-full cursor-pointer transition-transform duration-300 ease-halo hover:scale-105 active:scale-95 group mx-auto w-[clamp(7rem,26vmin,11.5rem)] h-[clamp(7rem,26vmin,11.5rem)]"
          onClick={handleToggle}
        >
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-700",
            isDarkMode
              ? "shadow-[0_0_40px_rgba(163,189,106,0.3),inset_0_0_20px_rgba(251,253,226,0.1)]"
              : "shadow-[0_0_50px_rgba(96,108,72,0.2),inset_0_0_20px_rgba(255,255,255,0.3)]"
          )} />
          <div className="w-full h-full rounded-full overflow-hidden relative">
            <Orb3D getFrequency={getFrequencyData} getAmplitude={getAmplitude} className="blur-[1.2px] scale-[1.45]" />
          </div>
        </div>

        {/* TAP TO START */}
        <div className="mt-5 sm:mt-7 md:mt-9 min-h-[1.25rem] flex items-center justify-center">
          {mode === 'IDLE' && (
            <p
              className={cn(
                "text-xs font-medium tracking-[0.25em] uppercase cursor-pointer transition-opacity duration-500",
                isDarkMode ? "text-white/40" : "text-[var(--muted)]"
              )}
              onClick={handleToggle}
            >
              Tap to start
            </p>
          )}
        </div>

        {/* Headline + Subtext (OMI branding) */}
        <div className="flex flex-col items-center text-center w-full mt-3 sm:mt-5 md:mt-6 space-y-1.5 sm:space-y-2.5 md:space-y-3">
          <h2 className={cn(
            "font-medium tracking-tight bg-clip-text text-transparent w-full text-center",
            "text-[clamp(1.375rem,5.5vw,2rem)] leading-[1.15]",
            "bg-gradient-to-br",
            "from-[var(--foreground)] via-[var(--foreground)]/70 to-[var(--foreground)]/50"
          )}>
            OMI, your AI shopping homie
          </h2>
          <p className="font-normal text-[var(--muted-foreground)] tracking-tight w-full text-center text-[clamp(0.8125rem,2.5vw,1rem)]">
            helps discover unique gifts for any occasion
          </p>
        </div>
      </div>

      {/* ── CHAT FLOW (appears when minimized) ────────── */}
      {isOrbMinimized && (
        <div className={cn(
          "relative z-10 flex-1 min-h-0 w-full flex flex-col",
          "transition-all duration-700 ease-halo",
          "animate-[fadeIn_0.5s_ease-out]"
        )}>
          {/* Scrollable chat area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="max-w-4xl mx-auto px-4 pt-14 pb-4 space-y-1">
              {/* Streaming welcome message while agent connects */}
              {showWelcome && welcomeText && (
                <ChatMessage
                  key="welcome-connecting"
                  message={{
                    id: 'welcome-connecting',
                    role: 'assistant',
                    content: welcomeText,
                    timestamp: Date.now(),
                    source: 'system',
                    streaming: true,
                  }}
                />
              )}
              {chatItems.map((item) => {
                if (item.type === 'message') {
                  return <ChatMessage key={item.key} message={item.data} />
                }
                if (item.type === 'products') {
                  return (
                    <div key={item.key} className="py-3 overflow-visible">
                      <ProductCarouselInline
                        products={item.data as ProductDetail[]}
                        onProductClick={handleProductClick}
                        onAddToCart={handleAddToCart}
                        onBuyNow={handleBuyNow}
                        onExpressCheckout={handleExpressCheckout}
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
                        onExpressCheckout={() => {
                          // Open express checkout with the first cart item's product info
                          const firstLine = (item.data as any)?.lines?.[0]
                          if (firstLine) {
                            voice.openExpressCheckout({
                              productId: 0,
                              title: firstLine.productTitle,
                              descriptionHtml: '',
                              vendor: '',
                              productType: '',
                              tags: [],
                              status: 'active',
                              handle: '',
                              images: firstLine.imageUrl ? [firstLine.imageUrl] : [],
                              variants: [],
                              priceRange: firstLine.price,
                              totalStock: 1,
                              hasDiscount: false,
                            })
                          }
                        }}
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

          {/* Suggestion chips — single-line scrollable row above input */}
          {chatSuggestions.length > 0 && (
            <div className="flex-shrink-0 w-full max-w-4xl mx-auto px-4 py-1.5">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {chatSuggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSubmit(s.text)}
                    className="flex-shrink-0 px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.12em] border border-[var(--border)] rounded-[var(--radius)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--accent)] hover:translate-y-[-1px] active:translate-y-0 transition-all duration-200 ease-halo whitespace-nowrap"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lower Spacer (orbdesign exact) ───────────── */}
      {!isOrbMinimized && <div className="flex-[0.8] min-h-[1rem] sm:min-h-[1.5rem]" />}

      {/* ── Bottom Area: Carousel + Input (orbdesign exact) ── */}
      <div className={cn(
        "w-full z-50 flex flex-col items-center",
        "gap-2.5 sm:gap-3 md:gap-4",
        "pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] sm:pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] md:pb-[max(env(safe-area-inset-bottom,0px),1.25rem)]"
      )}>
        {/* Prompt Carousel (orbdesign: hidden when minimized) */}
        {!isOrbMinimized && (
          <PromptCarousel onSelect={handlePromptSelect} className="w-full" />
        )}

        {/* Input Container (orbdesign exact) */}
        <div className="w-full max-w-xl mx-auto px-4 sm:px-5 md:px-6 flex flex-col items-center">
          {/* Active Status Indicator (orbdesign exact) */}
          <div className="h-5 sm:h-6 mb-0.5 flex justify-center w-full">
            <AnimatePresence mode="wait">
              {activeStatusMessage && (
                <ShiningText key={activeStatusMessage} text={activeStatusMessage} />
              )}
            </AnimatePresence>
          </div>

          <AIInput
            onSubmit={handleSubmit}
            onMicClick={handleToggle}
            placeholder="What gift are you looking for?"
            micIcon={
              voice.voiceConnected && voice.micEnabled ? activeMicIcon :
              voice.voiceConnected && !voice.micEnabled ? (
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--muted-foreground)] opacity-60" />
              ) :
              mode !== 'IDLE' ? activeMicIcon :
              undefined
            }
            minimizedOrb={
              isOrbMinimized ? (
                <Orb3D getFrequency={getFrequencyData} getAmplitude={getAmplitude} className="blur-0 scale-[1.1]" />
              ) : null
            }
            className="bg-transparent py-0"
          />
        </div>
      </div>

      {/* ── Panels & Modals (GiftAI) ─────────────────── */}
      <ProductDetailPanel
        product={detailProduct}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAddToCart={(product, variant, qty) => { handleAddToCart(product, variant); setDetailOpen(false) }}
        onBuyNow={(product, variant, qty) => { handleBuyNow(product, variant); setDetailOpen(false) }}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        checkoutUrl={voice.cartState?.checkoutUrl}
        storeName={storeCredentials.storeUrl.replace('.myshopify.com', '')}
        cartState={voice.cartState}
      />

      <ExpressCheckoutSheet
        isOpen={voice.expressCheckout.isOpen}
        onClose={voice.closeExpressCheckout}
        checkoutUrl={voice.expressCheckout.checkoutUrl}
        jwt={voice.expressCheckout.jwt}
        productTitle={voice.expressCheckout.productTitle}
        shopName={voice.expressCheckout.shopName}
        productInfo={{
          title: voice.expressCheckout.productTitle || undefined,
          image: voice.expressCheckout.productImage || undefined,
          price: voice.expressCheckout.productPrice || undefined,
          shopName: voice.expressCheckout.shopName || undefined,
        }}
        vaultProfile={voice.vaultProfile}
        onCheckoutComplete={voice.handleCheckoutComplete}
      />

      {voice.showSavePrompt && (
        <div className="fixed bottom-24 left-0 right-0 z-50 flex justify-center">
          <SaveProfilePrompt
            isVisible={voice.showSavePrompt}
            onSave={() => {
              voice.setShowSavePrompt(false)
              fetch('/api/vault', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ save: true }) }).catch(() => {})
            }}
            onDismiss={() => voice.setShowSavePrompt(false)}
          />
        </div>
      )}

      {/* StoreSwapModal removed — defaulting to global mode */}

      <BuyerVaultModal
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onVaultChange={(has) => setHasVaultData(has)}
      />
    </div>
  )
}

// ═══════════════════════════════════════════
// Product Carousel (within chat flow)
// ═══════════════════════════════════════════

function ProductCarouselInline({
  products, onProductClick, onAddToCart, onBuyNow, onExpressCheckout, highlightedProductId,
}: {
  products: ProductDetail[]
  onProductClick?: (p: ProductDetail) => void
  onAddToCart?: (p: ProductDetail, v?: VariantDetail) => void
  onBuyNow?: (p: ProductDetail, v?: VariantDetail) => void
  onExpressCheckout?: (p: ProductDetail, v?: VariantDetail) => void
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
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {products.map((p, i) => (
          <ChatProductCard
            key={p.productId}
            product={p}
            staggerIndex={i}
            onProductClick={onProductClick}
            onAddToCart={onAddToCart}
            onBuyNow={onBuyNow}
            onExpressCheckout={onExpressCheckout}
            isHighlighted={p.productId === highlightedProductId}
          />
        ))}
      </div>
      {canScrollLeft && (
        <button onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 bg-[var(--card)] shadow-md rounded-full flex items-center justify-center z-10 border border-[var(--border)]">
          <ChevronLeft size={16} className="text-[var(--foreground)]" />
        </button>
      )}
      {canScrollRight && (
        <button onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 bg-[var(--card)] shadow-md rounded-full flex items-center justify-center z-10 border border-[var(--border)]">
          <ChevronRight size={16} className="text-[var(--foreground)]" />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Connect Screen — HALO styled
// ═══════════════════════════════════════════

function ConnectScreen({ onConnect }: { onConnect: (creds: StoreCredentials) => void }) {
  const [storeUrl, setStoreUrl] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  const handleConnect = () => {
    if (!storeUrl.trim()) { setError('Store URL is required'); return }
    if (!token.trim()) { setError('Access token is required'); return }
    if (!token.startsWith('shpat_')) { setError('Token should start with shpat_'); return }
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
          <h1 className="text-3xl font-bold text-[var(--foreground)]">OMI</h1>
          <p className="text-[var(--muted-foreground)] mt-2">Voice-First Gift Shopping</p>
        </div>
        <div className="space-y-4 bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] p-6 shadow-sm">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Store URL</label>
            <input type="text" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} placeholder="your-store.myshopify.com"
              className="w-full px-4 py-3 bg-transparent border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Access Token</label>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="shpat_..."
              className="w-full px-4 py-3 bg-transparent border border-[var(--border)] rounded-[var(--radius)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30" />
          </div>
          {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
          <button onClick={handleConnect}
            className="w-full py-3 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium transition-all">
            Connect Store
          </button>
        </div>
      </div>
    </div>
  )
}
