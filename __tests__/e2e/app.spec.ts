import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('shows the GiftAI branding and mode cards', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
    await expect(page.locator('text=Shop Gifts')).toBeVisible()
    await expect(page.locator('text=Admin Panel')).toBeVisible()
  })

  test('navigates to user mode', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Shop Gifts')
    await expect(page).toHaveURL('/user')
    await expect(page.locator('text=Gift Shop')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connect Store' })).toBeVisible()
  })

  test('navigates to admin mode', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Admin Panel')
    await expect(page).toHaveURL('/admin')
    await expect(page.locator('h1:has-text("Admin Panel")')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connect Store' })).toBeVisible()
  })
})

test.describe('Admin Page', () => {
  test('shows store connect form', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('text=Store URL')).toBeVisible()
    await expect(page.locator('text=Access Token')).toBeVisible()
    await expect(
      page.locator('input[placeholder="your-store.myshopify.com"]'),
    ).toBeVisible()
    await expect(
      page.locator('input[placeholder="shpat_..."]'),
    ).toBeVisible()
  })

  test('shows error for empty credentials', async ({ page }) => {
    await page.goto('/admin')
    await page.click('button:has-text("Connect Store")')
    // Should show validation error
    await expect(page.locator('text=Store URL is required')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/admin')
    await page.fill(
      'input[placeholder="your-store.myshopify.com"]',
      'fake-store.myshopify.com',
    )
    await page.fill('input[placeholder="shpat_..."]', 'shpat_invalid_token')
    await page.click('button:has-text("Connect Store")')
    // Should show error after trying to verify
    await expect(page.locator('text=/Failed|Unauthorized|Error/')).toBeVisible({
      timeout: 15000,
    })
  })

  test('back button returns to landing', async ({ page }) => {
    await page.goto('/admin')
    // Find the back arrow button
    await page.locator('button').first().click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('User Page', () => {
  test('shows store connect form', async ({ page }) => {
    await page.goto('/user')
    await expect(page.locator('text=Store URL')).toBeVisible()
    await expect(page.locator('text=Access Token')).toBeVisible()
  })

  test('shows Gift Shop header', async ({ page }) => {
    await page.goto('/user')
    await expect(page.locator('text=Gift Shop')).toBeVisible()
  })

  test('back button returns to landing', async ({ page }) => {
    await page.goto('/user')
    await page.locator('button').first().click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Responsive Design', () => {
  test('landing page works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('text=GiftAI')).toBeVisible()
    await expect(page.locator('text=Shop Gifts')).toBeVisible()
    await expect(page.locator('text=Admin Panel')).toBeVisible()
  })
})
