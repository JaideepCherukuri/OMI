'use client'

/**
 * CheckoutModal — Embedded checkout overlay.
 *
 * Design ref: Shopify screenshots 5 & 6:
 *  - Modal overlay on top of chat
 *  - Store branding at top
 *  - Ship to, Shipping method, Payment, Pay now
 *  - Order confirmation with map
 *
 * In production, this would integrate Shopify's Checkout Kit:
 *   <shopify-checkout></shopify-checkout>
 *
 * For now, we use an iframe or redirect approach with the
 * Shopify checkout URL. When Checkout MCP access is available,
 * this becomes a fully embedded experience.
 */

import { useState, useEffect, useRef } from 'react'
import type { CartState } from '@/types'
import { X, ExternalLink, Lock } from 'lucide-react'
import clsx from 'clsx'

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

  // Reset iframe state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false)
      setUseIframe(true)
    }
  }, [isOpen])

  // Fallback: if iframe fails to load (CORS/X-Frame-Options), show redirect option
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {storeName || 'Checkout'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {checkoutUrl && useIframe ? (
              /* Embedded Checkout (iframe approach) */
              <div className="relative w-full h-[500px]">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">
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
              /* Fallback: Redirect approach */
              <div className="p-6 space-y-6">
                {/* Cart summary */}
                {cartState && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">
                      Order Summary
                    </h4>
                    {cartState.lines.map((line) => (
                      <div
                        key={line.lineId}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-3">
                          {line.imageUrl && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={line.imageUrl}
                                alt={line.productTitle}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {line.productTitle}
                            </p>
                            <p className="text-xs text-gray-500">
                              {line.variantTitle} × {line.quantity}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          ${line.price}
                        </p>
                      </div>
                    ))}

                    <div className="pt-3 border-t border-gray-100 flex justify-between">
                      <span className="font-medium text-gray-900">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {cartState.currency} ${cartState.totalAmount}
                      </span>
                    </div>
                  </div>
                )}

                {/* Secure checkout button */}
                <div className="space-y-3">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                  >
                    <Lock size={16} />
                    <span>Secure Checkout</span>
                    <ExternalLink size={14} />
                  </a>

                  <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                    <Lock size={10} />
                    You&apos;ll be taken to {storeName || 'the store'}&apos;s
                    secure checkout
                  </p>
                </div>
              </div>
            ) : (
              /* No checkout URL */
              <div className="p-8 text-center">
                <p className="text-gray-500">
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
