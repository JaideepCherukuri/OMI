'use client'

/**
 * VoiceControls — HALO Design System styled voice control buttons.
 */

import type { VoiceState } from '@/types'
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceControlsProps {
  voiceState: VoiceState
  micEnabled: boolean
  speakerEnabled: boolean
  onToggleMic: () => void
  onToggleSpeaker: () => void
  onConnect: () => void
  onDisconnect: () => void
}

export default function VoiceControls({
  voiceState, micEnabled, speakerEnabled,
  onToggleMic, onToggleSpeaker, onConnect, onDisconnect,
}: VoiceControlsProps) {
  const isConnected = voiceState !== 'disconnected'

  return (
    <div className="flex items-center gap-3">
      {/* Speaker toggle */}
      {isConnected && (
        <button
          onClick={onToggleSpeaker}
          className="p-2 rounded-[var(--radius)] bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 transition-colors"
          title={speakerEnabled ? 'Mute speaker' : 'Unmute speaker'}
        >
          {speakerEnabled
            ? <Volume2 className="w-5 h-5 text-[var(--foreground)]" />
            : <VolumeX className="w-5 h-5 text-[var(--muted-foreground)]" />
          }
        </button>
      )}

      {/* Main mic button */}
      <button
        onClick={isConnected ? onToggleMic : onConnect}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all',
          isConnected && micEnabled
            ? 'bg-[var(--brand)] text-[var(--brand-foreground)] shadow-lg shadow-[var(--brand)]/30 animate-pulse'
            : isConnected
            ? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
            : 'bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30'
        )}
        title={isConnected ? (micEnabled ? 'Mute mic' : 'Unmute mic') : 'Start voice chat'}
      >
        {micEnabled && isConnected
          ? <Mic className="w-6 h-6" />
          : <MicOff className="w-6 h-6" />
        }
      </button>

      {/* End call */}
      {isConnected && (
        <button
          onClick={onDisconnect}
          className="p-2 rounded-[var(--radius)] bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          title="End voice chat"
        >
          <PhoneOff className="w-5 h-5 text-[var(--destructive)]" />
        </button>
      )}
    </div>
  )
}
