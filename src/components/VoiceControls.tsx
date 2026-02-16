'use client'

import type { VoiceState } from '@/types'
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react'
import clsx from 'clsx'

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
          className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
          title={speakerEnabled ? 'Mute speaker' : 'Unmute speaker'}
        >
          {speakerEnabled
            ? <Volume2 className="w-5 h-5 text-gray-600" />
            : <VolumeX className="w-5 h-5 text-gray-400" />
          }
        </button>
      )}

      {/* Main mic button */}
      <button
        onClick={isConnected ? onToggleMic : onConnect}
        className={clsx(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all',
          isConnected && micEnabled
            ? 'bg-purple-600 text-white shadow-lg shadow-purple-300 animate-pulse'
            : isConnected
            ? 'bg-gray-300 text-gray-600'
            : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
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
          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
          title="End voice chat"
        >
          <PhoneOff className="w-5 h-5 text-red-500" />
        </button>
      )}
    </div>
  )
}
