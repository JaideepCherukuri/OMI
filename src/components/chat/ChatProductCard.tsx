'use client'

/**
 * ChatProductCard — Shopify-style product card for inline chat display.
 *
 * Design ref: Shopify Agentic Commerce screenshots (Feb 2026)
 *  - White bg with subtle border/shadow
 *  - Product image (top)
 *  - Dual-action: "Buy now" (filled purple) + "Add to cart" (outlined)
 *  - Product name (bold), variant subtitle, price
 *  - Store name + star rating (bottom)
 *  - Click image/title → opens ProductDetailPanel
 */

import { useState } from 'react'
import type { ProductDetail, VariantDetail } from '@/types'
import { ShoppingCart, Star } from 'lucide-react'
import clsx from 'clsx'

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

  // Star rating (mockup — would come from Catalog MCP in production)
  const rating = product.tags?.includes('bestseller') ? 4.8 : 4.5 + (product.productId % 5) * 0.1

  return (
    <div
      className={clsx(
        'animate-fadeInUp bg-white rounded-xl overflow-hidden border transition-all duration-200',
        compact ? 'w-[220px] flex-shrink-0' : 'w-[240px] flex-shrink-0',
        isHighlighted
          ? 'border-purple-400 ring-2 ring-purple-200 shadow-lg shadow-purple-100/30'
          : 'border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5',
      )}
      style={{
        animationDelay: `${staggerIndex * 80}ms`,
        animationFillMode: 'both',
      }}
    >
      {/* Image with action buttons overlay */}
      <div
        className="relative aspect-square bg-gray-50 cursor-pointer group"
        onClick={() => onProductClick?.(product)}
      >
        {image && (
          <img
            src={image}
            alt={product.title}
            className={clsx(
              'w-full h-full object-cover transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        )}

        {/* Sale badge */}
        {product.hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Sale
          </span>
        )}

        {/* Dual action buttons — always visible on all screen sizes */}
        <div className="absolute bottom-2 left-2 right-2 flex gap-1.5 opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onBuyNow?.(product, defaultVariant)
            }}
            className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Buy now
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToCart?.(product, defaultVariant)
            }}
            className="flex items-center gap-1 py-1.5 px-3 bg-white/95 hover:bg-white text-gray-800 text-xs font-medium rounded-lg border border-gray-200 transition-colors"
          >
            <ShoppingCart size={12} />
            <span>Add to cart</span>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4
          className="font-semibold text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-purple-700 transition-colors leading-tight"
          onClick={() => onProductClick?.(product)}
        >
          {product.title}
        </h4>

        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        )}

        <p className="text-sm font-bold text-gray-900 mt-1.5">{price}</p>

        {/* Store name + rating */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-gray-400 truncate">
            {product.vendor || 'Store'}
          </span>
          <div className="flex items-center gap-0.5">
            <Star size={11} className="text-amber-400 fill-amber-400" />
            <span className="text-[11px] text-gray-500 font-medium">
              {rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
