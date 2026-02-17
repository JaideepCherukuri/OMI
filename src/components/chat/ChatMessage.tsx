'use client'

/**
 * ChatMessage — HALO Design System styled chat message.
 *
 * Design: olive/forest palette, PP Neue Montreal typography.
 *  - User messages: right-aligned with sage/olive bubble
 *  - AI messages: left-aligned with olive ● dot, formatted text
 *  - System messages: centered, muted
 */

import React, { useMemo } from 'react'
import Image from 'next/image'
import { Mic, Keyboard } from 'lucide-react'
import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * Lightweight markdown-ish renderer for AI responses.
 * Handles: **bold**, *italic*, bullet lists, numbered lists.
 */
function FormattedText({ text }: { text: string }) {
  const elements = useMemo(() => {
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

      const bulletMatch = line.match(/^[-*•]\s+(.+)/)
      if (bulletMatch) {
        if (listType !== 'ul') flushList()
        listType = 'ul'
        currentList.push(bulletMatch[1])
        continue
      }

      const numMatch = line.match(/^\d+[.)]\s+(.+)/)
      if (numMatch) {
        if (listType !== 'ol') flushList()
        listType = 'ol'
        currentList.push(numMatch[1])
        continue
      }

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
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      parts.push(
        <strong key={`b-${match.index}`} className="font-semibold text-[var(--foreground)]">
          {match[1]}
        </strong>
      )
    } else if (match[2]) {
      parts.push(
        <em key={`i-${match.index}`}>{match[2]}</em>
      )
    }

    lastIndex = regex.lastIndex
  }

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
        <span className="text-xs text-[var(--muted-foreground)] italic font-mono uppercase tracking-wider">{msg.content}</span>
      </div>
    )
  }

  // User messages — right-aligned HALO bubble
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end items-start gap-2 py-1.5">
        <div className="max-w-[80%] bg-[var(--muted)]/30 dark:bg-white/5 border border-[var(--border)] rounded-[var(--radius)] rounded-tr-sm px-4 py-2.5">
          <p className="text-sm text-[var(--foreground)] leading-relaxed font-sans">
            {msg.content}
          </p>
        </div>
        {msg.source === 'voice' ? (
          <Mic className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-2.5" />
        ) : (
          <Keyboard className="w-3.5 h-3.5 text-[var(--muted-foreground)] flex-shrink-0 mt-2.5" />
        )}
      </div>
    )
  }

  // AI messages — left-aligned with OMI mini logo
  return (
    <div className="flex items-start gap-2.5 py-1.5 max-w-[90%]">
      {/* OMI avatar */}
      <Image src="/omi-logo.png" alt="OMI" width={20} height={20} className="rounded-md flex-shrink-0 mt-1" />

      {/* Message text */}
      <div className="text-sm text-[var(--foreground)]/80 leading-relaxed font-sans">
        <FormattedText text={msg.content} />
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-[var(--accent)] ml-0.5 animate-pulse rounded-sm" />
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
      <Image src="/omi-logo.png" alt="OMI" width={20} height={20} className="rounded-md flex-shrink-0 mt-1" />
      <div className="flex items-center gap-1 py-2 px-1">
        <div className="w-2 h-2 bg-[var(--accent)]/50 rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="w-2 h-2 bg-[var(--accent)]/50 rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="w-2 h-2 bg-[var(--accent)]/50 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}
