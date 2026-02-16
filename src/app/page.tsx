'use client'

import { useState, useCallback } from 'react'
import ChatInterface from '@/components/ChatInterface'
import StoreSwapModal from '@/components/StoreSwapModal'
import VoiceControls from '@/components/VoiceControls'
import Orb from '@/components/Orb'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import type { StoreCredentials, ProductDetail, CartState } from '@/types'
import { Gift, ArrowLeftRight } from 'lucide-react'

const DEFAULT_STORE: StoreCredentials = {
  storeUrl: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL || 'jaguar-9969.myshopify.com',
  accessToken: process.env.NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN || '',
}

export default function HomePage() {
  const [credentials, setCredentials] = useState<StoreCredentials>(DEFAULT_STORE)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [voiceProducts, setVoiceProducts] = useState<ProductDetail[]>()
  const [voiceCartState, setVoiceCartState] = useState<CartState | null>(null)

  const voice = useVoiceAgent({
    onProducts: (products) => setVoiceProducts(products),
    onCartUpdate: (cart) => setVoiceCartState(cart),
    onCheckout: (url) => window.open(url, '_blank'),
  })

  const handleStoreSwap = useCallback((newCredentials: StoreCredentials) => {
    setCredentials(newCredentials)
    voice.disconnect()
  }, [voice])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          <h1 className="font-bold text-lg bg-gradient-to-r from-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
            GiftAI
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Voice state Orb (small, docked) */}
          {voice.voiceState !== 'disconnected' && (
            <Orb state={voice.voiceState} size="sm" />
          )}

          {/* Store indicator */}
          <button
            onClick={() => setShowStoreModal(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-600 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="hidden sm:inline">{credentials.storeUrl.split('.')[0]}</span>
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface
          key={credentials.storeUrl}
          credentials={credentials}
          voiceProducts={voiceProducts}
          voiceCartState={voiceCartState}
        />
      </main>

      {/* Voice controls bar */}
      <footer className="bg-white border-t px-4 py-2 flex justify-center">
        <VoiceControls
          voiceState={voice.voiceState}
          micEnabled={voice.micEnabled}
          speakerEnabled={voice.speakerEnabled}
          onToggleMic={voice.toggleMic}
          onToggleSpeaker={voice.toggleSpeaker}
          onConnect={voice.connect}
          onDisconnect={voice.disconnect}
        />
      </footer>

      {/* Store swap modal */}
      <StoreSwapModal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        onConnect={handleStoreSwap}
        currentStore={credentials.storeUrl}
      />
    </div>
  )
}
