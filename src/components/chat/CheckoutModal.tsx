'use client'

/**
 * CheckoutModal — HALO Design System styled checkout overlay.
 * Handles: empty cart, valid checkout, iframe fallback, external link.
 */

import { useState, useEffect, useRef } from 'react'
import type { CartState } from '@/types'
import { X, ExternalLink, Lock, ShoppingBag, PackageOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl?: string | null
  storeName?: string
  cartState?: CartState | null
}

/** Check if a URL looks like a valid Shopify checkout URL */
function isValidCheckoutUrl(url?: string | null): url is string {
  if (!url || url.length < 15) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export default function CheckoutModal({
  isOpen,
  onClose,
  checkoutUrl,
  storeName,
  cartState,
}: CheckoutModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeFailed, setIframeFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false)
      setIframeFailed(false)
    }
  }, [isOpen])

  // Iframe timeout — if not loaded in 6s, show fallback
  useEffect(() => {
    if (!isOpen || iframeFailed || iframeLoaded) return
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setIframeFailed(true)
      }
    }, 6000)
    return () => clearTimeout(timer)
  }, [isOpen, iframeFailed, iframeLoaded])

  if (!isOpen) return null

  const isCartEmpty = !cartState || !cartState.lines || cartState.lines.length === 0
  const hasValidUrl = isValidCheckoutUrl(checkoutUrl)
  const showIframe = hasValidUrl && !iframeFailed

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
                {isCartEmpty ? 'Your Cart' : (storeName || 'Checkout')}
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
            {/* ── Empty Cart State ── */}
            {isCartEmpty && !hasValidUrl ? (
              <div className="p-10 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--muted)]/30 flex items-center justify-center">
                  <ShoppingBag size={28} className="text-[var(--muted-foreground)]" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-medium text-[var(--foreground)]">
                    Your cart is empty
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)] max-w-[260px]">
                    Start shopping by asking GiftAI for recommendations, then tap &quot;Add to Cart&quot; on any product.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-2.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium text-sm transition-all"
                >
                  Continue Shopping
                </button>
              </div>

            /* ── Iframe Checkout (valid URL, iframe not failed) ── */
            ) : showIframe ? (
              <div className="relative w-full h-[500px]">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[var(--muted-foreground)]">
                      Loading secure checkout...
                    </p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={checkoutUrl!}
                  className={cn("w-full h-full border-0", !iframeLoaded && "opacity-0")}
                  onLoad={() => setIframeLoaded(true)}
                  onError={() => setIframeFailed(true)}
                  allow="payment"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
                />
                {/* Always show "Open in new tab" fallback link */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-[var(--card)] to-transparent">
                  <a
                    href={checkoutUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <span>Having trouble? Open in new tab</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

            /* ── Fallback: Order Summary + External Checkout Link ── */
            ) : hasValidUrl ? (
              <div className="p-6 space-y-6">
                {/* Order summary if cart has items */}
                {cartState && cartState.lines.length > 0 && (
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
                    href={checkoutUrl!}
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

            /* ── Cart has items but no valid checkout URL ── */
            ) : cartState && cartState.lines.length > 0 ? (
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-[var(--foreground)]">
                    Your Items
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

                <div className="flex flex-col items-center gap-3 p-4 bg-[var(--muted)]/20 rounded-[var(--radius)]">
                  <PackageOpen size={24} className="text-[var(--muted-foreground)]" />
                  <p className="text-sm text-[var(--muted-foreground)] text-center">
                    Checkout is being prepared. Ask GiftAI to proceed with checkout, or continue shopping.
                  </p>
                </div>
              </div>

            /* ── Fallback: truly empty state ── */
            ) : (
              <div className="p-10 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--muted)]/30 flex items-center justify-center">
                  <ShoppingBag size={28} className="text-[var(--muted-foreground)]" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-medium text-[var(--foreground)]">
                    Your cart is empty
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)] max-w-[260px]">
                    Start shopping by asking GiftAI for recommendations, then tap &quot;Add to Cart&quot; on any product.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 px-5 py-2.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium text-sm transition-all"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
