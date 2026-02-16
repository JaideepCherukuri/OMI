'use client'

import type { CartState } from '@/types'
import { X, ExternalLink, ShoppingCart } from 'lucide-react'
import clsx from 'clsx'

interface CartPanelProps {
  isOpen: boolean
  onClose: () => void
  cartState: CartState | null
  onCheckout?: () => void
}

export default function CartPanel({ isOpen, onClose, cartState, onCheckout }: CartPanelProps) {
  if (!isOpen) return null

  const hasItems = cartState && cartState.lines.length > 0

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className={clsx(
        'absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-purple-600" />
            Shopping Cart
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasItems ? (
            <div className="text-center text-gray-400 py-12">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Your cart is empty</p>
              <p className="text-sm mt-1">Add some gifts to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartState!.lines.map((line) => (
                <div key={line.lineId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{line.productTitle}</p>
                    <p className="text-xs text-gray-500">{line.variantTitle}</p>
                    <p className="text-sm font-semibold text-purple-700 mt-0.5">
                      {line.currency} {line.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded-lg border px-1.5 py-0.5">
                    <span className="text-sm font-medium w-6 text-center">{line.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasItems && (
          <div className="border-t p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-500">Total ({cartState!.totalQuantity} items)</span>
              <span className="text-lg font-bold text-purple-700">
                {cartState!.currency} {cartState!.totalAmount}
              </span>
            </div>
            <a
              href={cartState!.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onCheckout}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
            >
              Proceed to Checkout
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
