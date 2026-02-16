'use client'

import type { VoiceState } from '@/types'
import clsx from 'clsx'

interface OrbProps {
  state: VoiceState
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
}

const SIZE_MAP = { sm: 'w-8 h-8', md: 'w-16 h-16', lg: 'w-28 h-28' }

export default function Orb({ state, size = 'md', onClick, className }: OrbProps) {
  const sizeClass = SIZE_MAP[size]

  const stateStyles: Record<VoiceState, string> = {
    disconnected: 'bg-gray-300 opacity-50',
    connecting: 'bg-gradient-to-br from-purple-400 to-purple-600 animate-pulse',
    idle: 'bg-gradient-to-br from-purple-400 to-purple-700 animate-orb-breathe',
    listening: 'bg-gradient-to-br from-purple-500 to-violet-600 animate-orb-listen',
    thinking: 'bg-gradient-to-br from-purple-500 to-indigo-600 animate-orb-think',
    speaking: 'bg-gradient-to-br from-purple-400 to-fuchsia-600 animate-orb-speak',
  }

  const glowStyles: Record<VoiceState, string> = {
    disconnected: '',
    connecting: 'shadow-lg shadow-purple-300/30',
    idle: 'shadow-lg shadow-purple-400/20',
    listening: 'shadow-xl shadow-purple-500/40',
    thinking: 'shadow-xl shadow-indigo-400/30',
    speaking: 'shadow-xl shadow-fuchsia-400/40',
  }

  const stateLabels: Record<VoiceState, string> = {
    disconnected: 'Voice disconnected',
    connecting: 'Connecting...',
    idle: 'Listening — tap to speak',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
  }

  return (
    <button
      onClick={onClick}
      aria-label={stateLabels[state]}
      className={clsx(
        'relative rounded-full transition-all duration-500',
        sizeClass,
        stateStyles[state],
        glowStyles[state],
        onClick && 'cursor-pointer hover:scale-105',
        className
      )}
    >
      {/* Inner glow */}
      <div className="absolute inset-2 rounded-full bg-white/20 blur-sm" />

      {/* Ring effect for listening */}
      {state === 'listening' && (
        <div className="absolute inset-0 rounded-full border-2 border-purple-400/40 animate-orb-ring" />
      )}
    </button>
  )
}
