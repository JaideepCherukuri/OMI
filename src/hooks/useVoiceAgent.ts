'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Room, RoomEvent, ConnectionState, RemoteTrack, RemoteTrackPublication, RemoteParticipant, Track } from 'livekit-client'
import type { VoiceState, ProductDetail, CartState, AgentDataEvent } from '@/types'

interface UseVoiceAgentOptions {
  onProducts?: (products: ProductDetail[], query: string) => void
  onCartUpdate?: (cart: CartState) => void
  onCheckout?: (url: string) => void
  onTranscript?: (role: 'user' | 'assistant', text: string, isFinal: boolean) => void
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('disconnected')
  const [micEnabled, setMicEnabled] = useState(true)
  const [speakerEnabled, setSpeakerEnabled] = useState(true)
  const roomRef = useRef<Room | null>(null)

  const isConnected = voiceState !== 'disconnected' && voiceState !== 'connecting'

  const connect = useCallback(async () => {
    if (roomRef.current) return
    setVoiceState('connecting')

    try {
      const res = await fetch('/api/token')
      if (!res.ok) throw new Error('Failed to get token')
      const { serverUrl, participantToken } = await res.json()

      const room = new Room()
      roomRef.current = room

      // Data channel handler
      room.on(RoomEvent.DataReceived, (data: Uint8Array) => {
        try {
          const event: AgentDataEvent = JSON.parse(new TextDecoder().decode(data))
          switch (event.type) {
            case 'products_found':
              options.onProducts?.(event.products, event.query)
              break
            case 'cart_updated':
              options.onCartUpdate?.(event.cart)
              break
            case 'checkout_ready':
              options.onCheckout?.(event.url)
              break
          }
        } catch {}
      })

      // Connection state
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) setVoiceState('idle')
        else if (state === ConnectionState.Disconnected) {
          setVoiceState('disconnected')
          roomRef.current = null
        }
      })

      // Track subscribed - detect agent speaking
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          setVoiceState('speaking')
        }
      })

      room.on(RoomEvent.TrackUnsubscribed, () => {
        if (voiceState === 'speaking') setVoiceState('idle')
      })

      await room.connect(serverUrl, participantToken)
      await room.localParticipant.setMicrophoneEnabled(true)
      setVoiceState('idle')
    } catch (err) {
      console.error('Voice connect failed:', err)
      setVoiceState('disconnected')
      roomRef.current = null
    }
  }, [options, voiceState])

  const disconnect = useCallback(() => {
    roomRef.current?.disconnect()
    roomRef.current = null
    setVoiceState('disconnected')
  }, [])

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return
    const next = !micEnabled
    await roomRef.current.localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
  }, [micEnabled])

  const toggleSpeaker = useCallback(() => {
    if (!roomRef.current) return
    const next = !speakerEnabled
    roomRef.current.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => {
        if (pub.track) {
          (pub.track as any).setMuted?.(!next)
        }
      })
    })
    setSpeakerEnabled(next)
  }, [speakerEnabled])

  const sendTextToAgent = useCallback((text: string) => {
    if (!roomRef.current) return
    const data = JSON.stringify({ type: 'text_message', content: text })
    roomRef.current.localParticipant.publishData(new TextEncoder().encode(data), { reliable: true })
  }, [])

  const sendActionToAgent = useCallback((action: string, data?: Record<string, unknown>) => {
    if (!roomRef.current) return
    const payload = JSON.stringify({ type: 'user_action', action, ...data })
    roomRef.current.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { roomRef.current?.disconnect() }
  }, [])

  return {
    voiceState,
    isConnected,
    connect,
    disconnect,
    toggleMic,
    micEnabled,
    speakerEnabled,
    toggleSpeaker,
    sendTextToAgent,
    sendActionToAgent,
  }
}
