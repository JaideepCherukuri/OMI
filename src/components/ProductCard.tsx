'use client'

import { useState } from 'react'
import type { ProductDetail, VariantDetail } from '@/types'
import { ShoppingCart, ChevronDown, ChevronUp, Package } from 'lucide-react'
import clsx from 'clsx'

interface ProductCardProps {
  product: ProductDetail
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
  isHighlighted?: boolean
  compact?: boolean
}

export default function ProductCard({ product, onAddToCart, isHighlighted, compact }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<VariantDetail | null>(null)

  const variant = selectedVariant || product.variants[0]
  const image = product.images?.[0]
  const description = product.descriptionHtml?.replace(/<[^>]+>/g, ' ').trim() || ''

  return (
    <div
      className={clsx(
        'product-card bg-white rounded-xl shadow-md overflow-hidden border',
        compact ? 'w-[260px] flex-shrink-0' : 'w-full',
        isHighlighted ? 'border-purple-400 ring-2 ring-purple-200' : 'border-gray-100'
      )}
    >
      {/* Image */}
      {image && (
        <div className="relative h-40 bg-gray-50">
          <img
            src={image}
            alt={product.title}
            className="w-full h-full object-cover"
          />
          {product.hasDiscount && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              Sale
            </span>
          )}
        </div>
      )}

      <div className="p-3">
        {/* Title & Price */}
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">{product.title}</h3>
        <p className="text-purple-700 font-bold text-sm mt-1">{product.priceRange}</p>

        {/* Meta badges */}
        <div className="flex items-center gap-2 mt-1.5">
          {product.variants.length > 1 && (
            <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
              {product.variants.length} variants
            </span>
          )}
          <span className={clsx(
            'text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5',
            product.totalStock > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          )}>
            <Package className="w-3 h-3" />
            {product.totalStock > 0 ? `${product.totalStock} in stock` : 'Out of stock'}
          </span>
        </div>

        {/* Description (compact shows less) */}
        {!compact && description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{description}</p>
        )}

        {/* Variant selector */}
        {product.variants.length > 1 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-600 flex items-center gap-1 hover:text-purple-800"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide' : 'Show'} variants
            </button>
            {expanded && (
              <div className="mt-1.5 space-y-1">
                {product.variants.map(v => (
                  <button
                    key={v.variantId}
                    onClick={() => setSelectedVariant(v)}
                    className={clsx(
                      'w-full text-left text-xs p-1.5 rounded border transition-colors',
                      selectedVariant?.variantId === v.variantId
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-200'
                    )}
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="text-gray-500 ml-1">${v.price.toFixed(2)}</span>
                    {v.inventoryQuantity === 0 && <span className="text-red-400 ml-1">(sold out)</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add to cart button */}
        {onAddToCart && (
          <button
            onClick={() => onAddToCart(product, variant || undefined)}
            disabled={product.totalStock === 0}
            className={clsx(
              'w-full mt-2 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
              product.totalStock > 0
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Add to Cart
          </button>
        )}
      </div>
    </div>
  )
}
