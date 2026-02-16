'use client'

/**
 * VoiceProvider — Core LiveKit wrapper providing unified voice + text state.
 *
 * Architecture (per PRD):
 *   "ONE conversation context, TWO input modalities."
 *
 * This component:
 *   1. Manages LiveKit room connection (token fetch, connect/disconnect)
 *   2. Provides voice agent state via useVoiceAssistant (listening/speaking/thinking)
 *   3. Handles data channel events from the Python agent:
 *      - products_found → updates products[], stageContent
 *      - cart_updated → updates cartState, stageContent
 *      - checkout_ready → opens checkout URL
 *      - product_detail → shows single product detail
 *   4. Maintains unified messages[] for both voice and text
 *   5. Routes text input through voice agent (data channel) when voice is active,
 *      or through /api/chat when voice is off
 *   6. Tracks stage content state (welcome/products/cart/checkout)
 *
 * Usage:
 *   <VoiceProvider storeCredentials={creds}>
 *     <YourPageLayout />
 *   </VoiceProvider>
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
import { RoomEvent, DataPacket_Kind, Track } from 'livekit-client'
import { useRoomContext } from '@livekit/components-react'
import '@livekit/components-styles'
import type {
  ChatMessage,
  ProductDetail,
  CartState,
  StoreCredentials,
  VoiceState,
  StageContent,
} from '@/types'

// ═══════════════════════════════════════════
// Context Types
// ═══════════════════════════════════════════

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

  // Text API fallback state
  isTextLoading: boolean

  // Room name (for reconnecting)
  roomName: string | null
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext)
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider')
  return ctx
}

// ═══════════════════════════════════════════
// VoiceProvider (outer) — manages token + LiveKitRoom
// ═══════════════════════════════════════════

interface VoiceProviderProps {
  storeCredentials: StoreCredentials
  children: React.ReactNode
}

export function VoiceProvider({ storeCredentials, children }: VoiceProviderProps) {
  const [token, setToken] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [roomName, setRoomName] = useState<string | null>(null)
  const [shouldConnect, setShouldConnect] = useState(false)

  // Fetch token and establish connection
  const connectVoice = useCallback(async () => {
    try {
      // Reuse existing room if reconnecting, else new session
      const url = roomName
        ? `/api/token?room=${roomName}`
        : '/api/token'

      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`Token fetch failed: ${resp.statusText}`)

      const data = await resp.json()
      setToken(data.participantToken)
      setServerUrl(data.serverUrl)
      setRoomName(data.roomName)
      setShouldConnect(true)
    } catch (err) {
      console.error('Voice connect failed:', err)
    }
  }, [roomName])

  const disconnectVoice = useCallback(() => {
    setShouldConnect(false)
    setToken('')
    setRoomName(null)
  }, [])

  // If not connecting, render children without LiveKitRoom (text-only mode)
  if (!shouldConnect || !token || !serverUrl) {
    return (
      <VoiceContext.Provider
        value={createTextOnlyContext(
          storeCredentials,
          connectVoice,
          disconnectVoice,
          roomName,
        )}
      >
        {children}
      </VoiceContext.Provider>
    )
  }

  // Voice mode — wrap in LiveKitRoom
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      audio={true}
      video={false}
      connect={shouldConnect}
      style={{ display: 'contents' }} // Don't add a wrapper div
    >
      <RoomAudioRenderer />
      <StartAudio label="Click to enable audio" />
      <VoiceInner
        storeCredentials={storeCredentials}
        connectVoice={connectVoice}
        disconnectVoice={disconnectVoice}
        roomName={roomName}
      >
        {children}
      </VoiceInner>
    </LiveKitRoom>
  )
}

// ═══════════════════════════════════════════
// VoiceInner — inside LiveKitRoom, has access to room context
// ═══════════════════════════════════════════

interface VoiceInnerProps {
  storeCredentials: StoreCredentials
  connectVoice: () => Promise<void>
  disconnectVoice: () => void
  roomName: string | null
  children: React.ReactNode
}

function VoiceInner({
  storeCredentials,
  connectVoice,
  disconnectVoice,
  roomName,
  children,
}: VoiceInnerProps) {
  const room = useRoomContext()
  const { state: agentState, audioTrack } = useVoiceAssistant()
  const connectionState = useConnectionState()

  // ── Unified State ──────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [products, setProducts] = useState<ProductDetail[]>([])
  const [cartState, setCartState] = useState<CartState | null>(null)
  const [stageContent, setStageContent] = useState<StageContent>('welcome')
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [speakerEnabled, setSpeakerEnabled] = useState(true)
  const [isTextLoading, setIsTextLoading] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Map agent states to our VoiceState ─────
  const voiceState: VoiceState = useMemo(() => {
    if (connectionState === 'disconnected') return 'disconnected'
    if (connectionState === 'connecting' || connectionState === 'reconnecting') return 'connecting'
    // Map LiveKit agent states
    switch (agentState) {
      case 'listening': return 'listening'
      case 'thinking': return 'thinking'
      case 'speaking': return 'speaking'
      case 'initializing':
      case 'connecting':
        return 'connecting'
      default: return 'idle'
    }
  }, [connectionState, agentState])

  const voiceConnected = connectionState === 'connected'
  const voiceConnecting = connectionState === 'connecting' || connectionState === 'reconnecting'

  // ── Idle timeout (PRD: 2 min silence → disconnect) ──
  useEffect(() => {
    if (!voiceConnected) return

    const resetIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        console.log('Idle timeout — disconnecting voice')
        disconnectVoice()
      }, 2 * 60 * 1000) // 2 minutes
    }

    resetIdle()

    // Reset on any state change
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [voiceConnected, voiceState, disconnectVoice])

  // ── Data channel: receive events from Python agent ──
  useEffect(() => {
    if (!room) return

    const handleData = (
      payload: Uint8Array,
      participant?: unknown,
      kind?: DataPacket_Kind,
    ) => {
      try {
        const event = JSON.parse(new TextDecoder().decode(payload))
        const type = event.type as string

        if (type === 'products_found') {
          const prods = event.products as ProductDetail[]
          setProducts(prods)
          setStageContent('products')

          // Add assistant message
          const query = event.query || 'your request'
          setMessages((prev) => [
            ...prev,
            {
              id: `voice-${Date.now()}`,
              role: 'assistant',
              content: `Found ${prods.length} products for "${query}"`,
              timestamp: Date.now(),
              products: prods,
              source: 'voice',
            },
          ])
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
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room])

  // ── Send text via data channel (when voice is active) or /api/chat ──
  const sendTextMessage = useCallback(
    async (text: string) => {
      // Add user message to unified state
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: Date.now(),
          source: voiceConnected ? 'text' : 'text',
        },
      ])

      if (voiceConnected && room) {
        // Route through voice agent via data channel (unified context)
        try {
          const payload = new TextEncoder().encode(
            JSON.stringify({ type: 'text_message', content: text }),
          )
          await room.localParticipant.publishData(payload, {
            reliable: true,
          })
        } catch (err) {
          console.error('Data channel send failed, falling back to text API:', err)
          await sendViaTextApi(text)
        }
      } else {
        // Text-only mode: use /api/chat
        await sendViaTextApi(text)
      }
    },
    [voiceConnected, room],
  )

  const sendViaTextApi = useCallback(
    async (text: string) => {
      setIsTextLoading(true)
      try {
        // Build history from recent messages (last 10)
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
    [messages, storeCredentials, cartState],
  )

  // ── UI action via data channel ──
  const sendUiAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      if (!voiceConnected || !room) return
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'user_action', action, ...data }),
        )
        room.localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.error('UI action send failed:', err)
      }
    },
    [voiceConnected, room],
  )

  // ── Mic/Speaker toggles ──
  const toggleMic = useCallback(() => {
    if (room) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
      if (pub?.track) {
        if (micEnabled) {
          pub.mute()
        } else {
          pub.unmute()
        }
      }
    }
    setMicEnabled((prev) => !prev)
  }, [room, micEnabled])

  const toggleSpeaker = useCallback(() => {
    // Toggle audio output (mute/unmute remote tracks)
    if (room) {
      room.remoteParticipants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          if (pub.track) {
            pub.track.mediaStreamTrack.enabled = !speakerEnabled
          }
        })
      })
    }
    setSpeakerEnabled((prev) => !prev)
  }, [room, speakerEnabled])

  const clearChat = useCallback(() => {
    setMessages([])
    setProducts([])
    setCartState(null)
    setStageContent('welcome')
    setHighlightedProductId(null)
  }, [])

  const value: VoiceContextValue = {
    voiceState,
    voiceConnected,
    voiceConnecting,
    messages,
    products,
    cartState,
    stageContent,
    highlightedProductId,
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
  }

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}

// ═══════════════════════════════════════════
// Text-only fallback context (when voice is disconnected)
// ═══════════════════════════════════════════

function createTextOnlyContext(
  storeCredentials: StoreCredentials,
  connectVoice: () => Promise<void>,
  disconnectVoice: () => void,
  roomName: string | null,
): VoiceContextValue {
  // This creates a minimal context for text-only mode
  // The actual state management happens in a separate hook
  return {
    voiceState: 'disconnected',
    voiceConnected: false,
    voiceConnecting: false,
    messages: [],
    products: [],
    cartState: null,
    stageContent: 'welcome',
    highlightedProductId: null,
    connectVoice,
    disconnectVoice,
    sendTextMessage: async () => {},
    sendUiAction: () => {},
    clearChat: () => {},
    setStageContent: () => {},
    micEnabled: true,
    speakerEnabled: true,
    toggleMic: () => {},
    toggleSpeaker: () => {},
    isTextLoading: false,
    roomName,
  }
}
