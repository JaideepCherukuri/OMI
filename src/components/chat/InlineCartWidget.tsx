'use client'

/**
 * InlineCartWidget — HALO Design System styled cart widget.
 */

import { useState } from 'react'
import type { CartState, CartLineItem } from '@/types'
import { ChevronDown, ChevronUp, Trash2, Minus, Plus, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineCartWidgetProps {
  cartState: CartState
  storeName?: string
  storeLogoUrl?: string
  onCheckout?: () => void
  onExpressCheckout?: () => void
  onRemoveItem?: (lineId: string) => void
  onUpdateQuantity?: (lineId: string, quantity: number) => void
  className?: string
}

export default function InlineCartWidget({
  cartState,
  storeName,
  storeLogoUrl,
  onCheckout,
  onExpressCheckout,
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
      className={cn(
        'bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-sm overflow-hidden animate-fadeInUp font-sans',
        className,
      )}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-[var(--radius)] bg-[var(--muted)]/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {storeLogoUrl ? (
            <img src={storeLogoUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-[var(--muted-foreground)]">
              {displayName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--card-foreground)] truncate">
            {displayName}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex -space-x-2">
          {cartState.lines.slice(0, 3).map((line) => (
            <div
              key={line.lineId}
              className="w-8 h-8 rounded-[var(--radius)] border-2 border-[var(--card)] bg-[var(--muted)]/20 overflow-hidden flex-shrink-0"
            >
              {line.imageUrl ? (
                <img
                  src={line.imageUrl}
                  alt={line.productTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--muted)]/30" />
              )}
            </div>
          ))}
          {cartState.lines.length > 3 && (
            <div className="w-8 h-8 rounded-[var(--radius)] border-2 border-[var(--card)] bg-[var(--muted)]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                +{cartState.lines.length - 3}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
        >
          {expanded ? (
            <ChevronUp size={16} className="text-[var(--muted-foreground)]" />
          ) : (
            <ChevronDown size={16} className="text-[var(--muted-foreground)]" />
          )}
        </button>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={() => {
              if (onExpressCheckout) {
                onExpressCheckout()
              } else {
                if (cartState.checkoutUrl) {
                  window.open(cartState.checkoutUrl, '_blank')
                }
                onCheckout?.()
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)] text-sm font-medium rounded-[var(--radius)] transition-all"
          >
            ⚡ Express
            <span className="text-[var(--brand-foreground)]/70 text-xs">
              {cartState.currency} ${cartState.totalAmount}
            </span>
          </button>
          {cartState.checkoutUrl && (
            <a
              href={cartState.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] transition-colors"
            >
              Open in store →
            </a>
          )}
        </div>
      </div>

      {/* Expanded: item details */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {cartState.lines.map((line) => (
            <CartLineItemComponent
              key={line.lineId}
              line={line}
              onRemove={() => onRemoveItem?.(line.lineId)}
              onUpdateQuantity={(qty) => onUpdateQuantity?.(line.lineId, qty)}
            />
          ))}

          <div className="px-4 py-3 bg-[var(--muted)]/10 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                Subtotal · {totalItems} item{totalItems !== 1 ? 's' : ''}
              </span>
              <span className="font-medium text-[var(--foreground)]">
                ${cartState.totalAmount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Estimated shipping</span>
              <span className="text-[var(--foreground)]/70">Calculated at checkout</span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Taxes calculated at checkout
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function CartLineItemComponent({
  line,
  onRemove,
  onUpdateQuantity,
}: {
  line: CartLineItem
  onRemove?: () => void
  onUpdateQuantity?: (qty: number) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]/50 last:border-0">
      <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--muted)]/20 overflow-hidden flex-shrink-0">
        {line.imageUrl ? (
          <img
            src={line.imageUrl}
            alt={line.productTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[var(--muted)]/30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">
          {line.productTitle}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{line.variantTitle}</p>
      </div>

      <p className="text-sm font-medium text-[var(--foreground)] flex-shrink-0">
        ${line.price}
      </p>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onRemove}
          className="p-1 rounded-[var(--radius)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Remove"
        >
          <Trash2 size={14} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]" />
        </button>
        <span className="text-sm text-[var(--foreground)] w-5 text-center">
          {line.quantity}
        </span>
        <button
          onClick={() => onUpdateQuantity?.(line.quantity + 1)}
          className="p-1 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
        >
          <Plus size={14} className="text-[var(--muted-foreground)]" />
        </button>
      </div>
    </div>
  )
}
