'use client'

import type { ProductDetail, CartState, VoiceState, VariantDetail, StageContent } from '@/types'
import ProductCarousel from './ProductCarousel'
import Orb from './Orb'

interface StageProps {
  content: StageContent
  products?: ProductDetail[]
  cartState?: CartState | null
  voiceState: VoiceState
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
  onOrbClick?: () => void
}

export default function Stage({ content, products, cartState, voiceState, onAddToCart, onOrbClick }: StageProps) {
  return (
    <div className="relative">
      {/* Welcome state: large centered Orb */}
      {content === 'welcome' && (
        <div className="flex flex-col items-center justify-center py-8">
          <Orb state={voiceState} size="lg" onClick={onOrbClick} />
          <p className="mt-4 text-gray-500 text-sm text-center">
            {voiceState === 'disconnected' ? 'Tap the mic to start voice shopping' : 'Listening...'}
          </p>
        </div>
      )}

      {/* Products state: carousel with small docked Orb */}
      {content === 'products' && products && (
        <div>
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs text-gray-500">{products.length} products found</span>
            {voiceState !== 'disconnected' && (
              <Orb state={voiceState} size="sm" onClick={onOrbClick} />
            )}
          </div>
          <ProductCarousel products={products} onAddToCart={onAddToCart} />
        </div>
      )}

      {/* Cart state */}
      {content === 'cart' && cartState && (
        <div className="bg-green-50 rounded-xl p-4 mx-2">
          <h3 className="font-semibold text-green-800 mb-2">🛒 Your Cart</h3>
          {cartState.lines.map(l => (
            <div key={l.lineId} className="flex justify-between text-sm py-1">
              <span>{l.productTitle} × {l.quantity}</span>
              <span className="font-medium">{l.currency} {l.price}</span>
            </div>
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between font-bold text-green-800">
            <span>Total</span>
            <span>{cartState.currency} {cartState.totalAmount}</span>
          </div>
        </div>
      )}
    </div>
  )
}
