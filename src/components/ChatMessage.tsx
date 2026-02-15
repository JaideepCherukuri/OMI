'use client'

import { Bot, User, ExternalLink } from 'lucide-react'
import type { ChatMessage as ChatMessageType, ProductDetail } from '@/types'
import { ProductCard } from './ProductCard'

function formatContent(content: string): string {
  // Convert markdown-like formatting to HTML
  let html = content
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    )
    // Line breaks
    .replace(/\n/g, '<br />')

  return html
}

interface Props {
  message: ChatMessageType
}

export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-3 animate-fade-in">
        <div className="px-4 py-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex gap-3 mb-4 animate-fade-in ${
        isUser ? 'flex-row-reverse' : ''
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
          isUser
            ? 'bg-brand-500/20 text-brand-400'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-600 text-white rounded-br-md'
              : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-md'
          }`}
        >
          <div
            className="chat-content"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
        </div>

        {/* Product cards */}
        {message.products && message.products.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {message.products.map((product) => (
              <ProductCard key={product.productId} product={product} />
            ))}
          </div>
        )}

        {/* Checkout link */}
        {message.checkoutUrl && (
          <a
            href={message.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
          >
            <ShoppingBagIcon />
            Complete Checkout
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Timestamp */}
        <div
          className={`text-[10px] text-[var(--text-secondary)]/50 mt-1 ${
            isUser ? 'text-right' : ''
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  )
}

function ShoppingBagIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
        <Bot className="w-4 h-4" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[var(--bg-secondary)] border border-[var(--border)]">
        <div className="flex gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}
