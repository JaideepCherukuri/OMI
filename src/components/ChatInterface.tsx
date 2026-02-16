'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage as ChatMessageType, StoreCredentials, ProductDetail, CartState, VariantDetail } from '@/types'
import ChatMessage from './ChatMessage'
import CartPanel from './CartPanel'
import { Send, ShoppingCart, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface ChatInterfaceProps {
  credentials: StoreCredentials
  voiceProducts?: ProductDetail[]
  voiceCartState?: CartState | null
}

const SUGGESTIONS = [
  "💝 Valentine's Day gifts",
  "🎂 Birthday ideas",
  "💍 Wedding anniversary",
  "🎁 Gifts for her",
  "🔍 Show everything",
  "💰 Under $200",
]

export default function ChatInterface({ credentials, voiceProducts, voiceCartState }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! 👋 I'm GiftAI, your personal gift shopping assistant. I can help you find the perfect luxury gift for any occasion. What are you looking for today?",
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [cartId, setCartId] = useState<string | undefined>()
  const [cartState, setCartState] = useState<CartState | null>(null)
  const [showCart, setShowCart] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // Handle voice products coming in
  useEffect(() => {
    if (voiceProducts && voiceProducts.length > 0) {
      const msg: ChatMessageType = {
        id: `voice-products-${Date.now()}`,
        role: 'assistant',
        content: `Found ${voiceProducts.length} products for you:`,
        timestamp: Date.now(),
        source: 'voice',
        products: voiceProducts,
      }
      setMessages(prev => [...prev, msg])
    }
  }, [voiceProducts])

  // Handle voice cart updates
  useEffect(() => {
    if (voiceCartState) {
      setCartState(voiceCartState)
      setCartId(voiceCartState.cartId)
    }
  }, [voiceCartState])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      source: 'text',
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content,
        products: m.products,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          storeCredentials: credentials,
          history: history.slice(-12),
          cartId,
        }),
      })

      if (!res.ok) throw new Error('Chat API error')

      const data = await res.json()
      const assistantMsg: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || "I'm sorry, I couldn't process that. Could you try again?",
        timestamp: Date.now(),
        products: data.products,
        cartState: data.cartState,
        checkoutUrl: data.checkoutUrl,
      }
      setMessages(prev => [...prev, assistantMsg])

      if (data.cartState) {
        setCartState(data.cartState)
        setCartId(data.cartState.cartId)
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }, [credentials, loading, messages, cartId])

  const handleAddToCart = (product: ProductDetail, variant?: VariantDetail) => {
    const variantText = variant ? ` — ${variant.name}` : ''
    sendMessage(`Add ${product.title}${variantText} to my cart`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} onAddToCart={handleAddToCart} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s.replace(/^[^\w]+/, '').trim())}
              className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about gifts, occasions, or products..."
              className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-purple-300 focus:bg-white outline-none transition-colors"
              disabled={loading}
            />
          </div>

          {/* Cart badge */}
          {cartState && cartState.totalQuantity > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2.5 bg-purple-100 rounded-xl hover:bg-purple-200 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-purple-600" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {cartState.totalQuantity}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={clsx(
              'p-2.5 rounded-xl transition-colors',
              input.trim() && !loading
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Cart panel */}
      <CartPanel
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cartState={cartState}
      />
    </div>
  )
}
