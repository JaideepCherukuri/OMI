'use client'

/**
 * InlineCartWidget — Per-store expandable cart widget inline in chat.
 *
 * Design ref: Shopify screenshots 3 & 4:
 *  - Collapsed: [Store logo | Store name | item count | thumbnails | ▾ | Checkout CAD $X]
 *  - Expanded: Individual items with thumbnails, quantity controls, subtotal, shipping
 *  - Per-store checkout button
 */

import { useState } from 'react'
import type { CartState, CartLineItem } from '@/types'
import { ChevronDown, ChevronUp, Trash2, Minus, Plus, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

interface InlineCartWidgetProps {
  cartState: CartState
  storeName?: string
  storeLogoUrl?: string
  onCheckout?: () => void
  onRemoveItem?: (lineId: string) => void
  onUpdateQuantity?: (lineId: string, quantity: number) => void
  className?: string
}

export default function InlineCartWidget({
  cartState,
  storeName,
  storeLogoUrl,
  onCheckout,
  onRemoveItem,
  onUpdateQuantity,
  className,
}: InlineCartWidgetProps) {
  const [expanded, setExpanded] = useState(false)

  if (!cartState || cartState.lines.length === 0) return null

  const displayName = storeName || 'Store'
  const totalItems = cartState.totalQuantity

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fadeInUp',
        className,
      )}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Store logo/icon */}
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {storeLogoUrl ? (
            <img src={storeLogoUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-gray-500">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Store name + item count */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {displayName}
          </p>
          <p className="text-xs text-gray-500">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Product thumbnails (max 3) */}
        <div className="flex -space-x-2">
          {cartState.lines.slice(0, 3).map((line) => (
            <div
              key={line.lineId}
              className="w-8 h-8 rounded-md border-2 border-white bg-gray-100 overflow-hidden flex-shrink-0"
            >
              {line.imageUrl ? (
                <img
                  src={line.imageUrl}
                  alt={line.productTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>
          ))}
          {cartState.lines.length > 3 && (
            <div className="w-8 h-8 rounded-md border-2 border-white bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-gray-500 font-medium">
                +{cartState.lines.length - 3}
              </span>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {expanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>

        {/* Checkout button */}
        <button
          onClick={() => {
            if (cartState.checkoutUrl) {
              window.open(cartState.checkoutUrl, '_blank')
            }
            onCheckout?.()
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
        >
          Checkout
          <span className="text-gray-300 text-xs">
            {cartState.currency} ${cartState.totalAmount}
          </span>
        </button>
      </div>

      {/* Expanded: item details */}
      {expanded && (
        <div className="border-t border-gray-100">
          {cartState.lines.map((line) => (
            <CartLineItem
              key={line.lineId}
              line={line}
              onRemove={() => onRemoveItem?.(line.lineId)}
              onUpdateQuantity={(qty) => onUpdateQuantity?.(line.lineId, qty)}
            />
          ))}

          {/* Subtotal + shipping */}
          <div className="px-4 py-3 bg-gray-50 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Subtotal · {totalItems} item{totalItems !== 1 ? 's' : ''}
              </span>
              <span className="font-medium text-gray-900">
                ${cartState.totalAmount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Estimated shipping</span>
              <span className="text-gray-700">Calculated at checkout</span>
            </div>
            <p className="text-xs text-gray-400">
              Taxes calculated at checkout
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CartLineItem({
  line,
  onRemove,
  onUpdateQuantity,
}: {
  line: CartLineItem
  onRemove?: () => void
  onUpdateQuantity?: (qty: number) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
        {line.imageUrl ? (
          <img
            src={line.imageUrl}
            alt={line.productTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {line.productTitle}
        </p>
        <p className="text-xs text-gray-500">{line.variantTitle}</p>
      </div>

      {/* Price */}
      <p className="text-sm font-medium text-gray-900 flex-shrink-0">
        ${line.price}
      </p>

      {/* Quantity controls (when expanded) */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 transition-colors"
          title="Remove"
        >
          <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
        </button>
        <span className="text-sm text-gray-700 w-5 text-center">
          {line.quantity}
        </span>
        <button
          onClick={() => onUpdateQuantity?.(line.quantity + 1)}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          <Plus size={14} className="text-gray-500" />
        </button>
      </div>
    </div>
  )
}
