'use client'

import { useRef, useState, useEffect } from 'react'
import type { ProductDetail, VariantDetail } from '@/types'
import ProductCard from './ProductCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface ProductCarouselProps {
  products: ProductDetail[]
  onAddToCart?: (product: ProductDetail, variant?: VariantDetail) => void
  highlightedProductId?: number
}

export default function ProductCarousel({ products, onAddToCart, highlightedProductId }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activeDot, setActiveDot] = useState(0)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
    const cardWidth = 276
    setActiveDot(Math.round(el.scrollLeft / cardWidth))
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll, { passive: true })
    return () => { el?.removeEventListener('scroll', checkScroll) }
  }, [products])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = 280
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  // Grid layout for ≤4 products
  if (products.length <= 4) {
    return (
      <div className="grid grid-cols-2 gap-3 my-2">
        {products.map(p => (
          <ProductCard
            key={p.productId}
            product={p}
            onAddToCart={onAddToCart}
            isHighlighted={p.productId === highlightedProductId}
          />
        ))}
      </div>
    )
  }

  // Carousel for 5+ products
  const totalDots = Math.max(1, products.length - 1)

  return (
    <div className="relative my-2">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="carousel-container flex gap-3 overflow-x-auto pb-2 px-1"
      >
        {products.map(p => (
          <ProductCard
            key={p.productId}
            product={p}
            onAddToCart={onAddToCart}
            isHighlighted={p.productId === highlightedProductId}
            compact
          />
        ))}
      </div>

      {/* Navigation arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-colors z-10"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-colors z-10"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 mt-2">
        {Array.from({ length: Math.min(totalDots, 8) }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'w-1.5 h-1.5 rounded-full transition-colors',
              i === activeDot ? 'bg-purple-600' : 'bg-purple-200'
            )}
          />
        ))}
      </div>
    </div>
  )
}
