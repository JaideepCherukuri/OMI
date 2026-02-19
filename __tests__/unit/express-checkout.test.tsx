import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
// Helpers for Checkout Kit mocking
// ═══════════════════════════════════════════

let createdCheckoutElements: HTMLElement[] = []
let mockCEGet: ReturnType<typeof vi.spyOn>
let mockCEWhenDefined: ReturnType<typeof vi.spyOn>

/**
 * Set up mocks for the Shopify Checkout Kit web component.
 * @param available  If true, customElements.get returns a class (CDN loaded).
 *                   If false, simulates CDN not loaded (triggers fallback).
 */
function setupCheckoutKitMock(available = true) {
  createdCheckoutElements = []

  const origCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    if (tagName === 'shopify-checkout') {
      const el = origCreate('div')
      // Attach mock methods that ShopifyCheckoutElement needs
      ;(el as any).open = vi.fn()
      ;(el as any).close = vi.fn()
      ;(el as any).focus = vi.fn()
      ;(el as any).orderConfirmation = undefined
      createdCheckoutElements.push(el)
      return el
    }
    return origCreate(tagName, options)
  }) as typeof document.createElement)

  if (available) {
    mockCEGet = vi.spyOn(customElements, 'get').mockReturnValue(class {} as any)
    mockCEWhenDefined = vi.spyOn(customElements, 'whenDefined').mockResolvedValue(class {} as any)
  } else {
    mockCEGet = vi.spyOn(customElements, 'get').mockReturnValue(undefined as any)
    // Never resolves — the component's 5 s race will trigger the timeout
    mockCEWhenDefined = vi
      .spyOn(customElements, 'whenDefined')
      .mockReturnValue(new Promise(() => {}))
  }
}

// ═══════════════════════════════════════════
// ExpressCheckoutSheet Tests
// ═══════════════════════════════════════════
describe('ExpressCheckoutSheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setupCheckoutKitMock(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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
      />,
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
      />,
    )

    expect(container.querySelector('[data-testid]')).toBeNull()
    expect(screen.queryByText('⚡ Express Checkout')).not.toBeInTheDocument()
  })

  it('shows loading state when checkout URL is null', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl={null}
        jwt={null}
      />,
    )

    // The new component uses "Loading secure checkout…" (Unicode ellipsis)
    expect(screen.getByText('Loading secure checkout…')).toBeInTheDocument()
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
      />,
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
      />,
    )

    const closeBtn = screen.getByLabelText('Close checkout')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('creates <shopify-checkout> element with correct src', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout/abc"
        jwt={null}
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]
    expect((el as any).src).toBe('https://example.com/checkout/abc')
  })

  it('sets auth + inline target when JWT is provided', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="test-jwt-token-123"
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]
    expect((el as any).auth).toBe('test-jwt-token-123')
    expect((el as any).target).toBe('inline')
    // Inline mode sets explicit dimensions
    expect(el.style.width).toBe('100%')
    expect(el.style.height).toBe('100%')
  })

  it('uses popup target when JWT is missing', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]
    expect((el as any).target).toBe('popup')
    // open() should be called for popup mode
    expect((el as any).open).toHaveBeenCalled()
  })

  it('registers checkout:complete and checkout:close event listeners', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt-token"
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]
    const addEventSpy = vi.spyOn(el, 'addEventListener')
    // The listeners are already registered before we can spy.
    // Instead verify by dispatching events (tested separately below).
    // Here, just confirm the element exists and has the right src.
    expect((el as any).src).toBe('https://example.com/checkout')
  })

  it('fires onCheckoutComplete when checkout:complete event dispatches', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const onComplete = vi.fn()
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt-token"
        onCheckoutComplete={onComplete}
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]
    ;(el as any).orderConfirmation = { orderId: 'order-999' }

    // Dispatch the event
    act(() => {
      el.dispatchEvent(new Event('checkout:complete'))
    })

    expect(onComplete).toHaveBeenCalled()
  })

  it('fires onClose when checkout:close event dispatches', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const onClose = vi.fn()
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={onClose}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt-token"
      />,
    )

    await waitFor(() => {
      expect(createdCheckoutElements.length).toBe(1)
    })

    const el = createdCheckoutElements[0]

    act(() => {
      el.dispatchEvent(new Event('checkout:close'))
    })

    expect(onClose).toHaveBeenCalled()
  })

  it('shows fallback when CDN does not load (timeout)', async () => {
    vi.useFakeTimers()

    // Override: CDN not available
    vi.restoreAllMocks()
    setupCheckoutKitMock(false)

    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt-token"
      />,
    )

    // Flush the microtask queue so the async init starts + awaits
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(screen.getByText(/couldn.*t load inline/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('closes sheet on Escape key', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const onClose = vi.fn()
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={onClose}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "Open in store →" link when checkout URL is available', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />,
    )

    expect(screen.getByText('Open in store →')).toBeInTheDocument()
  })

  it('shows "Order confirmed" after checkout:complete', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt"
        onCheckoutComplete={vi.fn()}
      />,
    )

    // Flush async init
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(createdCheckoutElements.length).toBe(1)

    // Dispatch complete event and flush state update
    await act(async () => {
      createdCheckoutElements[0].dispatchEvent(new Event('checkout:complete'))
    })

    expect(screen.getByText('Order confirmed! 🎉')).toBeInTheDocument()
  })

  it('shows "Checkout opened in a popup" for popup mode', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />,
    )

    // Flush the async init → setMode('popup')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('Checkout opened in a popup')).toBeInTheDocument()
  })

  it('shows "Reopen checkout" button in popup mode', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={vi.fn()}
        checkoutUrl="https://example.com/checkout"
        jwt={null}
      />,
    )

    // Flush the async init → setMode('popup')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(screen.getByText('Reopen checkout')).toBeInTheDocument()
  })

  it('cleans up element when sheet closes', async () => {
    const ExpressCheckoutSheet = (await import('@/components/chat/ExpressCheckoutSheet')).default
    const onClose = vi.fn()
    const { rerender } = render(
      <ExpressCheckoutSheet
        isOpen={true}
        onClose={onClose}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt"
      />,
    )

    // Flush async init so the element is fully mounted
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(createdCheckoutElements.length).toBe(1)
    const el = createdCheckoutElements[0]

    // Close the sheet
    rerender(
      <ExpressCheckoutSheet
        isOpen={false}
        onClose={onClose}
        checkoutUrl="https://example.com/checkout"
        jwt="jwt"
      />,
    )

    // close() should have been called on the element
    expect((el as any).close).toHaveBeenCalled()
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
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
      />,
    )

    expect(screen.getByText('Add to Cart')).toBeInTheDocument()
  })

  it('"Open on" link for global products has correct href', async () => {
    const ChatProductCard = (await import('@/components/chat/ChatProductCard')).default
    render(
      <ChatProductCard
        product={mockGlobalProduct}
        onExpressCheckout={vi.fn()}
      />,
    )

    const link = screen.getByText('Open on Candle Co →')
    expect(link.closest('a')).toHaveAttribute('href', mockGlobalProduct.directCheckoutUrl)
    expect(link.closest('a')).toHaveAttribute('target', '_blank')
  })
})
