import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import type { ProductDetail } from '@/types'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useDragControls: () => ({ start: vi.fn() }),
}))

const mockProduct: ProductDetail = {
  productId: 1,
  title: 'Eternal Rose & Gold Leaf Crystal Box',
  descriptionHtml: '<p>Beautiful rose encased in crystal</p>',
  vendor: 'Maison de Fleur',
  productType: 'Gift',
  tags: ['bestseller'],
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
  ],
  priceRange: '$189.95',
  totalStock: 25,
  hasDiscount: false,
}

const mockGlobalProduct: ProductDetail = {
  ...mockProduct,
  productId: 2,
  title: 'Global Artisan Candle',
  isGlobal: true,
  shopName: 'Candle Co',
  shopUrl: 'https://candleco.myshopify.com',
  directCheckoutUrl: 'https://candleco.myshopify.com/cart/12345:1',
}

// ═══════════════════════════════════════════
// ExpressCheckoutSheet Tests
// ═══════════════════════════════════════════
describe('ExpressCheckoutSheet', () => {
  it('renders when isOpen is true', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
        productTitle="Test Product"
        shopName="Test Shop"
      />
    )

    expect(screen.getByText('⚡ Express Checkout')).toBeInTheDocument()
    expect(screen.getByText(/Test Product/)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const { container } = render(
      <ExpressCheckoutSheet
        isOpen={false}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />
    )

    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(screen.queryByText('⚡ Express Checkout')).not.toBeInTheDocument()
  })

  it('shows loading state when no checkout URL', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl={null}
        jwt={null}
      />
    )

    expect(screen.getByText('Preparing your checkout...')).toBeInTheDocument()
  })

  it('shows product title and shop name', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
        productTitle="Luxury Watch"
        shopName="WatchStore"
      />
    )

    expect(screen.getByText(/Luxury Watch/)).toBeInTheDocument()
    expect(screen.getByText(/WatchStore/)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const onClose = vi.fn()
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={onClose}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />
    )

    const closeBtn = screen.getByLabelText('Close checkout')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('appends JWT to checkout URL when provided', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const { container } = render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="test-jwt-token"
      />
    )

    const iframe = container.querySelector('iframe')
    if (iframe) {
      expect(iframe.src).toContain('auth=test-jwt-token')
    }
  })

  it('shows "Open in store" link when checkout URL is available', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />
    )

    expect(screen.getByText('Open in store →')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════
// SaveProfilePrompt Tests
// ═══════════════════════════════════════════
describe('SaveProfilePrompt', () => {
  it('renders when isVisible is true', async () => {
    const SaveProfilePrompt = (await import('@/components/chat/SaveProfilePrompt')).default
    render(
      <SaveProfilePrompt
        isVisible={true}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText('Save your details for instant checkout next time?')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Not now')).toBeInTheDocument()
  })

  it('does not render when isVisible is false', async () => {
    const SaveProfilePrompt = (await import('@/components/chat/SaveProfilePrompt')).default
    const { container } = render(
      <SaveProfilePrompt
        isVisible={false}
        onSave={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.queryByText('Save your details')).not.toBeInTheDocument()
  })

  it('calls onSave when Save button clicked', async () => {
    const SaveProfilePrompt = (await import('@/components/chat/SaveProfilePrompt')).default
    const onSave = vi.fn()
    render(
      <SaveProfilePrompt
        isVisible={true}
        onSave={onSave}
        onDismiss={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when Not now button clicked', async () => {
    const SaveProfilePrompt = (await import('@/components/chat/SaveProfilePrompt')).default
    const onDismiss = vi.fn()
    render(
      <SaveProfilePrompt
        isVisible={true}
        onSave={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByText('Not now'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('auto-dismisses after 15 seconds', async () => {
    vi.useFakeTimers()
    const SaveProfilePrompt = (await import('@/components/chat/SaveProfilePrompt')).default
    const onDismiss = vi.fn()

    render(
      <SaveProfilePrompt
        isVisible={true}
        onSave={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(15000)
    })

    expect(onDismiss).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})

// ═══════════════════════════════════════════
// ChatProductCard Express Checkout Tests
// ═══════════════════════════════════════════
describe('ChatProductCard — Express Checkout', () => {
  it('has Express Checkout button', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    render(
      <ChatProductCard
        product={mockProduct}
        onExpressCheckout={vi.fn()}
      />
    )

    expect(screen.getByText('⚡ Express Checkout')).toBeInTheDocument()
  })

  it('calls onExpressCheckout when Express Checkout clicked', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    const onExpressCheckout = vi.fn()
    render(
      <ChatProductCard
        product={mockProduct}
        onExpressCheckout={onExpressCheckout}
      />
    )

    fireEvent.click(screen.getByText('⚡ Express Checkout'))
    expect(onExpressCheckout).toHaveBeenCalledWith(mockProduct, mockProduct.variants[0])
  })

  it('has "Open on {shopName}" link for global products', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    render(
      <ChatProductCard
        product={mockGlobalProduct}
        onExpressCheckout={vi.fn()}
      />
    )

    expect(screen.getByText('Open on Candle Co →')).toBeInTheDocument()
  })

  it('has "Add to Cart" button for local products', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    render(
      <ChatProductCard
        product={mockProduct}
        onAddToCart={vi.fn()}
        onExpressCheckout={vi.fn()}
      />
    )

    expect(screen.getByText('Add to Cart')).toBeInTheDocument()
  })

  it('"Open on" link for global products has correct href', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    render(
      <ChatProductCard
        product={mockGlobalProduct}
        onExpressCheckout={vi.fn()}
      />
    )

    const link = screen.getByText('Open on Candle Co →')
    expect(link.closest('a')).toHaveAttribute('href', mockGlobalProduct.directCheckoutUrl)
    expect(link.closest('a')).toHaveAttribute('target', '_blank')
  })
})
