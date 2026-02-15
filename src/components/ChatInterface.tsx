'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Trash2 } from 'lucide-react'
import type { ChatMessage, StoreCredentials, AppMode, ChatResponse } from '@/types'
import { ChatMessageBubble, TypingIndicator } from './ChatMessage'

interface Props {
  mode: AppMode
  credentials: StoreCredentials
}

export function ChatInterface({ mode, credentials }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    // Add welcome message
    const welcome: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content:
        mode === 'admin'
          ? `Connected to **${credentials.storeUrl}**. I'm your store management assistant.\n\nI can help you:\n• View your product inventory\n• Create new products\n• Update prices, stock, and product details\n• Delete products\n\nWhat would you like to do?`
          : `Welcome to the gift store! 🎁\n\nI can help you:\n• **Browse** our luxury gift collection\n• **Get recommendations** by occasion, region, or budget\n• **Learn details** about any product\n• **Create a checkout** when you're ready to buy\n\nWhat are you looking for today?`,
      timestamp: Date.now(),
    }
    setMessages([welcome])
  }, [mode, credentials.storeUrl])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          mode,
          storeCredentials: credentials,
          history,
        }),
      })

      const data: ChatResponse & { error?: string } = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
        products: data.products,
        checkoutUrl: data.checkoutUrl,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function clearChat() {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'system',
        content: 'Chat cleared',
        timestamp: Date.now(),
      },
    ])
  }

  const suggestions =
    mode === 'admin'
      ? [
          'Show me all products',
          'What\'s the total inventory?',
          'Create a luxury perfume gift set',
          'Update all prices by 10%',
        ]
      : [
          'Recommend Valentine\'s gifts under $300',
          'What gifts ship to India?',
          'Show me birthday gift options',
          'I want to buy the Star Map',
        ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (show when few messages) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s)
                  inputRef.current?.focus()
                }}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-500/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <button
            onClick={clearChat}
            className="flex-shrink-0 p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'admin'
                  ? 'Manage your store...'
                  : 'Ask about gifts...'
              }
              rows={1}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-colors"
              style={{
                minHeight: '42px',
                maxHeight: '120px',
                height: 'auto',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 p-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
