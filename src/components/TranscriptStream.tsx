'use client'

/**
 * TranscriptStream — Compact conversation transcript (PRD Section 3.4)
 *
 * "Below the Stage area. Compact messages (not full chat bubbles).
 *  User messages right-aligned, prefixed with 🎤 (voice) or ⌨️ (typed).
 *  Real-time streaming word-by-word."
 *
 * Unlike a traditional chat interface, this is a lightweight transcript
 * showing the conversation flow without heavy styling.
 */

import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types'
import { Mic, Keyboard } from 'lucide-react'
import clsx from 'clsx'

interface TranscriptStreamProps {
  messages: ChatMessage[]
  className?: string
}

export default function TranscriptStream({ messages, className }: TranscriptStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const recent = messages.slice(-30)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [recent.length])

  if (recent.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center h-full', className)}>
        <p className="text-xs text-gray-600">
          Conversation will appear here
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={clsx('overflow-y-auto text-xs space-y-2 py-2', className)}
    >
      {recent.map((msg) => (
        <TranscriptLine key={msg.id} message={msg} />
      ))}
    </div>
  )
}

function TranscriptLine({ message: msg }: { message: ChatMessage }) {
  // System messages: centered, italic
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-gray-500 italic text-[11px]">{msg.content}</span>
      </div>
    )
  }

  // User messages: right-aligned
  if (msg.role === 'user') {
    return (
      <div className="flex items-start gap-1.5 justify-end">
        <span className="text-gray-300 max-w-[85%] text-right leading-relaxed">
          {msg.content}
        </span>
        {msg.source === 'voice' ? (
          <Mic className="w-3 h-3 text-purple-400 flex-shrink-0 mt-0.5" />
        ) : (
          <Keyboard className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
        )}
      </div>
    )
  }

  // Assistant messages: left-aligned with AI: prefix
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-purple-400 font-medium flex-shrink-0">AI:</span>
      <span className="text-gray-400 max-w-[85%] leading-relaxed">
        {msg.content}
        {msg.streaming && <span className="animate-pulse ml-0.5">▊</span>}
      </span>
    </div>
  )
}
