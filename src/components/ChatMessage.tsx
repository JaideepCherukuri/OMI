'use client'

import type { ChatMessage as ChatMessageType, ProductDetail, VariantDetail } from '@/types'
import ProductCarousel from './ProductCarousel'
import { ExternalLink, Mic, Keyboard } from 'lucide-react'

interface ChatMessageProps {
  message: ChatMessageType
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
}

export default function ChatMessage({ message, onAddToCart }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  // Source indicator
  const sourceIcon = message.source === 'voice'
    ? <Mic className="w-3 h-3 text-purple-400 inline ml-1" />
    : message.source === 'text'
    ? <Keyboard className="w-3 h-3 text-gray-400 inline ml-1" />
    : null

  if (isSystem) {
    return (
      <div className="text-center my-2">
        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{message.content}</span>
      </div>
    )
  }

  // Clean internal data from message content (client-side safety net)
  let displayContent = message.content
  displayContent = displayContent.replace(/\(variantId[^)]*\)/gi, '')
  displayContent = displayContent.replace(/gid:\/\/shopify\/\w+\/\d+/g, '')
  displayContent = displayContent.replace(/<gid:\/\/[^>]+>/g, '')
  displayContent = displayContent.replace(/\[Products shown[^\]]*\]/gi, '')
  displayContent = displayContent.replace(/!\[[^\]]*\]\([^)]*\)/gi, '')

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-purple-600 text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          {displayContent}
          {message.streaming && <span className="animate-pulse ml-0.5">▊</span>}
          {sourceIcon}
        </div>

        {/* Product cards */}
        {message.products && message.products.length > 0 && (
          <div className="mt-2">
            <ProductCarousel products={message.products} onAddToCart={onAddToCart} />
          </div>
        )}

        {/* Cart state summary */}
        {message.cartState && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-sm font-medium text-green-800">
              🛒 Cart: {message.cartState.totalQuantity} item{message.cartState.totalQuantity !== 1 ? 's' : ''} — {message.cartState.currency} {message.cartState.totalAmount}
            </p>
            {message.cartState.checkoutUrl && (
              <a
                href={message.cartState.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 mt-1 underline"
              >
                Open Checkout <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Checkout URL without cart */}
        {!message.cartState && message.checkoutUrl && (
          <a
            href={message.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Open Checkout <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
