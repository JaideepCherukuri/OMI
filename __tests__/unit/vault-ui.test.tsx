import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// ── Helpers ──────────────────────────────────────────

const MOCK_PROFILE = {
  email: 'jane@example.com',
  phone: '+1234567890',
  firstName: 'Jane',
  lastName: 'Doe',
  addresses: [
    {
      label: 'Home',
      firstName: 'Jane',
      lastName: 'Doe',
      streetAddress: '123 Main St',
      addressLocality: 'Springfield',
      addressRegion: 'IL',
      postalCode: '62704',
      addressCountry: 'US',
    },
  ],
}

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; body: any }>) {
  const fetchMock = vi.fn()
  for (const resp of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 400),
      json: () => Promise.resolve(resp.body),
    })
  }
  return fetchMock
}

// ═══════════════════════════════════════════
// BuyerVaultModal Tests
// ═══════════════════════════════════════════
describe('BuyerVaultModal', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Default: no existing profile (GET returns null)
    fetchMock = mockFetchSequence([{ ok: true, body: { profile: null } }])
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Open / Close ──

  it('renders modal with header when isOpen is true', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Buyer Vault')).toBeInTheDocument()
    expect(screen.getByText(/Encrypted/)).toBeInTheDocument()
  })

  it('does not render when isOpen is false', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    const { container } = render(<BuyerVaultModal isOpen={false} onClose={vi.fn()} />)

    expect(container.innerHTML).toBe('')
  })

  it('calls onClose when X button clicked', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    const onClose = vi.fn()
    render(<BuyerVaultModal isOpen={true} onClose={onClose} />)

    const closeBtn = screen.getByLabelText('Close vault')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on Escape key', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    const onClose = vi.fn()
    render(<BuyerVaultModal isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when clicking the backdrop', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    const onClose = vi.fn()
    const { container } = render(<BuyerVaultModal isOpen={true} onClose={onClose} />)

    // The first motion.div child is the backdrop with the onClick={onClose}
    // We rendered it as a plain <div>, so find the first child div with the backdrop class
    const divs = container.querySelectorAll('div')
    // The backdrop is the first child div (before the modal)
    const backdrop = divs[0]
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })

  // ── Loading state ──

  it('shows loading spinner on open', async () => {
    // Make fetch hang
    const hangingFetch = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', hangingFetch)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Loading vault…')).toBeInTheDocument()
  })

  // ── Form fields ──

  it('renders all form fields after loading', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Personal info section header
    expect(screen.getByText('Personal info')).toBeInTheDocument()

    // "First name" / "Last name" appear in both personal info AND address sections
    // so we check for ≥ 1 occurrence (getAllByText returns all matches)
    expect(screen.getAllByText('First name').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Last name').length).toBeGreaterThanOrEqual(1)

    // Email and Phone are unique to the personal info section
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Phone (optional)')).toBeInTheDocument()

    // Address section
    expect(screen.getByText('Shipping addresses')).toBeInTheDocument()
  })

  it('renders address sub-fields when expanded', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Default address should be expanded (index 0)
    expect(screen.getByText('Street address', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('City', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('State / Province', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Postal code', { selector: 'label' })).toBeInTheDocument()
    expect(screen.getByText('Country (ISO)', { selector: 'label' })).toBeInTheDocument()
  })

  it('shows "Save to vault" button for new profile', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Save to vault')).toBeInTheDocument()
    })
  })

  // ── Validation ──

  it('shows validation error when email is empty', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Click save without filling anything
    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })
  })

  it('shows validation error for invalid email', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Fill only email with invalid value
    const emailInput = screen.getAllByRole('textbox').find(
      (el) => el.getAttribute('type') === 'email',
    )!
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
    })
  })

  it('shows validation error when first name is empty', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument()
    })
  })

  it('shows validation error when required address fields are missing', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('Street is required')).toBeInTheDocument()
      expect(screen.getByText('City is required')).toBeInTheDocument()
      expect(screen.getByText('Postal code is required')).toBeInTheDocument()
      expect(screen.getByText('Country is required')).toBeInTheDocument()
    })
  })

  // ── Save ──

  it('calls POST /api/vault with correct data on save', async () => {
    // GET returns null, then POST succeeds
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: null } },
      { ok: true, body: { success: true, profile: MOCK_PROFILE } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Fill in all required fields
    const inputs = screen.getAllByRole('textbox')
    // We need to target specific inputs by their type/label.
    // The component renders inputs in this order:
    //   firstName, lastName, email, phone, (address fields)

    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const telInput = inputs.find((el) => el.getAttribute('type') === 'tel')!
    // firstName and lastName are the first two text inputs
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    // Personal info
    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })     // firstName
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })      // lastName
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })

    // Address fields (expanded by default for index 0)
    // Address fields start from textInputs[2] onwards:
    // label, firstName, lastName, streetAddress, city, state, postalCode, country
    fireEvent.change(textInputs[2], { target: { value: 'Home' } })       // label
    fireEvent.change(textInputs[3], { target: { value: 'Jane' } })       // addr firstName
    fireEvent.change(textInputs[4], { target: { value: 'Doe' } })        // addr lastName
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } }) // street
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } }) // city
    fireEvent.change(textInputs[7], { target: { value: 'IL' } })         // state
    fireEvent.change(textInputs[8], { target: { value: '62704' } })      // postal
    fireEvent.change(textInputs[9], { target: { value: 'US' } })         // country

    // Click save
    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      // The second fetch call should be POST /api/vault
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const postCall = fetchMock.mock.calls[1]
      expect(postCall[0]).toBe('/api/vault')
      expect(postCall[1].method).toBe('POST')

      const body = JSON.parse(postCall[1].body)
      expect(body.email).toBe('jane@example.com')
      expect(body.firstName).toBe('Jane')
      expect(body.lastName).toBe('Doe')
    })
  })

  it('shows success message after saving', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: null } },
      { ok: true, body: { success: true, profile: MOCK_PROFILE } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Fill minimal valid data
    const inputs = screen.getAllByRole('textbox')
    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } })
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } })
    fireEvent.change(textInputs[8], { target: { value: '62704' } })
    fireEvent.change(textInputs[9], { target: { value: 'US' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('Profile saved securely')).toBeInTheDocument()
    })
  })

  it('shows error message on save failure', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: null } },
      { ok: false, status: 500, body: { error: 'Encryption failed' } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Fill minimal valid data
    const inputs = screen.getAllByRole('textbox')
    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } })
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } })
    fireEvent.change(textInputs[8], { target: { value: '62704' } })
    fireEvent.change(textInputs[9], { target: { value: 'US' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText('Encryption failed')).toBeInTheDocument()
    })
  })

  // ── Load existing profile ──

  it('loads existing profile on mount', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: MOCK_PROFILE } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Check that the email input is populated
    const emailInput = screen
      .getAllByRole('textbox')
      .find((el) => el.getAttribute('type') === 'email') as HTMLInputElement

    expect(emailInput.value).toBe('jane@example.com')

    // Shows "Update profile" instead of "Save to vault" for existing data
    expect(screen.getByText('Update profile')).toBeInTheDocument()
  })

  it('shows "Clear saved data" button for existing profile', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: MOCK_PROFILE } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Clear saved data')).toBeInTheDocument()
    })
  })

  // ── Clear data ──

  it('calls DELETE /api/vault when clear button clicked', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: MOCK_PROFILE } },
      { ok: true, body: { success: true } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Clear saved data')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clear saved data'))

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls[1]
      expect(deleteCall[0]).toBe('/api/vault')
      expect(deleteCall[1].method).toBe('DELETE')
    })
  })

  it('shows success message after clearing data', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: MOCK_PROFILE } },
      { ok: true, body: { success: true } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Clear saved data')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clear saved data'))

    await waitFor(() => {
      expect(screen.getByText('Saved data cleared')).toBeInTheDocument()
    })
  })

  it('calls onVaultChange(false) after clearing', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: MOCK_PROFILE } },
      { ok: true, body: { success: true } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const onVaultChange = vi.fn()
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} onVaultChange={onVaultChange} />)

    await waitFor(() => {
      expect(screen.getByText('Clear saved data')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clear saved data'))

    await waitFor(() => {
      expect(onVaultChange).toHaveBeenCalledWith(false)
    })
  })

  it('calls onVaultChange(true) after saving', async () => {
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: null } },
      { ok: true, body: { success: true, profile: MOCK_PROFILE } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const onVaultChange = vi.fn()
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} onVaultChange={onVaultChange} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('textbox')
    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } })
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } })
    fireEvent.change(textInputs[8], { target: { value: '62704' } })
    fireEvent.change(textInputs[9], { target: { value: 'US' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(onVaultChange).toHaveBeenCalledWith(true)
    })
  })

  // ── Multiple addresses ──

  it('can add a new address', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Should have "Add address" button
    const addBtn = screen.getByText('Add address')
    fireEvent.click(addBtn)

    // Now there should be two address sections (Home + Address 2)
    const addressHeaders = screen.getAllByRole('button').filter(
      (btn) => btn.textContent?.includes('Home') || btn.textContent?.includes('Address'),
    )
    expect(addressHeaders.length).toBeGreaterThanOrEqual(2)
  })

  it('can remove an address when multiple exist', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Add a second address
    fireEvent.click(screen.getByText('Add address'))

    // Should now have remove buttons (trash icons)
    const removeButtons = screen.getAllByTitle('Remove address')
    expect(removeButtons.length).toBeGreaterThanOrEqual(1)

    // Click remove on the first one
    fireEvent.click(removeButtons[0])

    // Should still have at least one address section
    await waitFor(() => {
      const updatedRemoves = screen.queryAllByTitle('Remove address')
      // With only 1 address left, remove button disappears (only shown when > 1)
      expect(updatedRemoves.length).toBeLessThan(removeButtons.length)
    })
  })

  it('hides "Add address" when max addresses (5) reached', async () => {
    // Load a profile with 5 addresses
    const profile5 = {
      ...MOCK_PROFILE,
      addresses: Array.from({ length: 5 }, (_, i) => ({
        ...MOCK_PROFILE.addresses[0],
        label: `Address ${i + 1}`,
      })),
    }
    fetchMock = mockFetchSequence([
      { ok: true, body: { profile: profile5 } },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    expect(screen.queryByText('Add address')).not.toBeInTheDocument()
  })

  // ── Loading states ──

  it('shows "Encrypting & saving…" while saving', async () => {
    // GET returns null, POST hangs
    const hangingPost = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      })
      .mockReturnValueOnce(new Promise(() => {})) // POST never resolves
    vi.stubGlobal('fetch', hangingPost)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    // Fill minimal valid data
    const inputs = screen.getAllByRole('textbox')
    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } })
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } })
    fireEvent.change(textInputs[8], { target: { value: '62704' } })
    fireEvent.change(textInputs[9], { target: { value: 'US' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText(/Encrypting & saving/)).toBeInTheDocument()
    })
  })

  // ── Privacy notice ──

  it('shows encryption privacy notice', async () => {
    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    expect(screen.getByText(/AES-256 encrypted/)).toBeInTheDocument()
    expect(screen.getByText(/stored only in your browser/)).toBeInTheDocument()
  })

  // ── Network error handling ──

  it('handles network error on load gracefully', async () => {
    fetchMock = vi.fn().mockRejectedValueOnce(new Error('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    // Should eventually stop loading and show the form (empty)
    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
      expect(screen.getByText('Save to vault')).toBeInTheDocument()
    })
  })

  it('handles network error on save', async () => {
    fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ profile: null }),
      })
      .mockRejectedValueOnce(new Error('Network failure'))
    vi.stubGlobal('fetch', fetchMock)

    const BuyerVaultModal = (await import('@/components/chat/BuyerVaultModal')).default
    render(<BuyerVaultModal isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading vault…')).not.toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('textbox')
    const emailInput = inputs.find((el) => el.getAttribute('type') === 'email')!
    const textInputs = inputs.filter(
      (el) => !el.getAttribute('type') || el.getAttribute('type') === 'text',
    )

    fireEvent.change(textInputs[0], { target: { value: 'Jane' } })
    fireEvent.change(textInputs[1], { target: { value: 'Doe' } })
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } })
    fireEvent.change(textInputs[5], { target: { value: '123 Main St' } })
    fireEvent.change(textInputs[6], { target: { value: 'Springfield' } })
    fireEvent.change(textInputs[8], { target: { value: '62704' } })
    fireEvent.change(textInputs[9], { target: { value: 'US' } })

    fireEvent.click(screen.getByText('Save to vault'))

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
