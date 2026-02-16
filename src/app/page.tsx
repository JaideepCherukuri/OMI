'use client'

/**
 * GiftAI — Voice-First Gift Shopping
 *
 * Layout (per PRD Round 2 — "Stage + Transcript" pattern, won 2:1 in user tests):
 *
 *   ┌──────────────────────────────┐
 *   │ Header                       │
 *   ├──────────────────────────────┤
 *   │                              │
 *   │   STAGE (~60%)               │
 *   │   Orb (welcome) / Products   │
 *   │   / Cart / Checkout          │
 *   │                              │
 *   ├──────────────────────────────┤
 *   │   TRANSCRIPT (compact)       │
 *   │   Recent messages            │
 *   ├──────────────────────────────┤
 *   │   Suggestions (contextual)   │
 *   ├──────────────────────────────┤
 *   │   Input + Voice Controls     │
 *   └──────────────────────────────┘
 *
 * The VoiceProvider wraps everything, managing LiveKit connection and unified
 * conversation state for both voice and text modalities.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { VoiceProvider, useVoice } from '@/components/VoiceProvider'
import Stage from '@/components/Stage'
import TranscriptStream from '@/components/TranscriptStream'
import VoiceControls from '@/components/VoiceControls'
import CartPanel from '@/components/CartPanel'
import StoreSwapModal from '@/components/StoreSwapModal'
import Orb from '@/components/Orb'
import type { StoreCredentials, VoiceState } from '@/types'
import {
  ShoppingCart,
  Settings,
  ArrowRightLeft,
} from 'lucide-react'

// ═══════════════════════════════════════════
// Main Page (with store credentials)
// ═══════════════════════════════════════════

export default function Home() {
  const [storeCredentials, setStoreCredentials] = useState<StoreCredentials>({
    storeUrl: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
    accessToken: process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN || '',
  })
  const [isConnected, setIsConnected] = useState(false)

  // Auto-connect if credentials are in env vars
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
// Main App Layout (inside VoiceProvider)
// ═══════════════════════════════════════════

function GiftAIApp({
  storeCredentials,
  onStoreChange,
}: {
  storeCredentials: StoreCredentials
  onStoreChange: (creds: StoreCredentials) => void
}) {
  const voice = useVoice()
  const [cartOpen, setCartOpen] = useState(false)
  const [storeSwapOpen, setStoreSwapOpen] = useState(false)
  const [textInput, setTextInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Contextual suggestions (PRD 3.6.2) ──
  const suggestions = useMemo(() => {
    if (voice.products.length > 0 && voice.stageContent === 'products') {
      return [
        { label: '🛒 Add first one', action: 'add_first' },
        { label: '💡 Tell me more', action: 'tell_more' },
        { label: '💰 Show cheaper', action: 'cheaper' },
        { label: '🎁 More options', action: 'more' },
      ]
    }
    if (voice.cartState && voice.cartState.totalQuantity > 0) {
      return [
        { label: '✅ Checkout', action: 'checkout' },
        { label: '🛍️ Keep shopping', action: 'keep_shopping' },
        { label: '🛒 View cart', action: 'view_cart' },
      ]
    }
    if (voice.messages.length <= 1) {
      return [
        { label: "💝 Valentine's gifts", action: 'search_valentines' },
        { label: '🎂 Birthday ideas', action: 'search_birthday' },
        { label: '💍 Wedding gifts', action: 'search_wedding' },
        { label: '✨ Show everything', action: 'search_all' },
      ]
    }
    return []
  }, [voice.products, voice.cartState, voice.messages, voice.stageContent])

  const handleSuggestion = useCallback(
    async (action: string) => {
      const actionMap: Record<string, string> = {
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
        view_cart: "What's in my cart?",
        search_valentines: "Show me Valentine's Day gifts",
        search_birthday: 'Birthday gift ideas',
        search_wedding: 'Wedding gift suggestions',
        search_all: 'Show me everything you have',
      }
      const msg = actionMap[action] || action
      await voice.sendTextMessage(msg)
    },
    [voice],
  )

  // ── Text input submit ──
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

  // ── Typing-pauses-mic behavior (PRD 3.6.1) ──
  const handleInputFocus = useCallback(() => {
    if (voice.voiceConnected && voice.micEnabled) {
      // Auto-pause mic when typing
      voice.toggleMic()
    }
  }, [voice])

  const handleInputBlur = useCallback(() => {
    if (voice.voiceConnected && !voice.micEnabled && !textInput) {
      // Resume mic when done typing (if input is empty)
      voice.toggleMic()
    }
  }, [voice, textInput])

  const cartBadge = voice.cartState?.totalQuantity || 0

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white overflow-hidden">
      {/* ── Header ────────────────────────────── */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-gray-900/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Left: Logo + store */}
          <div className="flex items-center gap-3">
            <Orb state={voice.voiceState} size="sm" />
            <div>
              <h1 className="text-lg font-semibold bg-gradient-to-r from-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
                GiftAI
              </h1>
              <p className="text-xs text-gray-500 truncate max-w-[180px]">
                {storeCredentials.storeUrl}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="View cart"
            >
              <ShoppingCart size={20} className="text-gray-400" />
              {cartBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-fuchsia-500 text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartBadge}
                </span>
              )}
            </button>
            <button
              onClick={() => setStoreSwapOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Switch store"
            >
              <ArrowRightLeft size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Stage Area (~60%) ─────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-3xl mx-auto flex flex-col">
          {/* Stage: top 60% */}
          <div className="flex-[3] min-h-0 overflow-auto px-4 py-4">
            <Stage
              content={voice.stageContent}
              voiceState={voice.voiceState}
              products={voice.products}
              cartState={voice.cartState}
              highlightedProductId={voice.highlightedProductId}
              onAddToCart={(product, variant) => {
                if (voice.voiceConnected) {
                  voice.sendUiAction('add_to_cart', {
                    productTitle: product.title,
                    variantTitle: variant?.name,
                  })
                } else {
                  voice.sendTextMessage(`Add ${product.title} to my cart`)
                }
              }}
              onProductClick={(product) => {
                if (voice.voiceConnected) {
                  voice.sendUiAction('view_details', {
                    productTitle: product.title,
                  })
                } else {
                  voice.sendTextMessage(`Tell me about ${product.title}`)
                }
              }}
              onConnect={voice.connectVoice}
            />
          </div>

          {/* Transcript: bottom 40% */}
          <div className="flex-[2] min-h-0 border-t border-white/5">
            <div className="h-full overflow-auto px-4 py-2">
              <TranscriptStream messages={voice.messages} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Suggestions ───────────────────────── */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/5">
          <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s) => (
              <button
                key={s.action}
                onClick={() => handleSuggestion(s.action)}
                className="flex-shrink-0 px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors text-gray-300"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input + Voice Controls ────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/10 bg-gray-900/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Text input */}
          <form onSubmit={handleSubmit} className="flex-1 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={
                voice.voiceConnected
                  ? 'Type a message (voice paused while typing)...'
                  : 'Ask me about gifts...'
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
              disabled={voice.isTextLoading}
            />
          </form>

          {/* Voice controls */}
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

      {/* ── Panels ────────────────────────────── */}
      <CartPanel
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
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
// Connect Screen (shown when no credentials)
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
    <div className="h-dvh flex items-center justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-3xl">🎁</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
            GiftAI
          </h1>
          <p className="text-gray-400 mt-2">Voice-First Gift Shopping</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleConnect}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl font-medium transition-all"
          >
            Connect Store
          </button>
        </div>
      </div>
    </div>
  )
}

// Need useMemo import
import { useMemo } from 'react'
