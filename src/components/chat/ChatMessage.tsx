'use client'

/**
 * ChatMessage — Renders a single message in the chat flow.
 *
 * Design ref: Shopify screenshots:
 *  - User messages: right-aligned with light purple bubble
 *  - AI messages: left-aligned with purple ● dot, no bubble
 *  - System messages: centered, italic, small
 *  - Supports rich content: product cards, cart widgets inline
 */

import { Mic, Keyboard } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'
import clsx from 'clsx'

interface ChatMessageProps {
  message: ChatMessageType
}

export default function ChatMessage({ message: msg }: ChatMessageProps) {
  // System messages
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-gray-400 italic">{msg.content}</span>
      </div>
    )
  }

  // User messages — right-aligned purple bubble
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end items-start gap-2 py-1.5">
        <div className="max-w-[80%] bg-purple-50 border border-purple-100 rounded-2xl rounded-tr-md px-4 py-2.5">
          <p className="text-sm text-gray-800 leading-relaxed">
            {msg.content}
          </p>
        </div>
        {msg.source === 'voice' ? (
          <Mic className="w-4 h-4 text-purple-400 flex-shrink-0 mt-2.5" />
        ) : (
          <Keyboard className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-2.5" />
        )}
      </div>
    )
  }

  // AI messages — left-aligned with ● dot
  return (
    <div className="flex items-start gap-2.5 py-1.5 max-w-[90%]">
      {/* Purple dot indicator */}
      <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0 mt-2" />

      {/* Message text */}
      <div>
        <p className="text-sm text-gray-700 leading-relaxed">
          {msg.content}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </p>
      </div>
    </div>
  )
}
