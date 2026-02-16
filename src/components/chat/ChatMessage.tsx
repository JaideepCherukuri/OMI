'use client'

/**
 * ChatMessage — Renders a single message in the chat flow.
 *
 * Design ref: Shopify "Agentic Commerce":
 *  - User messages: right-aligned with light purple bubble
 *  - AI messages: left-aligned with purple ● dot, formatted text
 *  - System messages: centered, italic, small
 */

import React, { useMemo } from 'react'
import { Mic, Keyboard } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * Lightweight markdown-ish renderer for AI responses.
 * Handles: **bold**, *italic*, bullet lists, numbered lists.
 * No external dependency needed.
 */
function FormattedText({ text }: { text: string }) {
  const elements = useMemo(() => {
    // Split into lines for list detection
    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let currentList: string[] = []
    let listType: 'ul' | 'ol' | null = null

    const flushList = () => {
      if (currentList.length > 0 && listType) {
        const Tag = listType
        const items = currentList.map((item, i) => (
          <li key={i} className="mb-1">{renderInline(item)}</li>
        ))
        result.push(
          <Tag key={`list-${result.length}`} className={`${listType === 'ul' ? 'list-disc' : 'list-decimal'} ml-4 mt-1 mb-2 space-y-0.5`}>
            {items}
          </Tag>
        )
        currentList = []
        listType = null
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Bullet list: "- text", "* text", "• text"
      const bulletMatch = line.match(/^[-*•]\s+(.+)/)
      if (bulletMatch) {
        if (listType !== 'ul') flushList()
        listType = 'ul'
        currentList.push(bulletMatch[1])
        continue
      }

      // Numbered list: "1. text", "2. text"
      const numMatch = line.match(/^\d+[.)]\s+(.+)/)
      if (numMatch) {
        if (listType !== 'ol') flushList()
        listType = 'ol'
        currentList.push(numMatch[1])
        continue
      }

      // Regular text
      flushList()
      if (line === '') {
        if (result.length > 0) {
          result.push(<br key={`br-${i}`} />)
        }
      } else {
        result.push(
          <span key={`p-${i}`}>
            {result.length > 0 && lines[i - 1]?.trim() !== '' ? ' ' : ''}
            {renderInline(line)}
          </span>
        )
      }
    }

    flushList()
    return result
  }, [text])

  return <>{elements}</>
}

/**
 * Renders inline markdown: **bold**, *italic*
 */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Pattern: **bold** or *italic* (non-greedy)
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      // **bold**
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-gray-900">
          {match[1]}
        </strong>
      )
    } else if (match[2]) {
      // *italic*
      parts.push(
        <em key={`i-${match.index}`}>{match[2]}</em>
      )
    }

    lastIndex = regex.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
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

  // AI messages — left-aligned with ● dot, formatted text
  return (
    <div className="flex items-start gap-2.5 py-1.5 max-w-[90%]">
      {/* Purple dot indicator */}
      <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0 mt-2" />

      {/* Message text with markdown rendering */}
      <div className="text-sm text-gray-700 leading-relaxed">
        <FormattedText text={msg.content} />
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}

/**
 * ThinkingIndicator — Pulsing dots shown while waiting for AI response.
 */
export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0 mt-2" />
      <div className="flex items-center gap-1 py-2 px-1">
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
