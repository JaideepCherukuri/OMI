'use client'

/**
 * Stage — The visual content area (top 60% of the screen).
 *
 * Per PRD Round 2: "Stage area shows active content. The Orb is centered
 * when no products are showing. When products appear, Orb docks to 32px
 * in the header area."
 *
 * States:
 *   welcome  → Centered large Orb + greeting text
 *   products → ProductCarousel with stagger animation
 *   cart     → Cart summary with checkout button
 *   checkout → Checkout confirmation
 */

import type { ProductDetail, CartState, VoiceState, VariantDetail, StageContent } from '@/types'
import ProductCarousel from './ProductCarousel'
import Orb from './Orb'
import { ExternalLink } from 'lucide-react'

interface StageProps {
  content: StageContent
  products?: ProductDetail[]
  cartState?: CartState | null
  voiceState: VoiceState
  highlightedProductId?: number | null
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
  onProductClick?: (product: ProductDetail) => void
  onConnect?: () => void
}

export default function Stage({
  content,
  products,
  cartState,
  voiceState,
  highlightedProductId,
  onAddToCart,
  onProductClick,
  onConnect,
}: StageProps) {
  return (
    <div className="h-full flex flex-col">
      {/* ── Welcome: Large centered Orb ──────── */}
      {content === 'welcome' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <Orb
            state={voiceState}
            size="lg"
            onClick={() => {
              if (voiceState === 'disconnected' && onConnect) {
                onConnect()
              }
            }}
          />
          <div className="text-center space-y-2">
            <p className="text-gray-400 text-sm">
              {voiceState === 'disconnected'
                ? 'Tap the mic to start voice shopping'
                : voiceState === 'connecting'
                  ? 'Connecting to voice agent...'
                  : voiceState === 'listening'
                    ? 'Listening...'
                    : voiceState === 'thinking'
                      ? 'Finding gifts...'
                      : voiceState === 'speaking'
                        ? 'Speaking...'
                        : 'Ready — say something or type below'}
            </p>
            {voiceState === 'disconnected' && (
              <p className="text-gray-600 text-xs">
                Or type a message to search with text
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Products: Carousel/Grid ──────────── */}
      {content === 'products' && products && products.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Products header with docked Orb */}
          <div className="flex items-center justify-between px-1 mb-3 flex-shrink-0">
            <span className="text-sm text-gray-400 font-medium">
              {products.length} product{products.length !== 1 ? 's' : ''} found
            </span>
            {voiceState !== 'disconnected' && (
              <Orb state={voiceState} size="sm" />
            )}
          </div>

          {/* Scrollable product area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <ProductCarousel
              products={products}
              highlightedProductId={highlightedProductId ?? undefined}
              onAddToCart={onAddToCart}
              onProductClick={onProductClick}
            />
          </div>
        </div>
      )}

      {/* ── Product Detail ───────────────────── */}
      {content === 'product_detail' && products && products.length === 1 && (
        <div className="flex-1 overflow-auto">
          <ProductDetailView
            product={products[0]}
            onAddToCart={onAddToCart}
          />
        </div>
      )}

      {/* ── Cart ─────────────────────────────── */}
      {content === 'cart' && cartState && (
        <div className="flex-1 overflow-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">🛒 Your Cart</h3>
            <div className="space-y-3">
              {cartState.lines.map((line) => (
                <div
                  key={line.lineId}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{line.productTitle}</p>
                    <p className="text-xs text-gray-500">
                      {line.variantTitle} × {line.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {line.currency} {line.price}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-gray-400">Total</span>
              <span className="text-xl font-bold text-white">
                {cartState.currency} {cartState.totalAmount}
              </span>
            </div>

            {cartState.checkoutUrl && (
              <a
                href={cartState.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 rounded-xl font-medium transition-all"
              >
                <span>Proceed to Checkout</span>
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Checkout Confirmation ─────────────── */}
      {content === 'checkout' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-white">Checkout Ready!</h3>
          <p className="text-sm text-gray-400 text-center">
            Your Shopify checkout has been opened in a new tab.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Product Detail View (single product expanded) ──

function ProductDetailView({
  product,
  onAddToCart,
}: {
  product: ProductDetail
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
}) {
  const descClean = (product.descriptionHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Image */}
      {product.images[0] && (
        <div className="aspect-video bg-gray-800 overflow-hidden">
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-5 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{product.title}</h3>
          <p className="text-lg text-purple-300 font-medium mt-1">{product.priceRange}</p>
          {product.vendor && (
            <p className="text-xs text-gray-500 mt-1">by {product.vendor}</p>
          )}
        </div>

        {descClean && (
          <p className="text-sm text-gray-400 leading-relaxed">{descClean}</p>
        )}

        {/* Variants */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase">Variants</p>
          {product.variants.map((v) => (
            <div
              key={v.variantId}
              className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
            >
              <div>
                <p className="text-sm text-white">{v.name}</p>
                <p className="text-xs text-gray-500">
                  {v.inventoryQuantity > 0
                    ? `${v.inventoryQuantity} in stock`
                    : 'Out of stock'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">${v.price.toFixed(2)}</span>
                <button
                  onClick={() => onAddToCart?.(product, v)}
                  disabled={v.inventoryQuantity <= 0}
                  className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-600">
          {product.totalStock} total in stock · {product.tags.join(', ')}
        </p>
      </div>
    </div>
  )
}
