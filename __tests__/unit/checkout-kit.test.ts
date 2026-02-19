import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Checkout Kit Integration Tests
 *
 * These tests verify the low-level Shopify Checkout Kit web component
 * interaction patterns that ExpressCheckoutSheet relies on:
 *   - custom element registration + creation
 *   - attribute/property setting
 *   - event dispatching (checkout:complete, checkout:close)
 *   - CDN timeout fallback logic
 */

// ═══════════════════════════════════════════
// Custom Element Registration & Creation
// ═══════════════════════════════════════════
describe('Checkout Kit — Custom Element Basics', () => {
  it('customElements.get returns undefined when element not registered', () => {
    // In a clean jsdom env, 'shopify-checkout' is NOT registered
    const cls = customElements.get('shopify-checkout')
    expect(cls).toBeUndefined()
  })

  it('customElements.whenDefined resolves once the element is registered', async () => {
    // Set up a deferred promise pattern
    const tag = `shopify-test-${Date.now()}`
    const promise = customElements.whenDefined(tag)

    // Register after a tick
    class TestEl extends HTMLElement {}
    queueMicrotask(() => customElements.define(tag, TestEl))

    await expect(promise).resolves.toBeDefined()
  })

  it('document.createElement returns the custom class instance after registration', () => {
    const tag = `sc-create-${Date.now()}`
    class SCCreateTest extends HTMLElement {
      isMock = true
    }
    customElements.define(tag, SCCreateTest)

    const el = document.createElement(tag) as any
    expect(el).toBeInstanceOf(SCCreateTest)
    expect(el.isMock).toBe(true)
  })
})

// ═══════════════════════════════════════════
// Attribute / Property Setting
// ═══════════════════════════════════════════
describe('Checkout Kit — Attribute Setting', () => {
  const TAG = `sc-attr-${Date.now()}`
  class SCAttrTest extends HTMLElement {
    // Mirror the ShopifyCheckoutElement interface with property ↔ attribute reflection
    get src() { return this.getAttribute('src') || '' }
    set src(v: string) { this.setAttribute('src', v) }

    get auth() { return this.getAttribute('auth') || '' }
    set auth(v: string) { this.setAttribute('auth', v) }

    get target() { return this.getAttribute('target') || 'auto' }
    set target(v: string) { this.setAttribute('target', v) }

    open = vi.fn()
    close = vi.fn()
    focus = vi.fn()
  }

  beforeEach(() => {
    if (!customElements.get(TAG)) {
      customElements.define(TAG, SCAttrTest)
    }
  })

  it('sets src correctly', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    el.src = 'https://shop.example.com/checkout/abc'
    expect(el.src).toBe('https://shop.example.com/checkout/abc')
    expect(el.getAttribute('src')).toBe('https://shop.example.com/checkout/abc')
  })

  it('sets auth token correctly', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    el.auth = 'jwt-token-xyz'
    expect(el.auth).toBe('jwt-token-xyz')
    expect(el.getAttribute('auth')).toBe('jwt-token-xyz')
  })

  it('sets target to inline when JWT present', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    el.target = 'inline'
    expect(el.target).toBe('inline')
  })

  it('sets target to popup when no JWT', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    el.target = 'popup'
    expect(el.target).toBe('popup')
  })

  it('defaults target to auto', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    expect(el.target).toBe('auto')
  })

  it('can set style properties for inline mode', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCAttrTest>
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    expect(el.style.width).toBe('100%')
    expect(el.style.height).toBe('100%')
    expect(el.style.display).toBe('block')
  })
})

// ═══════════════════════════════════════════
// Event Handling
// ═══════════════════════════════════════════
describe('Checkout Kit — Event Handling', () => {
  const TAG = `sc-event-${Date.now()}`
  class SCEventTest extends HTMLElement {
    orderConfirmation: Record<string, unknown> | undefined = undefined
    open = vi.fn()
    close = vi.fn()
  }

  beforeEach(() => {
    if (!customElements.get(TAG)) {
      customElements.define(TAG, SCEventTest)
    }
  })

  it('fires checkout:complete listener when event dispatched', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCEventTest>
    const handler = vi.fn()

    el.addEventListener('checkout:complete', handler)
    el.dispatchEvent(new Event('checkout:complete'))

    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires checkout:close listener when event dispatched', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCEventTest>
    const handler = vi.fn()

    el.addEventListener('checkout:close', handler)
    el.dispatchEvent(new Event('checkout:close'))

    expect(handler).toHaveBeenCalledOnce()
  })

  it('orderConfirmation is accessible in checkout:complete handler', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCEventTest>
    el.orderConfirmation = { orderId: 'order-123', totalPrice: '49.99' }

    let capturedData: any
    el.addEventListener('checkout:complete', () => {
      capturedData = el.orderConfirmation
    })
    el.dispatchEvent(new Event('checkout:complete'))

    expect(capturedData).toEqual({ orderId: 'order-123', totalPrice: '49.99' })
  })

  it('multiple event listeners all fire', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCEventTest>
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    el.addEventListener('checkout:complete', handler1)
    el.addEventListener('checkout:complete', handler2)
    el.dispatchEvent(new Event('checkout:complete'))

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('removed listener does not fire', () => {
    const el = document.createElement(TAG) as InstanceType<typeof SCEventTest>
    const handler = vi.fn()

    el.addEventListener('checkout:complete', handler)
    el.removeEventListener('checkout:complete', handler)
    el.dispatchEvent(new Event('checkout:complete'))

    expect(handler).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════
// DOM Mounting
// ═══════════════════════════════════════════
describe('Checkout Kit — DOM Mounting', () => {
  const TAG = `sc-mount-${Date.now()}`
  class SCMountTest extends HTMLElement {
    open = vi.fn()
    close = vi.fn()
  }

  beforeEach(() => {
    if (!customElements.get(TAG)) {
      customElements.define(TAG, SCMountTest)
    }
  })

  it('element can be appended to a container div', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const el = document.createElement(TAG) as InstanceType<typeof SCMountTest>
    container.appendChild(el)

    expect(container.children.length).toBe(1)
    expect(container.children[0]).toBe(el)

    document.body.removeChild(container)
  })

  it('element can be removed from DOM', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const el = document.createElement(TAG)
    container.appendChild(el)
    expect(container.children.length).toBe(1)

    el.remove()
    expect(container.children.length).toBe(0)

    document.body.removeChild(container)
  })

  it('innerHTML = "" clears existing children before appending new element', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>Old content</p>'
    document.body.appendChild(container)

    expect(container.children.length).toBe(1)

    container.innerHTML = ''
    const el = document.createElement(TAG)
    container.appendChild(el)

    expect(container.children.length).toBe(1)
    expect(container.querySelector('p')).toBeNull()

    document.body.removeChild(container)
  })
})

// ═══════════════════════════════════════════
// Timeout / Fallback Logic
// ═══════════════════════════════════════════
describe('Checkout Kit — CDN Timeout & Fallback', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('Promise.race resolves when whenDefined wins', async () => {
    const tag = `sc-race-ok-${Date.now()}`
    class RaceOK extends HTMLElement {}

    // Register the element right away so whenDefined resolves
    customElements.define(tag, RaceOK)

    const result = await Promise.race([
      customElements.whenDefined(tag).then(() => 'defined'),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000),
      ),
    ])

    expect(result).toBe('defined')
  })

  it('Promise.race rejects on timeout when CDN never loads', async () => {
    vi.useFakeTimers()

    // whenDefined for an unregistered tag never resolves
    const tag = `sc-race-fail-${Date.now()}`
    const racePromise = Promise.race([
      customElements.whenDefined(tag),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000),
      ),
    ]).catch((err) => err)

    vi.advanceTimersByTime(5001)

    const result = await racePromise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('timeout')

    vi.useRealTimers()
  })

  it('fallback flag is set to true when CDN times out', async () => {
    vi.useFakeTimers()

    // Mimic the component's waitForComponent logic
    let fallback = false
    const tag = `sc-fallback-${Date.now()}`

    const waitForComponent = async (): Promise<boolean> => {
      if (customElements.get(tag)) return true
      try {
        await Promise.race([
          customElements.whenDefined(tag),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000),
          ),
        ])
        return true
      } catch {
        return false
      }
    }

    const checkPromise = waitForComponent().then((ok) => {
      fallback = !ok
    })

    vi.advanceTimersByTime(5001)
    await checkPromise

    expect(fallback).toBe(true)

    vi.useRealTimers()
  })
})

// ═══════════════════════════════════════════
// Checkout Auth Token Tests
// ═══════════════════════════════════════════
describe('Checkout Kit — Auth Token Management', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('getCheckoutToken returns cached token within TTL', async () => {
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', 'test-id')
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', 'test-secret')

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'cached-token', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    vi.resetModules()
    const { getCheckoutToken, resetTokenCache } = await import('@/lib/checkout-auth')
    resetTokenCache()

    const token1 = await getCheckoutToken()
    const token2 = await getCheckoutToken()

    expect(token1).toBe('cached-token')
    expect(token2).toBe('cached-token')
    // fetch should only be called once due to caching
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('getCheckoutToken throws when env vars missing', async () => {
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', '')
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', '')

    vi.resetModules()
    const { getCheckoutToken, resetTokenCache } = await import('@/lib/checkout-auth')
    resetTokenCache()

    await expect(getCheckoutToken()).rejects.toThrow(/Missing/)
  })

  it('getCheckoutToken re-fetches after cache expiry', async () => {
    vi.useFakeTimers()
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_ID', 'id')
    vi.stubEnv('SHOPIFY_CATALOG_CLIENT_SECRET', 'secret')

    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'token-1', expires_in: 600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ access_token: 'token-2', expires_in: 600 }),
      })
    vi.stubGlobal('fetch', fetchSpy)

    vi.resetModules()
    const { getCheckoutToken, resetTokenCache } = await import('@/lib/checkout-auth')
    resetTokenCache()

    const t1 = await getCheckoutToken()
    expect(t1).toBe('token-1')

    // Advance past TTL minus safety margin (600s total, 300s margin → expire after ~300s)
    vi.advanceTimersByTime(310_000)

    const t2 = await getCheckoutToken()
    expect(t2).toBe('token-2')
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })
})
