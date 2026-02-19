'use client'

/**
 * VoiceProvider — Unified voice + text state provider.
 *
 * Architecture:
 *   State lives HERE (messages, products, cart) — NOT inside LiveKitRoom.
 *   This means state persists across voice connect/disconnect cycles.
 *
 *   Voice connected:  LiveKitRoom wraps children, VoiceBridge syncs LiveKit events
 *   Voice off:        Same state, text routes through /api/chat
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useVoiceAssistant,
  useConnectionState,
} from '@livekit/components-react'
import { RoomEvent, DataPacket_Kind, Track, ConnectionState } from 'livekit-client'
import { useRoomContext } from '@livekit/components-react'
import '@livekit/components-styles'
import type {
  ChatMessage,
  ProductDetail,
  CartState,
  StoreCredentials,
  VoiceState,
  StageContent,
  ExpressCheckoutState,
  BuyerVaultProfile,
  VariantDetail,
} from '@/types'

// ═══════════════════════════════════════════
// Context Types
// ═══════════════════════════════════════════

interface SuggestionChip {
  label: string
  text: string
  url?: string
}

interface VoiceContextValue {
  // Voice state
  voiceState: VoiceState
  voiceConnected: boolean
  voiceConnecting: boolean

  // Unified conversation
  messages: ChatMessage[]
  products: ProductDetail[]
  cartState: CartState | null
  stageContent: StageContent
  highlightedProductId: number | null

  // Dynamic suggestions from agent
  agentSuggestions: SuggestionChip[]

  // Actions
  connectVoice: () => Promise<void>
  disconnectVoice: () => void
  sendTextMessage: (text: string) => Promise<void>
  sendUiAction: (action: string, data?: Record<string, unknown>) => void
  clearChat: () => void
  setStageContent: (content: StageContent) => void

  // Audio
  micEnabled: boolean
  speakerEnabled: boolean
  toggleMic: () => void
  toggleSpeaker: () => void

  // Text API state
  isTextLoading: boolean

  // Room name
  roomName: string | null

  // Express Checkout
  expressCheckout: ExpressCheckoutState
  openExpressCheckout: (product: ProductDetail, variant?: VariantDetail) => Promise<void>
  closeExpressCheckout: () => void
  handleCheckoutComplete: (orderData?: any) => void
  vaultProfile: BuyerVaultProfile | null
  showSavePrompt: boolean
  setShowSavePrompt: (show: boolean) => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
  return ctx
}

// ═══════════════════════════════════════════
// VoiceProvider — ALL state lives here
// ═══════════════════════════════════════════

interface VoiceProviderProps {
  storeCredentials: StoreCredentials
  searchMode?: 'global' | 'storefront'
  children: React.ReactNode
}

export function VoiceProvider({ storeCredentials, searchMode = 'storefront', children }: VoiceProviderProps) {
  // ── LiveKit connection state ───────────────
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [roomName, setRoomName] = useState<string | null>(null)
  const [shouldConnect, setShouldConnect] = useState(false)

  // ── Voice state (set by VoiceBridge when connected) ──
  const [voiceState, setVoiceState] = useState<VoiceState>('disconnected')

  // ── Shared state (persists across voice connect/disconnect) ──
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [cartState, setCartState] = useState<CartState | null>(null)
  const [stageContent, setStageContent] = useState<StageContent>('welcome')
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null)
  const [isTextLoading, setIsTextLoading] = useState(false)
  const [agentSuggestions, setAgentSuggestions] = useState<SuggestionChip[]>([])

  // ── Express Checkout state ──
  const [expressCheckout, setExpressCheckout] = useState<ExpressCheckoutState>({
    isOpen: false,
    checkoutUrl: null,
    jwt: null,
    mode: null,
    checkoutId: null,
    productTitle: null,
    shopName: null,
    status: 'loading',
    error: null,
  })
  const [vaultProfile, setVaultProfile] = useState<BuyerVaultProfile | null>(null)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

  // ── MCP session ID (persists across requests for cart continuity) ──
  const [mcpSessionId, setMcpSessionId] = useState<string>(
    () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  )

  // ── Audio state ────────────────────────────
  const [micEnabled, setMicEnabled] = useState(true)
  const [speakerEnabled, setSpeakerEnabled] = useState(true)

  // ── Room ref for data channel (set by VoiceBridge) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomRef = useRef<any>(null)

  // ── Connect voice (sends conversation context via participant metadata) ──
  const connectVoice = useCallback(async () => {
    try {
      setVoiceState('connecting')

      // Build conversation context from text history
      const contextMessages = messages.slice(-8).map(m => `${m.role}: ${m.content}`)
      const context = contextMessages.length > 0 ? contextMessages.join('\n') : undefined

      // POST to token API with context embedded in participant metadata
      const resp = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomName || undefined,
          context,
        }),
        cache: 'no-store',
      })
      if (!resp.ok) throw new Error(`Token fetch failed: ${resp.statusText}`)

      const data = await resp.json()
      setToken(data.participantToken)
      setServerUrl(data.serverUrl)
      setRoomName(data.roomName)
      setShouldConnect(true)
    } catch (err) {
      console.error('Voice connect failed:', err)
      setVoiceState('disconnected')
    }
  }, [roomName, messages])

  // ── Disconnect voice ───────────────────────
  const disconnectVoice = useCallback(() => {
    setShouldConnect(false)
    setToken('')
    setVoiceState('disconnected')
  }, [])

  // ── Text message: /api/chat (works in BOTH modes) ──
  const sendViaTextApi = useCallback(
    async (text: string) => {
      setIsTextLoading(true)
      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.products ? { products: m.products } : {}),
        }))

        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            storeCredentials,
            history,
            cartId: cartState?.cartId,
            cartState: cartState,
            mcpSessionId,
            searchMode,
          }),
        })

        if (!resp.ok) throw new Error(`Chat API error: ${resp.status}`)
        const data = await resp.json()

        if (data.products?.length) {
          setProducts(data.products)
          setStageContent('products')
        }
        if (data.cartState) {
          setCartState(data.cartState)
        }
        if (data.mcpSessionId) {
          setMcpSessionId(data.mcpSessionId)
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.message || 'Here you go!',
            timestamp: Date.now(),
            products: data.products,
            cartState: data.cartState,
            checkoutUrl: data.checkoutUrl,
            source: 'text',
          },
        ])
      } catch (err) {
        console.error('Text API error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: 'Something went wrong. Please try again.',
            timestamp: Date.now(),
          },
        ])
      } finally {
        setIsTextLoading(false)
      }
    },
    [messages, storeCredentials, cartState, searchMode],
  )

  // ── Send text message — ALWAYS uses /api/chat for immediate response ──
  const sendTextMessage = useCallback(
    async (text: string) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: Date.now(),
          source: 'text',
        },
      ])
      await sendViaTextApi(text)
    },
    [sendViaTextApi],
  )

  // ── UI action via data channel ──
  const sendUiAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (!shouldConnect || !roomRef.current) return
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'user_action', action, ...data }),
        )
        roomRef.current.localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.error('UI action send failed:', err)
      }
    },
    [shouldConnect],
  )

  // ── Toggle mic (properly mute/unmute the audio track) ──
  const toggleMic = useCallback(() => {
    if (roomRef.current) {
      const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone)
      if (pub?.track) {
        if (micEnabled) {
          pub.mute()
          if (pub.track.mediaStreamTrack) {
            pub.track.mediaStreamTrack.enabled = false
          }
        } else {
          pub.unmute()
          if (pub.track.mediaStreamTrack) {
            pub.track.mediaStreamTrack.enabled = true
          }
        }
      }
    }
    setMicEnabled((prev) => !prev)
  }, [micEnabled])

  // ── Toggle speaker ──
  const toggleSpeaker = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.remoteParticipants.forEach((p: any) => {
        p.audioTrackPublications.forEach((pub: any) => {
          if (pub.track) {
            pub.track.mediaStreamTrack.enabled = !speakerEnabled
          }
        })
      })
    }
    setSpeakerEnabled((prev) => !prev)
  }, [speakerEnabled])

  // ── Express Checkout: open ──
  const openExpressCheckout = useCallback(
    async (product: ProductDetail, variant?: VariantDetail) => {
      setExpressCheckout({
        isOpen: true,
        checkoutUrl: null,
        jwt: null,
        mode: null,
        checkoutId: null,
        productTitle: product.title,
        shopName: product.shopName || null,
        status: 'loading',
        error: null,
      })

      try {
        const resp = await fetch('/api/checkout/express', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product,
            variant,
            vaultProfile,
          }),
        })

        if (!resp.ok) throw new Error(`Express checkout API error: ${resp.status}`)
        const data = await resp.json()

        setExpressCheckout((prev) => ({
          ...prev,
          checkoutUrl: data.checkoutUrl || product.directCheckoutUrl || null,
          jwt: data.jwt || null,
          mode: data.mode || 'direct',
          checkoutId: data.checkoutId || null,
          status: 'ready',
        }))
      } catch (err) {
        console.error('Express checkout error:', err)
        // Fallback to directCheckoutUrl if available
        if (product.directCheckoutUrl) {
          setExpressCheckout((prev) => ({
            ...prev,
            checkoutUrl: product.directCheckoutUrl!,
            mode: 'direct',
            status: 'ready',
          }))
        } else {
          setExpressCheckout((prev) => ({
            ...prev,
            status: 'error',
            error: 'Could not prepare checkout. Please try again.',
          }))
        }
      }
    },
    [vaultProfile],
  )

  // ── Express Checkout: close ──
  const closeExpressCheckout = useCallback(() => {
    setExpressCheckout({
      isOpen: false,
      checkoutUrl: null,
      jwt: null,
      mode: null,
      checkoutId: null,
      productTitle: null,
      shopName: null,
      status: 'loading',
      error: null,
    })
  }, [])

  // ── Express Checkout: complete ──
  const handleCheckoutComplete = useCallback(
    (orderData?: any) => {
      // Close the sheet
      closeExpressCheckout()

      // Add confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: `checkout-complete-${Date.now()}`,
          role: 'assistant',
          content: '🎉 Order confirmed! Your purchase is on its way.',
          timestamp: Date.now(),
          source: 'system',
        },
      ])

      // If no vault profile, show save prompt
      if (!vaultProfile) {
        setShowSavePrompt(true)
      }

      // Try to save buyer info from the order
      if (orderData) {
        fetch('/api/vault', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderData }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data?.email) setVaultProfile(data)
          })
          .catch(() => {})
      }
    },
    [closeExpressCheckout, vaultProfile],
  )

  // ── Fetch vault profile on mount ──
  useEffect(() => {
    fetch('/api/vault')
      .then((r) => r.json())
      .then((data) => {
        if (data?.email) setVaultProfile(data)
      })
      .catch(() => {})
  }, [])

  // ── Clear chat ──
  const clearChat = useCallback(() => {
    setMessages([])
    setProducts([])
    setCartState(null)
    setStageContent('welcome')
    setHighlightedProductId(null)
    setAgentSuggestions([])
  }, [])

  // ── Data channel handler (called from VoiceBridge) ──
  const handleAgentData = useCallback((payload: Uint8Array) => {
    try {
      const event = JSON.parse(new TextDecoder().decode(payload))
      const type = event.type as string

      // ── User transcription (from Gemini via agent data channel) ──
      if (type === 'user_transcription') {
        const text = (event.text || '').trim()
        const isFinal = event.isFinal === true

        if (!text) return

        setMessages((prev) => {
          // Search backward for ANY streaming user voice message (not just last)
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === 'user' && prev[i].source === 'voice' && prev[i].streaming) {
              const updated = [...prev]
              updated[i] = { ...updated[i], content: text, timestamp: Date.now(), streaming: !isFinal }
              return updated
            }
          }

          // Dedup: skip if a recent finalized user message has the same text
          if (isFinal) {
            for (let i = prev.length - 1; i >= Math.max(0, prev.length - 5); i--) {
              if (prev[i].role === 'user' && prev[i].content === text && !prev[i].streaming) {
                return prev
              }
            }
          }

          // Create new user message
          return [
            ...prev,
            {
              id: `voice-user-${Date.now()}`,
              role: 'user',
              content: text,
              timestamp: Date.now(),
              source: 'voice',
              streaming: !isFinal,
            },
          ]
        })
        return
      }

      // ── Dynamic suggestion chips from agent ──
      if (type === 'suggestions') {
        const chips = (event.suggestions || []) as SuggestionChip[]
        if (chips.length > 0) {
          setAgentSuggestions(chips)
        }
        return
      }

      // ── Express checkout triggered via voice agent ──
      if (type === 'express_checkout_open') {
        const product = event.product as ProductDetail
        openExpressCheckout(product)
        return
      }

      if (type === 'products_found') {
        // Map agent's underscore-prefixed fields to frontend ProductDetail format
        const prods = (event.products as any[]).map((p: any) => ({
          ...p,
          isGlobal: p.isGlobal ?? true,
          directCheckoutUrl: p.directCheckoutUrl || p._checkoutUrl || p.shopUrl || '',
          shopName: p.shopName || p._shopName || p.vendor || '',
        })) as ProductDetail[]
        setProducts(prods)
        setStageContent('products')
        const query = event.query || 'your request'

        // Create assistant message with products. Use text_blurb from agent if available.
        const blurb = event.text_blurb || `Found ${prods.length} products for "${query}"`
        setMessages((prev) => {
          // If the last message is a streaming assistant message, finalize it first
          const updated = prev.map(m =>
            m.streaming && m.role === 'assistant' ? { ...m, streaming: false } : m
          )
          return [
            ...updated,
            {
              id: `voice-products-${Date.now()}`,
              role: 'assistant',
              content: blurb,
              timestamp: Date.now(),
              products: prods,
              source: 'voice',
            },
          ]
        })
      } else if (type === 'cart_updated') {
        const cart = event.cart as CartState
        setCartState(cart)
        setMessages((prev) => [
          ...prev,
          {
            id: `cart-${Date.now()}`,
            role: 'assistant',
            content: `Cart updated — ${cart.totalQuantity} item${cart.totalQuantity !== 1 ? 's' : ''}, total ${cart.totalAmount} ${cart.currency}`,
            timestamp: Date.now(),
            cartState: cart,
            source: 'voice',
          },
        ])
      } else if (type === 'checkout_ready') {
        const url = event.url as string
        setStageContent('checkout')
        setMessages((prev) => [
          ...prev,
          {
            id: `checkout-${Date.now()}`,
            role: 'assistant',
            content: 'Your checkout is ready!',
            timestamp: Date.now(),
            checkoutUrl: url,
            source: 'voice',
          },
        ])
      } else if (type === 'product_detail') {
        const product = event.product as ProductDetail
        setProducts([product])
        setStageContent('products')
        setHighlightedProductId(product.productId)
      }
    } catch (err) {
      console.error('Data channel parse error:', err)
    }
  }, [openExpressCheckout])

  // ── Handle assistant voice transcriptions from LiveKit ──
  // This is the ONLY source of agent speech text (from Gemini's output_audio_transcription).
  const handleTranscription = useCallback((
    segments: Array<{ id: string; text: string; final: boolean }>,
    isFinal: boolean,
  ) => {
    const text = segments.map(s => s.text).join(' ').trim()
    if (!text) return

    setMessages((prev) => {
      // Search backward for ANY streaming assistant voice message (not just last)
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'assistant' && prev[i].source === 'voice' && prev[i].streaming) {
          const updated = [...prev]
          updated[i] = { ...updated[i], content: text, streaming: !isFinal }
          return updated
        }
      }

      // Dedup: skip if a recent finalized assistant message has same/similar text
      for (let i = prev.length - 1; i >= Math.max(0, prev.length - 5); i--) {
        const m = prev[i]
        if (m.role === 'assistant' && m.source === 'voice' && !m.streaming) {
          if (m.content === text || text.startsWith(m.content) || m.content.startsWith(text)) {
            return prev
          }
        }
      }

      // Create new streaming assistant message
      return [
        ...prev,
        {
          id: `voice-assistant-${Date.now()}`,
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
          source: 'voice',
          streaming: !isFinal,
        },
      ]
    })
  }, [])

  // ── Build context value ────────────────────
  const voiceConnected = shouldConnect && voiceState !== 'disconnected' && voiceState !== 'connecting'
  const voiceConnecting = voiceState === 'connecting'

  const value: VoiceContextValue = useMemo(
    () => ({
      voiceState,
      voiceConnected,
      voiceConnecting,
      messages,
      products,
      cartState,
      stageContent,
      highlightedProductId,
      agentSuggestions,
      connectVoice,
      disconnectVoice,
      sendTextMessage,
      sendUiAction,
      clearChat,
      setStageContent,
      micEnabled,
      speakerEnabled,
      toggleMic,
      toggleSpeaker,
      isTextLoading,
      roomName,
      expressCheckout,
      openExpressCheckout,
      closeExpressCheckout,
      handleCheckoutComplete,
      vaultProfile,
      showSavePrompt,
      setShowSavePrompt,
    }),
    [
      voiceState, voiceConnected, voiceConnecting,
      messages, products, cartState, stageContent, highlightedProductId,
      agentSuggestions,
      connectVoice, disconnectVoice, sendTextMessage, sendUiAction,
      clearChat, setStageContent,
      micEnabled, speakerEnabled, toggleMic, toggleSpeaker,
      isTextLoading, roomName,
      expressCheckout, openExpressCheckout, closeExpressCheckout,
      handleCheckoutComplete, vaultProfile, showSavePrompt,
    ],
  )

  // ── Render ─────────────────────────────────
  // IMPORTANT: {children} must stay at the same tree position regardless of
  // voice connection state. If children moved inside/outside <LiveKitRoom>,
  // React would remount them, resetting all page state (isOrbMinimized etc).
  // LiveKitRoom + VoiceBridge mount as siblings when voice connects.
  return (
    <VoiceContext.Provider value={value}>
      {shouldConnect && token && serverUrl && (
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          audio={true}
          video={false}
          connect={shouldConnect}
          style={{ display: 'contents' }}
        >
          <RoomAudioRenderer />
          <StartAudio label="Click to enable audio" />
          <VoiceBridge
            roomRef={roomRef}
            setVoiceState={setVoiceState}
            onAgentData={handleAgentData}
            onTranscription={handleTranscription}
          />
        </LiveKitRoom>
      )}
      {children}
    </VoiceContext.Provider>
  )
}

// ═══════════════════════════════════════════
// VoiceBridge — syncs LiveKit state to parent
// ═══════════════════════════════════════════

function VoiceBridge({
  roomRef,
  setVoiceState,
  onAgentData,
  onTranscription,
}: {
  roomRef: React.MutableRefObject<any>
  setVoiceState: (state: VoiceState) => void
  onAgentData: (payload: Uint8Array) => void
  onTranscription: (
    segments: Array<{ id: string; text: string; final: boolean }>,
    isFinal: boolean,
  ) => void
}) {
  const room = useRoomContext()
  const { state: agentState } = useVoiceAssistant()
  const connectionState = useConnectionState()

  // ── Accumulate text for current speech turn ──
  const currentTurnText = useRef<Map<string, string>>(new Map())

  // ── Sync room ref to parent ──
  useEffect(() => {
    roomRef.current = room
    return () => { roomRef.current = null }
  }, [room, roomRef])

  // ── Sync voice state to parent ──
  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      setVoiceState('disconnected')
      return
    }
    if (connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Reconnecting) {
      setVoiceState('connecting')
      return
    }
    switch (agentState) {
      case 'listening':
        setVoiceState('listening')
        break
      case 'thinking':
        setVoiceState('thinking')
        break
      case 'speaking':
        setVoiceState('speaking')
        break
      default:
        setVoiceState('idle')
    }
  }, [connectionState, agentState, setVoiceState])

  // ── Listen for data channel events ──
  useEffect(() => {
    if (!room) return
    const handleData = (payload: Uint8Array) => { onAgentData(payload) }
    room.on(RoomEvent.DataReceived, handleData)
    return () => { room.off(RoomEvent.DataReceived, handleData) }
  }, [room, onAgentData])

  // ── Listen for voice transcriptions (ASSISTANT speech → real-time streaming) ──
  // Process ALL segments (including non-final) for real-time text streaming.
  useEffect(() => {
    if (!room) return

    const handleTranscription = (
      segments: Array<{ id: string; text: string; final: boolean }>,
      participant?: { isLocal?: boolean },
    ) => {
      // Skip user transcriptions — they come from agent data channel
      if (participant?.isLocal) return
      if (!segments || segments.length === 0) return

      // Update accumulated text for each segment
      for (const seg of segments) {
        currentTurnText.current.set(seg.id, seg.text)
      }

      // Build full text from all accumulated segments in order
      const allText = Array.from(currentTurnText.current.values()).join(' ').trim()
      if (!allText) return

      // Check if ALL segments are final
      const allFinal = segments.every(s => s.final)

      // Forward to parent with streaming state
      onTranscription(
        [{ id: 'combined', text: allText, final: allFinal }],
        allFinal,
      )

      // If all final, clear accumulator for next turn
      if (allFinal) {
        currentTurnText.current.clear()
      }
    }

    room.on(RoomEvent.TranscriptionReceived, handleTranscription)
    return () => { room.off(RoomEvent.TranscriptionReceived, handleTranscription) }
  }, [room, onTranscription])

  // ── Clear accumulator when agent stops speaking ──
  useEffect(() => {
    if (agentState !== 'speaking') {
      // Small delay to let final segments arrive
      const timer = setTimeout(() => {
        currentTurnText.current.clear()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [agentState])

  return null
}
