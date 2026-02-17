import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { ProductDetail, ChatMessage, VoiceState } from '@/types'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

// Mock product data matching real Shopify store products
const mockProduct: ProductDetail = {
  productId: 1,
  title: 'Eternal Rose & Gold Leaf Crystal Box',
  descriptionHtml: '<p>Beautiful rose encased in crystal</p>',
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

// ═══════════════════════════════════════════
// ProductCard Tests
// ═══════════════════════════════════════════
describe('ProductCard', () => {
  it('renders product title and price range', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Eternal Rose & Gold Leaf Crystal Box')).toBeInTheDocument()
    expect(screen.getByText('$189.95–$289.95')).toBeInTheDocument()
  })

  it('shows stock count', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('35 in stock')).toBeInTheDocument()
  })

  it('shows variant count badge', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('2 variants')).toBeInTheDocument()
  })

  it('renders Sale badge when hasDiscount is true', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    const discounted = { ...mockProduct, hasDiscount: true }
    render(<ProductCard product={discounted} />)

    expect(screen.getByText('Sale')).toBeInTheDocument()
  })

  it('shows "Out of stock" when totalStock is 0', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    const outOfStock = { ...mockProduct, totalStock: 0 }
    render(<ProductCard product={outOfStock} />)

    expect(screen.getByText('Out of stock')).toBeInTheDocument()
  })

  it('expands to show variant details', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    render(<ProductCard product={mockProduct} />)

    // Click show variants
    const showBtn = screen.getByText('Show variants')
    fireEvent.click(showBtn)

    expect(screen.getByText('Ruby Red')).toBeInTheDocument()
    expect(screen.getByText('24K Gold Dipped')).toBeInTheDocument()
  })

  it('calls onAddToCart when add button clicked', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    const onAdd = vi.fn()
    render(<ProductCard product={mockProduct} onAddToCart={onAdd} />)

    const addBtn = screen.getByText('Add to Cart')
    fireEvent.click(addBtn)

    expect(onAdd).toHaveBeenCalledWith(mockProduct, expect.anything())
  })

  it('disables add to cart for out of stock products', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    const outOfStock = { ...mockProduct, totalStock: 0 }
    const onAdd = vi.fn()
    render(<ProductCard product={outOfStock} onAddToCart={onAdd} />)

    const addBtn = screen.getByText('Add to Cart')
    expect(addBtn).toBeDisabled()
  })

  it('renders product image when available', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    render(<ProductCard product={mockProduct} />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.shopify.com/rose.jpg')
  })

  it('applies highlight styles when isHighlighted is true', async () => {
    const ProductCard = (await import('@/components/ProductCard')).default
    const { container } = render(<ProductCard product={mockProduct} isHighlighted />)

    const card = container.querySelector('.product-card')
    expect(card?.className).toContain('border-purple-400')
  })
})

// ═══════════════════════════════════════════
// ChatMessage Tests
// ═══════════════════════════════════════════
describe('ChatMessage', () => {
  it('renders user messages right-aligned', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Show me Valentine gifts',
      timestamp: Date.now(),
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText('Show me Valentine gifts')).toBeInTheDocument()
  })

  it('renders assistant messages', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Here are some great Valentine gifts!',
      timestamp: Date.now(),
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText('Here are some great Valentine gifts!')).toBeInTheDocument()
  })

  it('renders system messages centered', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '3',
      role: 'system',
      content: 'Chat cleared',
      timestamp: Date.now(),
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText('Chat cleared')).toBeInTheDocument()
  })

  it('renders product carousel when products are provided', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '4',
      role: 'assistant',
      content: 'Here are my recommendations:',
      timestamp: Date.now(),
      products: [mockProduct],
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText('Eternal Rose & Gold Leaf Crystal Box')).toBeInTheDocument()
  })

  it('renders checkout link when checkoutUrl is provided', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '5',
      role: 'assistant',
      content: 'Your checkout is ready!',
      timestamp: Date.now(),
      checkoutUrl: 'https://store.myshopify.com/checkout/abc',
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText('Open Checkout')).toBeInTheDocument()
  })

  it('renders cart summary when cartState is provided', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '6',
      role: 'assistant',
      content: 'Added to cart!',
      timestamp: Date.now(),
      cartState: {
        cartId: 'cart-1',
        checkoutUrl: 'https://store.myshopify.com/checkout/abc',
        lines: [{
          lineId: 'line-1',
          variantId: '101',
          productTitle: 'Eternal Rose',
          variantTitle: 'Ruby Red',
          quantity: 1,
          price: '189.95',
          currency: 'INR',
        }],
        totalAmount: '189.95',
        currency: 'INR',
        totalQuantity: 1,
      },
    }

    render(<ChatMessage message={msg} />)
    expect(screen.getByText(/Cart: 1 item/)).toBeInTheDocument()
    expect(screen.getByText('Open Checkout')).toBeInTheDocument()
  })

  it('strips GIDs and internal data from message content', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '7',
      role: 'assistant',
      content: 'Great choice! (variantId:12345) gid://shopify/ProductVariant/12345 [Products shown: 3]',
      timestamp: Date.now(),
    }

    render(<ChatMessage message={msg} />)
    const text = screen.getByText(/Great choice!/)
    expect(text.textContent).not.toContain('variantId')
    expect(text.textContent).not.toContain('gid://shopify')
    expect(text.textContent).not.toContain('[Products shown')
  })

  it('shows voice source icon for voice messages', async () => {
    const ChatMessage = (await import('@/components/ChatMessage')).default
    const msg: ChatMessage = {
      id: '8',
      role: 'user',
      content: 'Find birthday gifts',
      timestamp: Date.now(),
      source: 'voice',
    }

    const { container } = render(<ChatMessage message={msg} />)
    // Should have a mic icon SVG (Mic from lucide)
    const svgElements = container.querySelectorAll('svg')
    expect(svgElements.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════
// ProductCarousel Tests
// ═══════════════════════════════════════════
describe('ProductCarousel', () => {
  const manyProducts = Array.from({ length: 6 }, (_, i) => ({
    ...mockProduct,
    productId: i + 1,
    title: `Product ${i + 1}`,
  }))

  const fewProducts = Array.from({ length: 3 }, (_, i) => ({
    ...mockProduct,
    productId: i + 1,
    title: `Product ${i + 1}`,
  }))

  it('renders grid layout for ≤4 products', async () => {
    const ProductCarousel = (await import('@/components/ProductCarousel')).default
    const { container } = render(<ProductCarousel products={fewProducts} />)

    // Should use grid, not carousel
    const grid = container.querySelector('.grid')
    expect(grid).toBeTruthy()
  })

  it('renders horizontal carousel for 5+ products', async () => {
    const ProductCarousel = (await import('@/components/ProductCarousel')).default
    const { container } = render(<ProductCarousel products={manyProducts} />)

    const carousel = container.querySelector('.carousel-container')
    expect(carousel).toBeTruthy()
  })

  it('renders all product cards', async () => {
    const ProductCarousel = (await import('@/components/ProductCarousel')).default
    render(<ProductCarousel products={manyProducts} />)

    for (const p of manyProducts) {
      expect(screen.getByText(p.title)).toBeInTheDocument()
    }
  })

  it('highlights the specified product', async () => {
    const ProductCarousel = (await import('@/components/ProductCarousel')).default
    const { container } = render(
      <ProductCarousel products={fewProducts} highlightedProductId={2} />
    )

    const highlighted = container.querySelector('.border-purple-400')
    expect(highlighted).toBeTruthy()
  })
})

// ═══════════════════════════════════════════
// Orb Tests
// ═══════════════════════════════════════════
describe('Orb', () => {
  it('renders with disconnected state', async () => {
    const Orb = (await import('@/components/Orb')).default
    const { container } = render(<Orb state="disconnected" />)

    const orb = container.querySelector('button')
    expect(orb).toBeTruthy()
    // HALO tokens: disconnected uses muted bg with reduced opacity
    expect(orb?.className).toContain('opacity-50')
  })

  it('renders with speaking state', async () => {
    const Orb = (await import('@/components/Orb')).default
    const { container } = render(<Orb state="speaking" />)

    const orb = container.querySelector('button')
    // HALO tokens: speaking uses olive/sage gradient with speak animation
    expect(orb?.className).toContain('olive')
    expect(orb?.className).toContain('animate-orb-speak')
  })

  it('renders with listening state and ring animation', async () => {
    const Orb = (await import('@/components/Orb')).default
    const { container } = render(<Orb state="listening" />)

    const ring = container.querySelector('.animate-orb-ring')
    expect(ring).toBeTruthy()
  })

  it('supports different sizes', async () => {
    const Orb = (await import('@/components/Orb')).default

    const { container: sm } = render(<Orb state="idle" size="sm" />)
    expect(sm.querySelector('button')?.className).toContain('w-8')

    const { container: lg } = render(<Orb state="idle" size="lg" />)
    expect(lg.querySelector('button')?.className).toContain('w-28')
  })

  it('fires onClick when clicked', async () => {
    const Orb = (await import('@/components/Orb')).default
    const onClick = vi.fn()
    render(<Orb state="idle" onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has accessible aria-label for each state', async () => {
    const Orb = (await import('@/components/Orb')).default
    const states: VoiceState[] = ['disconnected', 'connecting', 'idle', 'listening', 'thinking', 'speaking']

    for (const state of states) {
      const { unmount } = render(<Orb state={state} />)
      const btn = screen.getByRole('button')
      expect(btn.getAttribute('aria-label')).toBeTruthy()
      unmount()
    }
  })
})

// ═══════════════════════════════════════════
// VoiceControls Tests
// ═══════════════════════════════════════════
describe('VoiceControls', () => {
  const defaultProps = {
    voiceState: 'disconnected' as VoiceState,
    micEnabled: true,
    speakerEnabled: true,
    onToggleMic: vi.fn(),
    onToggleSpeaker: vi.fn(),
    onConnect: vi.fn(),
    onDisconnect: vi.fn(),
  }

  it('shows connect button when disconnected', async () => {
    const VoiceControls = (await import('@/components/VoiceControls')).default
    render(<VoiceControls {...defaultProps} />)

    // The mic button should act as connect when disconnected
    const micBtn = screen.getByTitle('Start voice chat')
    expect(micBtn).toBeTruthy()
  })

  it('calls onConnect when mic clicked while disconnected', async () => {
    const VoiceControls = (await import('@/components/VoiceControls')).default
    const props = { ...defaultProps, onConnect: vi.fn() }
    render(<VoiceControls {...props} />)

    fireEvent.click(screen.getByTitle('Start voice chat'))
    expect(props.onConnect).toHaveBeenCalledOnce()
  })

  it('shows speaker toggle and end call when connected', async () => {
    const VoiceControls = (await import('@/components/VoiceControls')).default
    render(<VoiceControls {...defaultProps} voiceState="idle" />)

    expect(screen.getByTitle('Mute speaker')).toBeTruthy()
    expect(screen.getByTitle('End voice chat')).toBeTruthy()
  })

  it('calls onDisconnect when end call clicked', async () => {
    const VoiceControls = (await import('@/components/VoiceControls')).default
    const props = { ...defaultProps, voiceState: 'idle' as VoiceState, onDisconnect: vi.fn() }
    render(<VoiceControls {...props} />)

    fireEvent.click(screen.getByTitle('End voice chat'))
    expect(props.onDisconnect).toHaveBeenCalledOnce()
  })

  it('toggles mic when connected and mic clicked', async () => {
    const VoiceControls = (await import('@/components/VoiceControls')).default
    const props = { ...defaultProps, voiceState: 'idle' as VoiceState, onToggleMic: vi.fn() }
    render(<VoiceControls {...props} />)

    fireEvent.click(screen.getByTitle('Mute mic'))
    expect(props.onToggleMic).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════
// TranscriptStream Tests
// ═══════════════════════════════════════════
describe('TranscriptStream', () => {
  it('renders recent messages', async () => {
    const TranscriptStream = (await import('@/components/TranscriptStream')).default
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: Date.now(), source: 'voice' },
      { id: '2', role: 'assistant', content: 'Welcome!', timestamp: Date.now() },
    ]

    render(<TranscriptStream messages={messages} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Welcome!')).toBeInTheDocument()
  })

  it('shows AI prefix for assistant messages', async () => {
    const TranscriptStream = (await import('@/components/TranscriptStream')).default
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: 'Test response', timestamp: Date.now() },
    ]

    render(<TranscriptStream messages={messages} />)
    expect(screen.getByText('AI:')).toBeInTheDocument()
  })

  it('shows streaming cursor for streaming messages', async () => {
    const TranscriptStream = (await import('@/components/TranscriptStream')).default
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: 'Thinking', timestamp: Date.now(), streaming: true },
    ]

    const { container } = render(<TranscriptStream messages={messages} />)
    expect(container.textContent).toContain('▊')
  })
})

// ═══════════════════════════════════════════
// Stage Tests
// ═══════════════════════════════════════════
describe('Stage', () => {
  it('shows centered Orb in welcome state', async () => {
    const Stage = (await import('@/components/Stage')).default
    render(<Stage content="welcome" voiceState="idle" />)

    expect(screen.getByText(/Ready/)).toBeInTheDocument()
  })

  it('shows disconnect message when not connected', async () => {
    const Stage = (await import('@/components/Stage')).default
    render(<Stage content="welcome" voiceState="disconnected" />)

    expect(screen.getByText('Tap the mic to start voice shopping')).toBeInTheDocument()
  })

  it('renders product carousel in products state', async () => {
    const Stage = (await import('@/components/Stage')).default
    render(
      <Stage
        content="products"
        voiceState="idle"
        products={[mockProduct]}
      />
    )

    expect(screen.getByText(/1 product.* found/)).toBeInTheDocument()
    expect(screen.getByText('Eternal Rose & Gold Leaf Crystal Box')).toBeInTheDocument()
  })

  it('renders cart view in cart state', async () => {
    const Stage = (await import('@/components/Stage')).default
    const cartState = {
      cartId: 'cart-1',
      checkoutUrl: 'https://example.com/checkout',
      lines: [{
        lineId: 'line-1',
        variantId: '101',
        productTitle: 'Eternal Rose',
        variantTitle: 'Ruby Red',
        quantity: 2,
        price: '189.95',
        currency: 'INR',
      }],
      totalAmount: '379.90',
      currency: 'INR',
      totalQuantity: 2,
    }

    render(<Stage content="cart" voiceState="idle" cartState={cartState} />)
    expect(screen.getByText('🛒 Your Cart')).toBeInTheDocument()
    expect(screen.getByText('INR 379.90')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════
// StoreSwapModal Tests
// ═══════════════════════════════════════════
describe('StoreSwapModal', () => {
  it('renders modal when open', async () => {
    const StoreSwapModal = (await import('@/components/StoreSwapModal')).default
    render(
      <StoreSwapModal
        isOpen={true}
        onClose={vi.fn()}
        onConnect={vi.fn()}
        currentStore="jaguar-9969.myshopify.com"
      />
    )

    expect(screen.getByText('Switch Store')).toBeInTheDocument()
    expect(screen.getByText(/Currently connected/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('your-store.myshopify.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('shpat_...')).toBeInTheDocument()
  })

  it('does not render when closed', async () => {
    const StoreSwapModal = (await import('@/components/StoreSwapModal')).default
    const { container } = render(
      <StoreSwapModal
        isOpen={false}
        onClose={vi.fn()}
        onConnect={vi.fn()}
      />
    )

    expect(container.innerHTML).toBe('')
  })

  it('validates token format', async () => {
    const StoreSwapModal = (await import('@/components/StoreSwapModal')).default
    render(
      <StoreSwapModal
        isOpen={true}
        onClose={vi.fn()}
        onConnect={vi.fn()}
      />
    )

    const urlInput = screen.getByPlaceholderText('your-store.myshopify.com')
    const tokenInput = screen.getByPlaceholderText('shpat_...')
    const submitBtn = screen.getByText('Connect Store')

    fireEvent.change(urlInput, { target: { value: 'test.myshopify.com' } })
    fireEvent.change(tokenInput, { target: { value: 'invalid_token' } })
    fireEvent.click(submitBtn)

    expect(screen.getByText('Token should start with shpat_')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════
// CartPanel Tests
// ═══════════════════════════════════════════
describe('CartPanel', () => {
  it('shows empty cart message when no items', async () => {
    const CartPanel = (await import('@/components/CartPanel')).default
    render(<CartPanel isOpen={true} onClose={vi.fn()} cartState={null} />)

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('shows cart items and checkout button', async () => {
    const CartPanel = (await import('@/components/CartPanel')).default
    const cartState = {
      cartId: 'cart-1',
      checkoutUrl: 'https://example.com/checkout',
      lines: [{
        lineId: 'line-1',
        variantId: '101',
        productTitle: 'Eternal Rose',
        variantTitle: 'Ruby Red',
        quantity: 1,
        price: '189.95',
        currency: 'INR',
      }],
      totalAmount: '189.95',
      currency: 'INR',
      totalQuantity: 1,
    }

    render(<CartPanel isOpen={true} onClose={vi.fn()} cartState={cartState} />)
    expect(screen.getByText('Eternal Rose')).toBeInTheDocument()
    expect(screen.getByText('Proceed to Checkout')).toBeInTheDocument()
  })

  it('does not render when closed', async () => {
    const CartPanel = (await import('@/components/CartPanel')).default
    const { container } = render(<CartPanel isOpen={false} onClose={vi.fn()} cartState={null} />)

    expect(container.innerHTML).toBe('')
  })
})

// ═══════════════════════════════════════════
// HALO Design System Tests
// ═══════════════════════════════════════════
describe('HALO Design System Integration', () => {
  it('Orb uses HALO color tokens (olive/forest/sage)', async () => {
    const Orb = (await import('@/components/Orb')).default
    const states: VoiceState[] = ['idle', 'listening', 'thinking', 'speaking', 'connecting']

    for (const state of states) {
      const { container, unmount } = render(<Orb state={state} />)
      const btn = container.querySelector('button')
      const cls = btn?.className || ''
      // All active states should use HALO olive/forest/sage tokens
      expect(cls).toMatch(/olive|forest|sage|brand-green/)
      unmount()
    }
  })

  it('Orb has HALO motion animations', async () => {
    const Orb = (await import('@/components/Orb')).default

    const { container: idleCont, unmount: u1 } = render(<Orb state="idle" />)
    expect(idleCont.querySelector('button')?.className).toContain('animate-orb-breathe')
    u1()

    const { container: listenCont, unmount: u2 } = render(<Orb state="listening" />)
    expect(listenCont.querySelector('button')?.className).toContain('animate-orb-listen')
    u2()

    const { container: thinkCont, unmount: u3 } = render(<Orb state="thinking" />)
    expect(thinkCont.querySelector('button')?.className).toContain('animate-orb-think')
    u3()
  })

  it('Orb has HALO glow effects (shadow tokens)', async () => {
    const Orb = (await import('@/components/Orb')).default

    const { container, unmount } = render(<Orb state="listening" />)
    const btn = container.querySelector('button')
    expect(btn?.className).toContain('shadow-xl')
    expect(btn?.className).toContain('shadow-olive')
    unmount()
  })

  it('PromptCarousel renders suggestion pills', async () => {
    const { PromptCarousel } = await import('@/components/PromptCarousel')
    const onSelect = vi.fn()
    render(<PromptCarousel onSelect={onSelect} />)

    // Should have multiple prompt buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(3)
  })

  it('PromptCarousel fires onSelect when clicked', async () => {
    const { PromptCarousel } = await import('@/components/PromptCarousel')
    const onSelect = vi.fn()
    render(<PromptCarousel onSelect={onSelect} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onSelect).toHaveBeenCalledOnce()
    expect(typeof onSelect.mock.calls[0][0]).toBe('string')
  })
})
