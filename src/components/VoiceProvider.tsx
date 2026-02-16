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

  // Text API state
  isTextLoading: boolean

  // Room name
  roomName: string | null
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
  children: React.ReactNode
}

export function VoiceProvider({ storeCredentials, children }: VoiceProviderProps) {
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

  // ── Connect voice ──────────────────────────
  const connectVoice = useCallback(async () => {
    try {
      setVoiceState('connecting')
      const url = roomName ? `/api/token?room=${roomName}` : '/api/token'
      const resp = await fetch(url, { cache: 'no-store' })
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
  }, [roomName])

  // ── Disconnect voice ───────────────────────
  const disconnectVoice = useCallback(() => {
    setShouldConnect(false)
    setToken('')
    setVoiceState('disconnected')
    // Don't clear roomName — allows reconnecting to same session
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
    [messages, storeCredentials, cartState],
  )

  // ── Send text message (voice data channel or text API) ──
  const sendTextMessage = useCallback(
    async (text: string) => {
      // Always add user message to state
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

      // If voice is connected, try data channel first
      if (shouldConnect && roomRef.current) {
        try {
          const payload = new TextEncoder().encode(
            JSON.stringify({ type: 'text_message', content: text }),
          )
          await roomRef.current.localParticipant.publishData(payload, {
            reliable: true,
          })
          return // Agent will respond via data channel
        } catch (err) {
          console.error('Data channel send failed, falling back to text API:', err)
        }
      }

      // Fallback: text API
      await sendViaTextApi(text)
    },
    [shouldConnect, sendViaTextApi],
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

  // ── Toggle mic ──
  const toggleMic = useCallback(() => {
    if (roomRef.current) {
      const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone)
      if (pub?.track) {
        if (micEnabled) pub.mute()
        else pub.unmute()
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

  // ── Clear chat ──
  const clearChat = useCallback(() => {
    setMessages([])
    setProducts([])
    setCartState(null)
    setStageContent('welcome')
    setHighlightedProductId(null)
  }, [])

  // ── Data channel handler (called from VoiceBridge) ──
  const handleAgentData = useCallback((payload: Uint8Array) => {
    try {
      const event = JSON.parse(new TextDecoder().decode(payload))
      const type = event.type as string

      if (type === 'products_found') {
        const prods = event.products as ProductDetail[]
        setProducts(prods)
        setStageContent('products')
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
    }),
    [
      voiceState, voiceConnected, voiceConnecting,
      messages, products, cartState, stageContent, highlightedProductId,
      connectVoice, disconnectVoice, sendTextMessage, sendUiAction,
      clearChat, setStageContent,
      micEnabled, speakerEnabled, toggleMic, toggleSpeaker,
      isTextLoading, roomName,
    ],
  )

  // ── Render ─────────────────────────────────
  if (!shouldConnect || !token || !serverUrl) {
    // Text-only mode — same context, same state, just no LiveKit
    return (
      <VoiceContext.Provider value={value}>
        {children}
      </VoiceContext.Provider>
    )
  }

  // Voice mode — wrap in LiveKitRoom + bridge
  return (
    <VoiceContext.Provider value={value}>
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
        />
        {children}
      </LiveKitRoom>
    </VoiceContext.Provider>
  )
}

// ═══════════════════════════════════════════
// VoiceBridge — syncs LiveKit state to parent
// No children — just hooks + effects
// ═══════════════════════════════════════════

function VoiceBridge({
  roomRef,
  setVoiceState,
  onAgentData,
}: {
  roomRef: React.MutableRefObject<any>
  setVoiceState: (state: VoiceState) => void
  onAgentData: (payload: Uint8Array) => void
}) {
  const room = useRoomContext()
  const { state: agentState } = useVoiceAssistant()
  const connectionState = useConnectionState()

  // ── Sync room ref to parent ──
  useEffect(() => {
    roomRef.current = room
    return () => {
      roomRef.current = null
    }
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
    // Connected — map agent state
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

    const handleData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: DataPacket_Kind,
    ) => {
      onAgentData(payload)
    }

    room.on(RoomEvent.DataReceived, handleData)
    return () => {
      room.off(RoomEvent.DataReceived, handleData)
    }
  }, [room, onAgentData])

  return null // Bridge renders nothing
}
