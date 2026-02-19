'use client'

/**
 * ExpressCheckoutSheet — In-app checkout bottom sheet.
 *
 * Shows a clean checkout summary with product info, buyer details (from vault),
 * and a pre-filled checkout link. The actual Shopify checkout opens when the
 * buyer taps "Pay now" — pre-filled with their vault email/address so they
 * skip most manual entry.
 *
 * Architecture:
 *   1. Product data flows in from the parent (title, price, image, store).
 *   2. Vault data (if available) is used to build pre-filled checkout URL params.
 *   3. "Pay now" opens the checkout in a new tab with params pre-filled.
 *   4. On return, SaveProfilePrompt can offer to save new buyer data.
 *
 * When Shopify publishes the Checkout Kit npm package with real inline support,
 * or when Checkout MCP + ECP becomes available, this component can be upgraded
 * to render the checkout form directly inline.
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { motion, AnimatePresence, useDragControls, type PanInfo } from 'framer-motion'
import { X, ShoppingBag, ExternalLink, Shield, MapPin, Mail, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BuyerVaultProfile, BuyerAddress } from '@/types'

// ── Types ──

interface ProductInfo {
  title?: string
  price?: string | number
  image?: string
  shopName?: string
  shopDomain?: string
  variantId?: string | number
}

export interface ExpressCheckoutSheetProps {
  isOpen: boolean
  onClose: () => void
  checkoutUrl: string | null
  jwt: string | null
  productTitle?: string | null
  shopName?: string | null
  productInfo?: ProductInfo | null
  vaultProfile?: BuyerVaultProfile | null | undefined
  onCheckoutComplete?: (orderData?: any) => void
}

// ── Helpers ──

/**
 * Build a pre-filled checkout URL by appending buyer info as query params.
 * Shopify cart permalinks support: checkout[email], checkout[shipping_address][*]
 * See: https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks
 */
function buildPrefilledUrl(
  baseUrl: string,
  vault: BuyerVaultProfile | null | undefined,
): string {
  if (!vault) return baseUrl

  try {
    const url = new URL(baseUrl)
    if (vault.email) url.searchParams.set('checkout[email]', vault.email)
    if (vault.phone) url.searchParams.set('checkout[shipping_address][phone]', vault.phone)

    const addr: BuyerAddress | undefined = vault.addresses?.[0]
    if (addr) {
      url.searchParams.set('checkout[shipping_address][first_name]', addr.firstName || '')
      url.searchParams.set('checkout[shipping_address][last_name]', addr.lastName || '')
      url.searchParams.set('checkout[shipping_address][address1]', addr.streetAddress || '')
      url.searchParams.set('checkout[shipping_address][city]', addr.addressLocality || '')
      url.searchParams.set('checkout[shipping_address][province]', addr.addressRegion || '')
      url.searchParams.set('checkout[shipping_address][zip]', addr.postalCode || '')
      url.searchParams.set('checkout[shipping_address][country]', addr.addressCountry || '')
    }

    return url.toString()
  } catch {
    return baseUrl
  }
}

// ── Component ──

export default function ExpressCheckoutSheet({
  isOpen,
  onClose,
  checkoutUrl,
  jwt,
  productTitle,
  shopName,
  productInfo,
  vaultProfile,
  onCheckoutComplete,
}: ExpressCheckoutSheetProps) {
  const dragControls = useDragControls()
  const [checkoutOpened, setCheckoutOpened] = useState(false)
  const [status, setStatus] = useState<'summary' | 'opening' | 'waiting' | 'complete'>('summary')
  const returnCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Build pre-filled URL
  const prefilledUrl = useMemo(
    () => (checkoutUrl ? buildPrefilledUrl(checkoutUrl, vaultProfile) : null),
    [checkoutUrl, vaultProfile],
  )

  const hasVault = !!(vaultProfile?.email || (vaultProfile?.addresses && vaultProfile.addresses.length > 0))
  const addr: BuyerAddress | undefined = vaultProfile?.addresses?.[0]
  const displayPrice = productInfo?.price
    ? typeof productInfo.price === 'number'
      ? `$${productInfo.price.toFixed(2)}`
      : String(productInfo.price).startsWith('$')
        ? productInfo.price
        : `$${productInfo.price}`
    : null

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setStatus('summary')
      setCheckoutOpened(false)
    }
    return () => {
      if (returnCheckRef.current) clearInterval(returnCheckRef.current)
    }
  }, [isOpen])

  // Handle "Pay now" tap
  const handlePayNow = useCallback(() => {
    if (!prefilledUrl) return

    setStatus('opening')

    // Small delay for animation, then open checkout
    setTimeout(() => {
      window.open(prefilledUrl, '_blank')
      setStatus('waiting')
      setCheckoutOpened(true)
    }, 300)
  }, [prefilledUrl])

  // Drag to dismiss
  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 300) onClose()
    },
    [onClose],
  )

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

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
              'bg-[var(--card)] rounded-t-[20px] overflow-hidden',
              'border-t border-x border-[var(--border)]',
              'shadow-2xl font-sans',
              'max-h-[85vh] md:max-h-[70vh]',
              'flex flex-col',
            )}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 rounded-full bg-[var(--muted-foreground)]/40" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--card-foreground)] uppercase tracking-[0.1em] font-mono">
                  ⚡ Express Checkout
                </h3>
                {shopName && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{shopName}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--muted)]/30 transition-colors flex-shrink-0"
                aria-label="Close checkout"
              >
                <X size={18} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-[var(--border)] mx-5" />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Product Summary */}
              <div className="flex gap-3">
                {productInfo?.image && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--muted)] flex-shrink-0">
                    <img
                      src={productInfo.image}
                      alt={productTitle || 'Product'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--card-foreground)] line-clamp-2">
                    {productTitle || 'Product'}
                  </p>
                  {displayPrice && (
                    <p className="text-lg font-bold text-[var(--card-foreground)] mt-0.5">
                      {displayPrice}
                    </p>
                  )}
                </div>
              </div>

              {/* Buyer Info (from vault) */}
              {hasVault && (
                <div className="bg-[var(--muted)]/30 rounded-xl p-3.5 space-y-2.5 border border-[var(--border)]/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Using your saved info
                    </span>
                  </div>

                  {vaultProfile?.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-[var(--muted-foreground)] flex-shrink-0" />
                      <span className="text-sm text-[var(--card-foreground)]">{vaultProfile.email}</span>
                    </div>
                  )}

                  {addr && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-[var(--muted-foreground)] flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-[var(--card-foreground)]">
                        <p>{addr.firstName} {addr.lastName}</p>
                        <p className="text-[var(--muted-foreground)] text-xs">
                          {addr.streetAddress}, {addr.addressLocality}{addr.addressRegion ? `, ${addr.addressRegion}` : ''} {addr.postalCode}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info about pre-filled checkout */}
              {hasVault && (
                <p className="text-xs text-[var(--muted-foreground)] text-center">
                  Your email and shipping address will be pre-filled at checkout
                </p>
              )}

              {/* Waiting for completion */}
              {status === 'waiting' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-center"
                >
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Complete your purchase in the checkout tab
                  </p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                    Return here when you&apos;re done
                  </p>
                </motion.div>
              )}

              {/* Complete */}
              {status === 'complete' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-4"
                >
                  <CheckCircle2 size={40} className="text-emerald-500" />
                  <p className="text-base font-semibold text-[var(--card-foreground)]">
                    Order confirmed! 🎉
                  </p>
                </motion.div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex-shrink-0 px-5 pb-5 pt-2 space-y-2.5 border-t border-[var(--border)]/50 bg-[var(--card)]">
              {/* Pay Now button */}
              {status !== 'complete' && prefilledUrl && (
                <button
                  onClick={handlePayNow}
                  disabled={status === 'opening'}
                  className={cn(
                    'w-full flex items-center justify-center gap-2',
                    'py-3.5 px-6 rounded-xl font-semibold text-base',
                    'transition-all active:scale-[0.98]',
                    status === 'waiting'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90',
                    'disabled:opacity-50',
                  )}
                >
                  {status === 'opening' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Opening checkout…
                    </>
                  ) : status === 'waiting' ? (
                    <>
                      <ExternalLink size={16} />
                      Reopen checkout
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={18} />
                      {hasVault ? 'Pay now →' : 'Continue to checkout →'}
                    </>
                  )}
                </button>
              )}

              {/* "I finished" button when waiting */}
              {status === 'waiting' && (
                <button
                  onClick={() => {
                    setStatus('complete')
                    onCheckoutComplete?.({})
                    setTimeout(onClose, 2000)
                  }}
                  className="w-full py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
                >
                  I completed my purchase ✓
                </button>
              )}

              {/* Open in store link */}
              {checkoutUrl && status === 'summary' && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors py-1"
                >
                  Open in store <ChevronRight size={12} />
                </a>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
