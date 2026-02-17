'use client'

/**
 * CheckoutModal — HALO Design System styled checkout overlay.
 */

import { useState, useEffect, useRef } from 'react'
import type { CartState } from '@/types'
import { X, ExternalLink, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl?: string | null
  storeName?: string
  cartState?: CartState | null
}

export default function CheckoutModal({
  isOpen,
  onClose,
  checkoutUrl,
  storeName,
  cartState,
}: CheckoutModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [useIframe, setUseIframe] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false)
      setUseIframe(true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !useIframe) return
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setUseIframe(false)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [isOpen, useIframe, iframeLoaded])

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-[var(--card)] rounded-[var(--radius)] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--card-foreground)] uppercase tracking-[0.15em] font-mono">
                {storeName || 'Checkout'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
            >
              <X size={18} className="text-[var(--muted-foreground)]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {checkoutUrl && useIframe ? (
              <div className="relative w-full h-[500px]">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Loading checkout...
                    </p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={checkoutUrl}
                  className="w-full h-full border-0"
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setUseIframe(false)}
                  allow="payment"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
                />
              </div>
            ) : checkoutUrl ? (
              <div className="p-6 space-y-6">
                {cartState && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-[var(--foreground)]">
                      Order Summary
                    </h4>
                    {cartState.lines.map((line) => (
                      <div
                        key={line.lineId}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-3">
                          {line.imageUrl && (
                            <div className="w-10 h-10 rounded-[var(--radius)] overflow-hidden bg-[var(--muted)]/20">
                              <img
                                src={line.imageUrl}
                                alt={line.productTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {line.productTitle}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {line.variantTitle} × {line.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          ${line.price}
                        </p>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-[var(--border)] flex justify-between">
                      <span className="font-medium text-[var(--foreground)]">Total</span>
                      <span className="text-lg font-bold text-[var(--foreground)]">
                        {cartState.currency} ${cartState.totalAmount}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium transition-all"
                  >
                    <Lock size={16} />
                    <span>Secure Checkout</span>
                    <ExternalLink size={14} />
                  </a>

                  <p className="text-xs text-[var(--muted-foreground)] text-center flex items-center justify-center gap-1">
                    <Lock size={10} />
                    You&apos;ll be taken to {storeName || 'the store'}&apos;s
                    secure checkout
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-[var(--muted-foreground)]">
                  No checkout URL available. Add items to your cart first.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
