import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { ProductDetail, ChatMessage } from '@/types'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

// Mock product data
const mockProduct: ProductDetail = {
  productId: 1,
  title: 'Eternal Rose & Gold Leaf Crystal Box',
  descriptionHtml: '<p>Beautiful rose</p>',
  vendor: 'Maison de Fleur',
  productType: 'Gift',
  tags: ["Valentine's Day", 'Anniversary'],
  status: 'active',
  handle: 'eternal-rose',
  images: ['https://cdn.shopify.com/rose.jpg'],
  variants: [
    {
      variantId: 101,
      name: 'Ruby Red',
      sku: 'LUX-ROSE-RED',
      price: 189.95,
      compareAtPrice: null,
      inventoryQuantity: 25,
      deliveryTime: '3-5 days',
      availableRegions: 'India, USA, UK',
    },
    {
      variantId: 102,
      name: '24K Gold Dipped',
      sku: 'LUX-ROSE-GLD',
      price: 289.95,
      compareAtPrice: null,
      inventoryQuantity: 10,
      deliveryTime: '7-10 days',
      availableRegions: 'USA, UK, EU',
    },
  ],
  priceRange: '$189.95–$289.95',
  totalStock: 35,
  hasDiscount: false,
}

describe('ProductCard', () => {
  it('renders product title and price', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    render(<ProductCard product={mockProduct} />)

    expect(
      screen.getByText('Eternal Rose & Gold Leaf Crystal Box'),
    ).toBeInTheDocument()
    expect(screen.getByText('$189.95–$289.95')).toBeInTheDocument()
  })

  it('shows stock info', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('35 in stock')).toBeInTheDocument()
  })

  it('shows vendor', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('by Maison de Fleur')).toBeInTheDocument()
  })

  it('shows tags', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText("Valentine's Day")).toBeInTheDocument()
    expect(screen.getByText('Anniversary')).toBeInTheDocument()
  })

  it('expands to show variants', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    render(<ProductCard product={mockProduct} />)

    // Click expand button
    const expandBtn = screen.getByText('2 variants')
    fireEvent.click(expandBtn)

    // Should show variant details
    expect(screen.getByText('Ruby Red')).toBeInTheDocument()
    expect(screen.getByText('24K Gold Dipped')).toBeInTheDocument()
    expect(screen.getByText('$189.95')).toBeInTheDocument()
    expect(screen.getByText('$289.95')).toBeInTheDocument()
  })

  it('shows SALE badge for discounted products', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    const discounted = {
      ...mockProduct,
      hasDiscount: true,
    }
    render(<ProductCard product={discounted} />)

    expect(screen.getByText('SALE')).toBeInTheDocument()
  })

  it('shows "Out of stock" when totalStock is 0', async () => {
    const { ProductCard } = await import('@/components/ProductCard')
    const outOfStock = {
      ...mockProduct,
      totalStock: 0,
    }
    render(<ProductCard product={outOfStock} />)

    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })
})

describe('ChatMessage', () => {
  it('renders user messages', async () => {
    const { ChatMessageBubble } = await import('@/components/ChatMessage')
    const msg: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Show me Valentine gifts',
      timestamp: Date.now(),
    }

    render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Show me Valentine gifts')).toBeInTheDocument()
  })

  it('renders assistant messages', async () => {
    const { ChatMessageBubble } = await import('@/components/ChatMessage')
    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Here are some great Valentine gifts!',
      timestamp: Date.now(),
    }

    render(<ChatMessageBubble message={msg} />)
    expect(
      screen.getByText('Here are some great Valentine gifts!'),
    ).toBeInTheDocument()
  })

  it('renders system messages with centered style', async () => {
    const { ChatMessageBubble } = await import('@/components/ChatMessage')
    const msg: ChatMessage = {
      id: '3',
      role: 'system',
      content: 'Chat cleared',
      timestamp: Date.now(),
    }

    render(<ChatMessageBubble message={msg} />)
    expect(screen.getByText('Chat cleared')).toBeInTheDocument()
  })

  it('renders product cards when products are provided', async () => {
    const { ChatMessageBubble } = await import('@/components/ChatMessage')
    const msg: ChatMessage = {
      id: '4',
      role: 'assistant',
      content: 'Here are my recommendations:',
      timestamp: Date.now(),
      products: [mockProduct],
    }

    render(<ChatMessageBubble message={msg} />)
    expect(
      screen.getByText('Eternal Rose & Gold Leaf Crystal Box'),
    ).toBeInTheDocument()
  })

  it('renders checkout link when provided', async () => {
    const { ChatMessageBubble } = await import('@/components/ChatMessage')
    const msg: ChatMessage = {
      id: '5',
      role: 'assistant',
      content: 'Your checkout is ready!',
      timestamp: Date.now(),
      checkoutUrl: 'https://store.myshopify.com/checkout/abc',
    }

    render(<ChatMessageBubble message={msg} />)
    const checkoutLink = screen.getByText('Complete Checkout')
    expect(checkoutLink).toBeInTheDocument()
    expect(checkoutLink.closest('a')).toHaveAttribute(
      'href',
      'https://store.myshopify.com/checkout/abc',
    )
  })
})

describe('TypingIndicator', () => {
  it('renders typing dots', async () => {
    const { TypingIndicator } = await import('@/components/ChatMessage')
    const { container } = render(<TypingIndicator />)

    const dots = container.querySelectorAll('.typing-dot')
    expect(dots).toHaveLength(3)
  })
})

describe('StoreConnect', () => {
  it('renders connect form', async () => {
    const { StoreConnect } = await import('@/components/StoreConnect')
    render(<StoreConnect onConnect={vi.fn()} />)

    expect(screen.getAllByText('Connect Store')).toHaveLength(2) // heading + button
    expect(
      screen.getByPlaceholderText('your-store.myshopify.com'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('shpat_...')).toBeInTheDocument()
  })
})
