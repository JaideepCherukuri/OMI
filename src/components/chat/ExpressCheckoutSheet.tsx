'use client'

/**
 * ExpressCheckoutSheet — Bottom sheet overlay for in-app Shopify checkout.
 *
 * Design: Slides up from the bottom (60% desktop / 70% mobile), contains
 * the checkout inline via iframe. HALO Design System styled.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion'
import { X, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExpressCheckoutSheetProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl: string | null
  jwt: string | null
  productTitle?: string | null
  shopName?: string | null
  onCheckoutComplete?: (orderData?: any) => void
}

export default function ExpressCheckoutSheet({
  isOpen,
  onClose,
  checkoutUrl,
  jwt,
  productTitle,
  shopName,
  onCheckoutComplete,
}: ExpressCheckoutSheetProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeFailed, setIframeFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dragControls = useDragControls()

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false)
      setIframeFailed(false)
    }
  }, [isOpen])

  // Iframe timeout — 8s fallback
  useEffect(() => {
    if (!isOpen || iframeFailed || iframeLoaded || !checkoutUrl) return
    const timer = setTimeout(() => {
      if (!iframeLoaded) setIframeFailed(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [isOpen, iframeFailed, iframeLoaded, checkoutUrl])

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Listen for postMessage from Shopify checkout
  useEffect(() => {
    if (!isOpen) return
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'checkout:complete' || data?.type === 'checkout_completed') {
          onCheckoutComplete?.(data)
        }
        if (data?.type === 'checkout:close') {
          onClose()
        }
      } catch {
        // Ignore non-JSON messages
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isOpen, onClose, onCheckoutComplete])

  // Build the final checkout URL with JWT if available
  const finalCheckoutUrl = checkoutUrl
    ? jwt
      ? `${checkoutUrl}${checkoutUrl.includes('?') ? '&' : '?'}auth=${encodeURIComponent(jwt)}`
      : checkoutUrl
    : null

  // Handle drag-to-dismiss
  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 300) {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-[61]',
              'bg-[var(--card)] rounded-t-[calc(var(--radius)*2)] overflow-hidden',
              'border-t border-x border-[var(--border)]',
              'shadow-2xl font-sans',
              'h-[70vh] md:h-[60vh]',
            )}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-[var(--muted-foreground)]/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border)]">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--card-foreground)] uppercase tracking-[0.12em] font-mono truncate">
                  ⚡ Express Checkout
                </h3>
                {productTitle && (
                  <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                    {productTitle}
                    {shopName ? ` · ${shopName}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors flex-shrink-0"
                aria-label="Close checkout"
              >
                <X size={18} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 h-[calc(100%-5rem)] relative">
              {/* Loading spinner */}
              {!iframeLoaded && !iframeFailed && finalCheckoutUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 size={28} className="text-[var(--brand)] animate-spin" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Loading secure checkout...
                  </p>
                </div>
              )}

              {/* Iframe checkout */}
              {finalCheckoutUrl && !iframeFailed && (
                <iframe
                  ref={iframeRef}
                  src={finalCheckoutUrl}
                  className={cn(
                    'w-full h-full border-0',
                    !iframeLoaded && 'opacity-0',
                  )}
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setIframeFailed(true)}
                  allow="payment"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
                />
              )}

              {/* Fallback: iframe failed or no URL */}
              {(iframeFailed || !finalCheckoutUrl) && (
                <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                  {!finalCheckoutUrl ? (
                    <>
                      <Loader2 size={28} className="text-[var(--brand)] animate-spin" />
                      <p className="text-sm text-[var(--muted-foreground)] text-center">
                        Preparing your checkout...
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-[var(--muted-foreground)] text-center">
                        Checkout couldn&apos;t load inline.
                      </p>
                      <a
                        href={finalCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium text-sm transition-all"
                      >
                        Open in new tab
                        <ExternalLink size={14} />
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bottom link */}
            {finalCheckoutUrl && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-[var(--card)] via-[var(--card)]/80 to-transparent">
                <a
                  href={finalCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                >
                  <span>Open in store →</span>
                </a>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
