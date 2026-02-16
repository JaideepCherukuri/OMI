'use client'

import type { ChatMessage } from '@/types'
import { Mic, Keyboard } from 'lucide-react'
import clsx from 'clsx'

interface TranscriptStreamProps {
  messages: ChatMessage[]
  className?: string
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function TranscriptStream({ messages, className }: TranscriptStreamProps) {
  const recent = messages.slice(-20)

  return (
    <div className={clsx('overflow-y-auto text-xs space-y-1.5 p-2', className)}>
      {recent.map(msg => (
        <div
          key={msg.id}
          className={clsx(
            'flex gap-1.5',
            msg.role === 'user' ? 'justify-end' : 'justify-start',
            msg.role === 'system' && 'justify-center'
          )}
        >
          {msg.role !== 'user' && msg.role !== 'system' && (
            <span className="text-purple-400 font-medium">AI:</span>
          )}
          <span className={clsx(
            'max-w-[80%]',
            msg.role === 'user' ? 'text-gray-700' : msg.role === 'system' ? 'text-gray-400 italic' : 'text-gray-600'
          )}>
            {msg.content}
            {msg.streaming && <span className="animate-pulse">▊</span>}
          </span>
          {msg.role === 'user' && (
            msg.source === 'voice' ? <Mic className="w-3 h-3 text-purple-400 flex-shrink-0" /> : <Keyboard className="w-3 h-3 text-gray-300 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}
