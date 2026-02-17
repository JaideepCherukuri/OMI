'use client'

/**
 * Orb — CSS-based voice state indicator (used in header/chat mode).
 * The Three.js Orb3D is used in pre-chat mode; this simpler one is for the header.
 */

import type { VoiceState } from '@/types'
import { cn } from '@/lib/utils'

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
    disconnected: 'bg-[var(--muted)] opacity-50',
    connecting: 'bg-gradient-to-br from-olive to-brand-green animate-pulse',
    idle: 'bg-gradient-to-br from-olive to-forest animate-orb-breathe',
    listening: 'bg-gradient-to-br from-olive to-brand-green animate-orb-listen',
    thinking: 'bg-gradient-to-br from-brand-green to-forest animate-orb-think',
    speaking: 'bg-gradient-to-br from-olive to-sage-light animate-orb-speak',
  }

  const glowStyles: Record<VoiceState, string> = {
    disconnected: '',
    connecting: 'shadow-lg shadow-olive/30',
    idle: 'shadow-lg shadow-olive/20',
    listening: 'shadow-xl shadow-olive/40',
    thinking: 'shadow-xl shadow-brand-green/30',
    speaking: 'shadow-xl shadow-olive/40',
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
      className={cn(
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
        <div className="absolute inset-0 rounded-full border-2 border-olive/40 animate-orb-ring" />
      )}
    </button>
  )
}
