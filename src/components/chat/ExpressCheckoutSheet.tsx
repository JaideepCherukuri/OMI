'use client'

/**
 * ExpressCheckoutSheet — Bottom sheet overlay for in-app Shopify checkout.
 *
 * Uses Shopify's official Checkout Kit `<shopify-checkout>` web component
 * (loaded via CDN in layout.tsx). Attempts inline mode first (with JWT auth),
 * falling back to popup mode if inline fails or auth is unavailable.
 *
 * Design: Slides up from the bottom (60% desktop / 70% mobile), with
 * drag-to-dismiss. HALO Design System styled.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion'
import { X, ExternalLink, Loader2, ShoppingBag, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types for the Shopify Checkout Kit web component                   */
/* ------------------------------------------------------------------ */

interface ShopifyCheckoutElement extends HTMLElement {
  src: string
  auth: string
  target: 'auto' | 'popup' | 'inline'
  orderConfirmation?: { orderId?: string; [key: string]: unknown }
  open(): void
  close(): void
  focus(): void
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ExpressCheckoutSheetProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl: string | null
  jwt: string | null
  productTitle?: string | null
  shopName?: string | null
  onCheckoutComplete?: (orderData?: any) => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ExpressCheckoutSheet({
  isOpen,
  onClose,
  checkoutUrl,
  jwt,
  productTitle,
  shopName,
  onCheckoutComplete,
}: ExpressCheckoutSheetProps) {
  const [mode, setMode] = useState<'loading' | 'inline' | 'popup' | 'fallback' | 'complete'>('loading')
  const [isReady, setIsReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const checkoutElRef = useRef<ShopifyCheckoutElement | null>(null)
  const dragControls = useDragControls()

  /* ---- Reset state when sheet opens/closes ---- */
  useEffect(() => {
    if (isOpen) {
      setMode('loading')
      setIsReady(false)
    } else {
      // Cleanup: remove the element when sheet closes
      if (checkoutElRef.current) {
        try { checkoutElRef.current.close() } catch { /* noop */ }
        checkoutElRef.current.remove()
        checkoutElRef.current = null
      }
    }
  }, [isOpen])

  /* ---- Mount <shopify-checkout> when open + URL ready ---- */
  useEffect(() => {
    if (!isOpen || !checkoutUrl || !containerRef.current) return

    // Wait for the web component to be defined (CDN loaded)
    const waitForComponent = async (): Promise<boolean> => {
      // Check if already defined
      if (customElements.get('shopify-checkout')) return true
      // Wait up to 5s
      try {
        await Promise.race([
          customElements.whenDefined('shopify-checkout'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ])
        return true
      } catch {
        return false
      }
    }

    let cancelled = false

    const init = async () => {
      const componentReady = await waitForComponent()

      if (cancelled) return

      if (!componentReady) {
        // CDN didn't load — fall back to external link
        console.warn('[ExpressCheckout] shopify-checkout web component not available, using fallback')
        setMode('fallback')
        return
      }

      // Create the element
      const el = document.createElement('shopify-checkout') as ShopifyCheckoutElement
      el.src = checkoutUrl

      // Try inline mode if we have JWT
      if (jwt) {
        el.auth = jwt
        el.target = 'inline'

        // Style for inline embed
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.display = 'block'
      } else {
        // No JWT — use popup mode
        el.target = 'popup'
      }

      // Event listeners
      el.addEventListener('checkout:complete', ((event: Event) => {
        const target = event.target as ShopifyCheckoutElement
        setMode('complete')
        onCheckoutComplete?.(target.orderConfirmation ?? {})
        // Auto-close after brief celebration
        setTimeout(() => { if (!cancelled) onClose() }, 2500)
      }) as EventListener)

      el.addEventListener('checkout:close', (() => {
        if (!cancelled) onClose()
      }) as EventListener)

      // Mount into container
      if (containerRef.current && !cancelled) {
        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(el)
        checkoutElRef.current = el

        if (jwt && el.target === 'inline') {
          // Inline renders immediately
          setMode('inline')
          // Give it a moment to render, then mark ready
          setTimeout(() => { if (!cancelled) setIsReady(true) }, 800)
        } else {
          // Popup mode — open the popup
          setMode('popup')
          setIsReady(true)
          try {
            el.open()
          } catch (err) {
            console.warn('[ExpressCheckout] popup open failed:', err)
            setMode('fallback')
          }
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [isOpen, checkoutUrl, jwt, onCheckoutComplete, onClose])

  /* ---- Timeout: if inline doesn't render in 10s, fall back ---- */
  useEffect(() => {
    if (mode !== 'inline' || isReady) return
    const timer = setTimeout(() => {
      if (!isReady) {
        console.warn('[ExpressCheckout] inline mode timed out, falling back')
        // Try popup as fallback
        if (checkoutElRef.current) {
          try {
            checkoutElRef.current.target = 'popup'
            checkoutElRef.current.open()
            setMode('popup')
            setIsReady(true)
          } catch {
            setMode('fallback')
          }
        } else {
          setMode('fallback')
        }
      }
    }, 10000)
    return () => clearTimeout(timer)
  }, [mode, isReady])

  /* ---- Escape key ---- */
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

  /* ---- Drag-to-dismiss ---- */
  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 300) {
        onClose()
      }
    },
    [onClose],
  )

  /* ---- Open in popup (manual trigger) ---- */
  const handleOpenPopup = useCallback(() => {
    if (checkoutElRef.current) {
      try {
        checkoutElRef.current.target = 'popup'
        checkoutElRef.current.open()
        setMode('popup')
      } catch {
        // Last resort: open URL directly
        if (checkoutUrl) window.open(checkoutUrl, '_blank')
      }
    } else if (checkoutUrl) {
      window.open(checkoutUrl, '_blank')
    }
  }, [checkoutUrl])

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
              'flex flex-col',
            )}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--muted-foreground)]/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-[var(--border)] flex-shrink-0">
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

            {/* Content area */}
            <div className="flex-1 relative overflow-hidden">

              {/* Loading state */}
              {mode === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 size={28} className="text-[var(--brand)] animate-spin" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Loading secure checkout…
                  </p>
                </div>
              )}

              {/* Inline mode: web component renders here */}
              {mode === 'inline' && !isReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 size={28} className="text-[var(--brand)] animate-spin" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Preparing checkout…
                  </p>
                </div>
              )}

              {/* Container for <shopify-checkout> element */}
              <div
                ref={containerRef}
                className={cn(
                  'w-full h-full',
                  mode === 'inline' && isReady ? 'opacity-100' : 'opacity-0',
                  'transition-opacity duration-300',
                )}
              />

              {/* Popup mode: show confirmation that popup opened */}
              {mode === 'popup' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                  <ShoppingBag size={36} className="text-[var(--brand)]" />
                  <div className="text-center space-y-2">
                    <p className="text-base font-semibold text-[var(--card-foreground)]">
                      Checkout opened in a popup
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Complete your purchase in the checkout window.
                      {productTitle ? ` Buying: ${productTitle}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenPopup}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium text-sm transition-all"
                  >
                    Reopen checkout
                    <ExternalLink size={14} />
                  </button>
                </div>
              )}

              {/* Fallback: direct link */}
              {mode === 'fallback' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
                  <p className="text-sm text-[var(--muted-foreground)] text-center">
                    Checkout couldn&apos;t load inline.
                  </p>
                  {checkoutUrl && (
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium text-sm transition-all"
                    >
                      Open checkout
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}

              {/* Complete state */}
              {mode === 'complete' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  >
                    <CheckCircle2 size={48} className="text-emerald-500" />
                  </motion.div>
                  <p className="text-base font-semibold text-[var(--card-foreground)]">
                    Order confirmed! 🎉
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)] text-center">
                    Your purchase is on its way.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom link — shown for inline & fallback modes */}
            {checkoutUrl && mode !== 'complete' && (
              <div className="flex-shrink-0 p-2 border-t border-[var(--border)]/50 bg-[var(--card)]">
                <a
                  href={checkoutUrl}
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
