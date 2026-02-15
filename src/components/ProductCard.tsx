'use client'

import { useState } from 'react'
import { Package, Truck, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import type { ProductDetail } from '@/types'

interface Props {
  product: ProductDetail
  compact?: boolean
}

export function ProductCard({ product, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false)

  const mainImage = product.images[0]
  const tagColors: Record<string, string> = {
    "valentine's day": 'bg-pink-500/15 text-pink-300 border-pink-500/20',
    birthday: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    anniversary: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    wedding: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    'any occasion': 'bg-brand-500/15 text-brand-300 border-brand-500/20',
  }

  function getTagColor(tag: string): string {
    const lower = tag.toLowerCase()
    for (const [key, value] of Object.entries(tagColors)) {
      if (lower.includes(key)) return value
    }
    return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)]'
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden hover:border-brand-500/30 transition-colors">
      {/* Image */}
      {mainImage && !compact && (
        <div className="relative h-36 bg-[var(--bg-tertiary)] overflow-hidden">
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {product.hasDiscount && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-500/90 text-white text-[10px] font-semibold">
              SALE
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-semibold leading-tight mb-1 line-clamp-2">
          {product.title}
        </h3>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-brand-400">
            {product.priceRange}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
            <Package className="w-3 h-3" />
            {product.totalStock > 0
              ? `${product.totalStock} in stock`
              : 'Out of stock'}
          </div>
        </div>

        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {product.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Vendor */}
        {product.vendor && (
          <p className="text-[10px] text-[var(--text-secondary)] mb-2">
            by {product.vendor}
          </p>
        )}

        {/* Expand variants */}
        {product.variants.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {product.variants.length} variant
            {product.variants.length > 1 ? 's' : ''}
          </button>
        )}

        {/* Variant details */}
        {expanded && (
          <div className="mt-2 space-y-1.5">
            {product.variants.map((v) => (
              <div
                key={v.variantId}
                className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[11px]"
              >
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-brand-400 font-medium">
                    ${v.price.toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--text-secondary)]">
                  {v.sku && <span>SKU: {v.sku}</span>}
                  <span>Stock: {v.inventoryQuantity}</span>
                  {v.deliveryTime && (
                    <span className="flex items-center gap-0.5">
                      <Truck className="w-2.5 h-2.5" />
                      {v.deliveryTime}
                    </span>
                  )}
                  {v.availableRegions && (
                    <span className="flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" />
                      {v.availableRegions}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
