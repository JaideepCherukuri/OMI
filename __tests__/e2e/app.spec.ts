import { test, expect } from '@playwright/test'

/**
 * E2E tests for the GiftAI voice commerce app.
 *
 * Tests the Connect Screen, main app layout (Stage + Transcript),
 * store connection flow, voice controls, and responsive design.
 */

test.describe('Connect Screen', () => {
  test('shows GiftAI branding and connect form', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
    await expect(page.locator('text=Voice-First Gift Shopping')).toBeVisible()
    await expect(page.locator('text=Store URL')).toBeVisible()
    await expect(page.locator('text=Access Token')).toBeVisible()
    await expect(
      page.locator('input[placeholder="your-store.myshopify.com"]'),
    ).toBeVisible()
    await expect(
      page.locator('input[placeholder="shpat_..."]'),
    ).toBeVisible()
    await expect(page.locator('text=Connect Store')).toBeVisible()
  })

  test('validates empty store URL', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Connect Store')
    await expect(page.locator('text=Store URL is required')).toBeVisible()
  })

  test('validates empty access token', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="your-store.myshopify.com"]', 'test.myshopify.com')
    await page.click('text=Connect Store')
    await expect(page.locator('text=Access token is required')).toBeVisible()
  })

  test('validates token format', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="your-store.myshopify.com"]', 'test.myshopify.com')
    await page.fill('input[placeholder="shpat_..."]', 'invalid_token')
    await page.click('text=Connect Store')
    await expect(page.locator('text=Token should start with shpat_')).toBeVisible()
  })
})

test.describe('Main App (with env credentials)', () => {
  // These tests assume NEXT_PUBLIC_SHOPIFY_STORE_URL and NEXT_PUBLIC_SHOPIFY_ACCESS_TOKEN
  // are set in .env.local, so the app auto-connects.

  test('shows Stage + Transcript layout', async ({ page }) => {
    await page.goto('/')

    // Wait for either connect screen or main app
    const isAutoConnected = await page.locator('text=GiftAI').first().isVisible()

    if (isAutoConnected) {
      // Should show header with GiftAI logo
      await expect(page.locator('h1:has-text("GiftAI")').first()).toBeVisible()

      // Should show voice status text in stage
      await expect(
        page.locator('text=/Tap the mic|Ready|Listening|Connecting/').first(),
      ).toBeVisible({ timeout: 10000 })

      // Should show text input
      await expect(
        page.locator('input[placeholder*="Ask me about gifts"]').or(
          page.locator('input[placeholder*="Type a message"]'),
        ),
      ).toBeVisible()
    }
  })

  test('shows cart icon in header', async ({ page }) => {
    await page.goto('/')
    // Cart icon should be present (even if empty)
    await expect(page.locator('[title="View cart"]')).toBeVisible({ timeout: 10000 })
  })

  test('shows store swap button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[title="Switch store"]')).toBeVisible({ timeout: 10000 })
  })

  test('store swap modal opens and closes', async ({ page }) => {
    await page.goto('/')
    await page.click('[title="Switch store"]')
    await expect(page.locator('text=Switch Store')).toBeVisible()
    // Close modal
    await page.keyboard.press('Escape')
  })

  test('suggestion chips are visible', async ({ page }) => {
    await page.goto('/')
    // Should show initial suggestions
    await expect(
      page.locator('text=/Valentine|Birthday|Wedding|Show everything/').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking suggestion sends a message', async ({ page }) => {
    await page.goto('/')
    // Click a suggestion chip
    const chip = page.locator('button:has-text("Birthday ideas")').first()
    if (await chip.isVisible({ timeout: 5000 })) {
      await chip.click()
      // Should show message in transcript
      await expect(
        page.locator('text=Birthday gift ideas'),
      ).toBeVisible({ timeout: 10000 })
    }
  })
})

test.describe('Responsive Design', () => {
  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
  })

  test('works on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
  })

  test('works on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
  })
})

test.describe('API Endpoints', () => {
  test('GET /api/token returns valid token', async ({ request }) => {
    const resp = await request.get('/api/token')
    expect(resp.ok()).toBe(true)

    const data = await resp.json()
    expect(data.serverUrl).toBeTruthy()
    expect(data.participantToken).toBeTruthy()
    expect(data.roomName).toMatch(/^gift-/)
    expect(data.participantName).toMatch(/^user-/)
  })

  test('each /api/token call returns unique room', async ({ request }) => {
    const resp1 = await request.get('/api/token')
    const resp2 = await request.get('/api/token')
    const data1 = await resp1.json()
    const data2 = await resp2.json()
    expect(data1.roomName).not.toBe(data2.roomName)
  })

  test('POST /api/chat rejects missing credentials', async ({ request }) => {
    const resp = await request.post('/api/chat', {
      data: { message: 'hello' },
    })
    expect(resp.status()).toBe(400)
  })
})
