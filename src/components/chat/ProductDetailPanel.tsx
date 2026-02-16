'use client'

/**
 * ProductDetailPanel — Right-side slide-in panel for product details.
 *
 * Design ref: Shopify screenshots 2 & 3 — persistent side panel with:
 *  - Back arrow + product name
 *  - Large image + thumbnail gallery
 *  - Store name, title, price
 *  - Size selector pills
 *  - Color swatches (circles)
 *  - Quantity selector (-/+)
 *  - "Add to cart" + "Buy now" buttons
 */

import { useState, useCallback, useMemo } from 'react'
import type { ProductDetail, VariantDetail } from '@/types'
import { X, ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react'
import clsx from 'clsx'

interface ProductDetailPanelProps {
  product: ProductDetail | null
  isOpen: boolean
  onClose: () => void
  onAddToCart?: (product: ProductDetail, variant: VariantDetail, quantity: number) => void
  onBuyNow?: (product: ProductDetail, variant: VariantDetail, quantity: number) => void
}

export default function ProductDetailPanel({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
}: ProductDetailPanelProps) {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)

  // Reset state when product changes
  const currentProduct = useMemo(() => {
    if (product) {
      setSelectedImageIdx(0)
      setSelectedVariantId(product.variants[0]?.variantId ?? null)
      setQuantity(1)
    }
    return product
  }, [product])

  const selectedVariant = currentProduct?.variants.find(
    (v) => v.variantId === selectedVariantId,
  ) ?? currentProduct?.variants[0]

  // Parse variant options (size/color)
  const options = useMemo(() => {
    if (!currentProduct) return { sizes: [], colors: [] }

    const sizes: string[] = []
    const colors: string[] = []

    for (const v of currentProduct.variants) {
      const name = v.name.toLowerCase()
      // Heuristic: if it looks like a size, add to sizes
      if (/^(xxs|xs|s|m|l|xl|xxl|2xl|3xl|\d+)/i.test(v.name)) {
        if (!sizes.includes(v.name)) sizes.push(v.name)
      }
      // If it's a color-like name
      if (/black|white|blue|red|green|gray|grey|oat|cream|navy|pink|beige|brown|tan/i.test(name)) {
        const colorName = v.name.split(' / ').pop() || v.name
        if (!colors.includes(colorName)) colors.push(colorName)
      }
    }

    // If no clear sizes/colors, just list all variants
    if (sizes.length === 0 && colors.length === 0) {
      for (const v of currentProduct.variants) {
        if (v.name !== 'Default Title' && !sizes.includes(v.name)) {
          sizes.push(v.name)
        }
      }
    }

    return { sizes, colors }
  }, [currentProduct])

  const descClean = (currentProduct?.descriptionHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!currentProduct) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/30 z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <h3 className="text-sm font-medium text-gray-800 truncate flex-1">
            {currentProduct.title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto">
          {/* Main Image */}
          {currentProduct.images.length > 0 && (
            <div className="aspect-square bg-gray-50">
              <img
                src={currentProduct.images[selectedImageIdx] || currentProduct.images[0]}
                alt={currentProduct.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Thumbnail gallery */}
          {currentProduct.images.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto">
              {currentProduct.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={clsx(
                    'w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors',
                    idx === selectedImageIdx
                      ? 'border-purple-500'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <img
                    src={img}
                    alt={`${currentProduct.title} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Product info */}
          <div className="px-4 py-4 space-y-4">
            {/* Store name */}
            {currentProduct.vendor && (
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                {currentProduct.vendor}
              </p>
            )}

            {/* Title + Price */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {currentProduct.title}
              </h2>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {selectedVariant
                  ? `$${selectedVariant.price.toFixed(2)}`
                  : currentProduct.priceRange}
              </p>
            </div>

            {/* Size selector pills */}
            {options.sizes.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Size{' '}
                  <span className="font-medium text-gray-700">
                    {selectedVariant?.name}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.sizes.map((size) => {
                    const variant = currentProduct.variants.find(
                      (v) => v.name === size || v.name.startsWith(size),
                    )
                    const isSelected = variant?.variantId === selectedVariantId
                    const isAvailable = variant && variant.inventoryQuantity > 0

                    return (
                      <button
                        key={size}
                        onClick={() => variant && setSelectedVariantId(variant.variantId)}
                        disabled={!isAvailable}
                        className={clsx(
                          'min-w-[40px] px-3 py-1.5 text-sm rounded-lg border transition-all',
                          isSelected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : isAvailable
                              ? 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                              : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through',
                        )}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Color swatches */}
            {options.colors.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Color{' '}
                  <span className="font-medium text-gray-700">
                    {options.colors.find((c) =>
                      selectedVariant?.name?.toLowerCase().includes(c.toLowerCase()),
                    ) || options.colors[0]}
                  </span>
                </p>
                <div className="flex gap-2">
                  {options.colors.map((color) => {
                    const colorMap: Record<string, string> = {
                      black: '#1a1a1a',
                      white: '#f5f5f5',
                      blue: '#3b82f6',
                      red: '#ef4444',
                      green: '#22c55e',
                      gray: '#9ca3af',
                      grey: '#9ca3af',
                      oat: '#d4c9b8',
                      cream: '#fffdd0',
                      navy: '#1e3a5f',
                      pink: '#ec4899',
                      beige: '#f5f5dc',
                      brown: '#92400e',
                      tan: '#d2b48c',
                    }
                    const hex =
                      colorMap[color.toLowerCase()] || '#9ca3af'

                    return (
                      <button
                        key={color}
                        onClick={() => {
                          const variant = currentProduct.variants.find(
                            (v) =>
                              v.name
                                .toLowerCase()
                                .includes(color.toLowerCase()),
                          )
                          if (variant) setSelectedVariantId(variant.variantId)
                        }}
                        className={clsx(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          selectedVariant?.name
                            ?.toLowerCase()
                            .includes(color.toLowerCase())
                            ? 'border-gray-900 scale-110'
                            : 'border-gray-200 hover:border-gray-400',
                        )}
                        style={{ backgroundColor: hex }}
                        title={color}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {descClean && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {descClean}
              </p>
            )}

            {/* Quantity + Actions */}
            <div className="space-y-3 pt-2">
              {/* Quantity */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Minus size={16} className="text-gray-600" />
                </button>
                <span className="text-lg font-medium text-gray-900 w-8 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(
                      Math.min(
                        selectedVariant?.inventoryQuantity ?? 99,
                        quantity + 1,
                      ),
                    )
                  }
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={16} className="text-gray-600" />
                </button>
              </div>

              {/* Add to cart */}
              <button
                onClick={() =>
                  selectedVariant &&
                  onAddToCart?.(currentProduct, selectedVariant, quantity)
                }
                disabled={!selectedVariant || selectedVariant.inventoryQuantity <= 0}
                className="w-full py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart size={16} />
                Add to cart
              </button>

              {/* Buy now */}
              <button
                onClick={() =>
                  selectedVariant &&
                  onBuyNow?.(currentProduct, selectedVariant, quantity)
                }
                disabled={!selectedVariant || selectedVariant.inventoryQuantity <= 0}
                className="w-full py-3 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Buy now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
