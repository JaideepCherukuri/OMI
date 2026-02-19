'use client'

/**
 * SaveProfilePrompt — Post-purchase vault save prompt.
 *
 * Small toast-style card at the bottom of chat. Asks if the user
 * wants to save their details for instant checkout next time.
 * Auto-dismisses after 15 seconds. HALO Design System styled.
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SaveProfilePromptProps {
  isVisible: boolean
  onSave: () => void
  onDismiss: () => void
}

export default function SaveProfilePrompt({
  isVisible,
  onSave,
  onDismiss,
}: SaveProfilePromptProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (isVisible) {
      timerRef.current = setTimeout(() => {
        onDismiss()
      }, 15000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isVisible, onDismiss])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm mx-auto px-4"
        >
          <div className="bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-lg p-3 font-sans">
            <p className="text-sm text-[var(--card-foreground)] mb-2.5">
              Save your details for instant checkout next time?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onSave}
                className="flex-1 py-1.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] text-xs font-medium rounded-[var(--radius)] transition-all"
              >
                Save
              </button>
              <button
                onClick={onDismiss}
                className="flex-1 py-1.5 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/50 text-[var(--muted-foreground)] text-xs font-medium rounded-[var(--radius)] transition-all"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
