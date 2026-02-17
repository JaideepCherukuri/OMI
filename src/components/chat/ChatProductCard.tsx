'use client'

/**
 * ChatProductCard — HALO Design System styled product card.
 *
 * Design: HALO tokens for colors, radius, shadows.
 *  - Card: var(--card) bg, var(--border) border, var(--radius) corners
 *  - "Buy now": var(--brand) bg (Forest), var(--brand-foreground) text
 *  - "Add to cart": outlined with var(--border)
 *  - Global badge: keep emerald green (distinctive)
 *  - Stars: keep amber (neutral across palettes)
 */

import { useState } from 'react'
import type { ProductDetail, VariantDetail } from '@/types'
import { ShoppingCart, Star, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatProductCardProps {
  product: ProductDetail
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
  onBuyNow?: (product: ProductDetail, variant?: VariantDetail) => void
  onProductClick?: (product: ProductDetail) => void
  isHighlighted?: boolean
  compact?: boolean
  staggerIndex?: number
}

export default function ChatProductCard({
  product,
  onAddToCart,
  onBuyNow,
  onProductClick,
  isHighlighted,
  compact,
  staggerIndex = 0,
}: ChatProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const image = product.images?.[0]
  const defaultVariant = product.variants[0]
  const price = defaultVariant
    ? `$${defaultVariant.price.toFixed(2)}`
    : product.priceRange
  const subtitle = defaultVariant?.name !== 'Default Title'
    ? defaultVariant?.name
    : product.variants.length > 1
      ? `${product.variants.length} variants`
      : undefined

  const rating = product.tags?.includes('bestseller') ? 4.8 : 4.5 + (product.productId % 5) * 0.1

  return (
    <div
      className={cn(
        'animate-fadeInUp bg-[var(--card)] rounded-[var(--radius)] overflow-hidden border transition-all duration-200 font-sans',
        compact ? 'w-[220px] flex-shrink-0' : 'w-[240px] flex-shrink-0',
        isHighlighted
          ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30 shadow-lg shadow-[var(--accent)]/10'
          : 'border-[var(--border)] shadow-sm hover:shadow-md hover:-translate-y-0.5',
      )}
      style={{
        animationDelay: `${staggerIndex * 80}ms`,
        animationFillMode: 'both',
      }}
    >
      {/* Image with action buttons overlay */}
      <div
        className="relative aspect-square bg-[var(--muted)]/20 cursor-pointer group"
        onClick={() => onProductClick?.(product)}
      >
        {image && (
          <img
            src={image}
            alt={product.title}
            className={cn(
              'w-full h-full object-cover transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-[var(--muted)]/30 animate-pulse" />
        )}

        {/* Badges */}
        {product.isGlobal ? (
          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Shopify Catalog
          </span>
        ) : product.hasDiscount ? (
          <span className="absolute top-2 left-2 bg-[var(--destructive)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Sale
          </span>
        ) : null}

        {/* Dual action buttons */}
        <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 opacity-100">
          {product.isGlobal && product.directCheckoutUrl ? (
            <>
              <a
                href={product.directCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#5A31F4] hover:bg-[#4926c7] text-white text-xs font-medium rounded-[var(--radius)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-3.5h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
                Shop Pay
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (product.directCheckoutUrl) {
                    window.open(product.directCheckoutUrl, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="flex items-center gap-1 py-1.5 px-3 bg-[var(--card)]/95 hover:bg-[var(--card)] text-[var(--foreground)] text-xs font-medium rounded-[var(--radius)] border border-[var(--border)] transition-colors"
              >
                <ExternalLink size={12} />
                <span>Visit shop</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onBuyNow?.(product, defaultVariant)
                }}
                className="flex-1 py-1.5 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] text-xs font-medium rounded-[var(--radius)] transition-all"
              >
                Buy now
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToCart?.(product, defaultVariant)
                }}
                className="flex items-center gap-1 py-1.5 px-3 bg-[var(--card)]/95 hover:bg-[var(--card)] text-[var(--foreground)] text-xs font-medium rounded-[var(--radius)] border border-[var(--border)] transition-colors"
              >
                <ShoppingCart size={12} />
                <span>Add to cart</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4
          className="font-semibold text-sm text-[var(--card-foreground)] line-clamp-2 cursor-pointer hover:text-[var(--accent)] transition-colors leading-tight"
          onClick={() => onProductClick?.(product)}
        >
          {product.title}
        </h4>

        {subtitle && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subtitle}</p>
        )}

        <p className="text-sm font-bold text-[var(--card-foreground)] mt-1.5">{price}</p>

        {/* Store name + rating */}
        <div className="flex items-center justify-between mt-1.5">
          {product.isGlobal && product.shopName ? (
            <span className="text-[11px] text-emerald-600 font-medium truncate flex items-center gap-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {product.shopName}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--muted-foreground)] truncate">
              {product.vendor || 'Store'}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <Star size={11} className="text-amber-400 fill-amber-400" />
            <span className="text-[11px] text-[var(--muted-foreground)] font-medium">
              {rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
