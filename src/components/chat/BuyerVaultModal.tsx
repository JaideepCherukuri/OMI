'use client'

/**
 * BuyerVaultModal — Secure buyer profile manager.
 *
 * Centered modal overlay for managing saved buyer details (email, phone,
 * name, shipping addresses). Persists via encrypted httpOnly cookie through
 * the /api/vault endpoint.
 *
 * HALO Design System styled. Framer-motion animated.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Shield, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types (mirror vault/route.ts)                                      */
/* ------------------------------------------------------------------ */

interface VaultAddress {
  label?: string
  firstName: string
  lastName: string
  streetAddress: string
  addressLocality: string
  addressRegion: string
  postalCode: string
  addressCountry: string
}

interface BuyerProfile {
  email: string
  phone?: string
  firstName: string
  lastName: string
  addresses: VaultAddress[]
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface BuyerVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onVaultChange?: (hasData: boolean) => void
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EMPTY_ADDRESS: VaultAddress = {
  label: '',
  firstName: '',
  lastName: '',
  streetAddress: '',
  addressLocality: '',
  addressRegion: '',
  postalCode: '',
  addressCountry: '',
}

const EMPTY_PROFILE: BuyerProfile = {
  email: '',
  phone: '',
  firstName: '',
  lastName: '',
  addresses: [{ ...EMPTY_ADDRESS, label: 'Home' }],
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BuyerVaultModal({
  isOpen,
  onClose,
  onVaultChange,
}: BuyerVaultModalProps) {
  const [profile, setProfile] = useState<BuyerProfile>({ ...EMPTY_PROFILE, addresses: [{ ...EMPTY_ADDRESS, label: 'Home' }] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [hasExisting, setHasExisting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [expandedAddresses, setExpandedAddresses] = useState<Set<number>>(new Set([0]))

  /* ---- Fetch existing vault data on open ---- */
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setStatus(null)
    setErrors({})

    fetch('/api/vault')
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile)
          setHasExisting(true)
          // Expand all addresses that have data
          const expanded = new Set<number>()
          data.profile.addresses.forEach((_: VaultAddress, i: number) => expanded.add(i))
          setExpandedAddresses(expanded)
        } else {
          setProfile({ ...EMPTY_PROFILE, addresses: [{ ...EMPTY_ADDRESS, label: 'Home' }] })
          setHasExisting(false)
          setExpandedAddresses(new Set([0]))
        }
      })
      .catch(() => {
        setProfile({ ...EMPTY_PROFILE, addresses: [{ ...EMPTY_ADDRESS, label: 'Home' }] })
        setHasExisting(false)
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  /* ---- Escape key ---- */
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  /* ---- Field updaters ---- */
  const updateField = useCallback((field: keyof BuyerProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const updateAddress = useCallback((index: number, field: keyof VaultAddress, value: string) => {
    setProfile((prev) => {
      const addresses = [...prev.addresses]
      addresses[index] = { ...addresses[index], [field]: value }
      return { ...prev, addresses }
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`addr_${index}_${field}`]
      return next
    })
  }, [])

  const addAddress = useCallback(() => {
    setProfile((prev) => ({
      ...prev,
      addresses: [...prev.addresses, { ...EMPTY_ADDRESS }],
    }))
    setExpandedAddresses((prev) => {
      const next = new Set(prev)
      next.add(profile.addresses.length)
      return next
    })
  }, [profile.addresses.length])

  const removeAddress = useCallback((index: number) => {
    setProfile((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== index),
    }))
    setExpandedAddresses((prev) => {
      const next = new Set<number>()
      prev.forEach((v) => {
        if (v < index) next.add(v)
        else if (v > index) next.add(v - 1)
      })
      return next
    })
  }, [])

  const toggleAddress = useCallback((index: number) => {
    setExpandedAddresses((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  /* ---- Validate ---- */
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}

    if (!profile.email.trim()) errs.email = 'Email is required'
    else if (!isValidEmail(profile.email.trim())) errs.email = 'Enter a valid email'

    if (!profile.firstName.trim()) errs.firstName = 'First name is required'
    if (!profile.lastName.trim()) errs.lastName = 'Last name is required'

    profile.addresses.forEach((addr, i) => {
      if (!addr.streetAddress.trim()) errs[`addr_${i}_streetAddress`] = 'Street is required'
      if (!addr.addressLocality.trim()) errs[`addr_${i}_addressLocality`] = 'City is required'
      if (!addr.postalCode.trim()) errs[`addr_${i}_postalCode`] = 'Postal code is required'
      if (!addr.addressCountry.trim()) errs[`addr_${i}_addressCountry`] = 'Country is required'
    })

    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [profile])

  /* ---- Save ---- */
  const handleSave = useCallback(async () => {
    if (!validate()) return

    setSaving(true)
    setStatus(null)

    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus({ type: 'error', message: data.error || 'Save failed' })
        return
      }

      setStatus({ type: 'success', message: 'Profile saved securely' })
      setHasExisting(true)
      onVaultChange?.(true)

      // Auto-close after a beat
      setTimeout(() => onClose(), 1200)
    } catch {
      setStatus({ type: 'error', message: 'Network error — please try again' })
    } finally {
      setSaving(false)
    }
  }, [profile, validate, onClose, onVaultChange])

  /* ---- Clear vault ---- */
  const handleClear = useCallback(async () => {
    setClearing(true)
    setStatus(null)

    try {
      const res = await fetch('/api/vault', { method: 'DELETE' })
      if (res.ok) {
        setProfile({ ...EMPTY_PROFILE, addresses: [{ ...EMPTY_ADDRESS, label: 'Home' }] })
        setHasExisting(false)
        setExpandedAddresses(new Set([0]))
        onVaultChange?.(false)
        setStatus({ type: 'success', message: 'Saved data cleared' })
      } else {
        setStatus({ type: 'error', message: 'Failed to clear data' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error' })
    } finally {
      setClearing(false)
    }
  }, [onVaultChange])

  /* ---- Render ---- */
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'fixed inset-x-4 top-[5vh] sm:inset-auto sm:left-1/2 sm:top-1/2',
              'sm:-translate-x-1/2 sm:-translate-y-1/2',
              'z-[71] w-auto sm:w-full sm:max-w-md',
              'bg-[var(--card)] rounded-[calc(var(--radius)*1.5)] overflow-hidden',
              'border border-[var(--border)] shadow-2xl font-sans',
              'max-h-[90vh] flex flex-col',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[var(--brand)]/10 flex items-center justify-center">
                  <Shield size={14} className="text-[var(--brand)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--card-foreground)] uppercase tracking-[0.12em] font-mono">
                    Buyer Vault
                  </h3>
                  <p className="text-[10px] text-[var(--muted-foreground)] tracking-wide">
                    Encrypted &middot; Stored locally
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius)] hover:bg-[var(--muted)]/30 transition-colors"
                aria-label="Close vault"
              >
                <X size={18} className="text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 size={24} className="text-[var(--brand)] animate-spin" />
                  <p className="text-sm text-[var(--muted-foreground)]">Loading vault…</p>
                </div>
              ) : (
                <>
                  {/* ── Personal Info ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)] mb-1">
                      Personal info
                    </legend>

                    <div className="grid grid-cols-2 gap-3">
                      <VaultInput
                        label="First name"
                        value={profile.firstName}
                        onChange={(v) => updateField('firstName', v)}
                        error={errors.firstName}
                        autoComplete="given-name"
                      />
                      <VaultInput
                        label="Last name"
                        value={profile.lastName}
                        onChange={(v) => updateField('lastName', v)}
                        error={errors.lastName}
                        autoComplete="family-name"
                      />
                    </div>

                    <VaultInput
                      label="Email"
                      value={profile.email}
                      onChange={(v) => updateField('email', v)}
                      error={errors.email}
                      type="email"
                      autoComplete="email"
                    />

                    <VaultInput
                      label="Phone (optional)"
                      value={profile.phone || ''}
                      onChange={(v) => updateField('phone', v)}
                      type="tel"
                      autoComplete="tel"
                    />
                  </fieldset>

                  {/* ── Addresses ── */}
                  <fieldset className="space-y-3">
                    <legend className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)] mb-1">
                      Shipping addresses
                    </legend>

                    {profile.addresses.map((addr, i) => {
                      const isExpanded = expandedAddresses.has(i)
                      const addrLabel = addr.label || `Address ${i + 1}`

                      return (
                        <div
                          key={i}
                          className="border border-[var(--border)] rounded-[var(--radius)] overflow-hidden"
                        >
                          {/* Address header (collapsible) */}
                          <button
                            type="button"
                            onClick={() => toggleAddress(i)}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[var(--muted)]/15 hover:bg-[var(--muted)]/25 transition-colors text-left"
                          >
                            <span className="text-xs font-medium text-[var(--card-foreground)]">
                              {addrLabel}
                              {addr.streetAddress && (
                                <span className="text-[var(--muted-foreground)] font-normal ml-1.5">
                                  — {addr.streetAddress.slice(0, 30)}{addr.streetAddress.length > 30 ? '…' : ''}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {profile.addresses.length > 1 && (
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); removeAddress(i) }}
                                  className="p-1 rounded hover:bg-red-500/10 transition-colors"
                                  title="Remove address"
                                >
                                  <Trash2 size={12} className="text-[var(--muted-foreground)] hover:text-red-500" />
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp size={14} className="text-[var(--muted-foreground)]" />
                              ) : (
                                <ChevronDown size={14} className="text-[var(--muted-foreground)]" />
                              )}
                            </div>
                          </button>

                          {/* Address fields (expandable) */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3.5 py-3 space-y-3">
                                  <VaultInput
                                    label="Label (e.g. Home, Work)"
                                    value={addr.label || ''}
                                    onChange={(v) => updateAddress(i, 'label', v)}
                                    small
                                  />

                                  <div className="grid grid-cols-2 gap-3">
                                    <VaultInput
                                      label="First name"
                                      value={addr.firstName}
                                      onChange={(v) => updateAddress(i, 'firstName', v)}
                                      autoComplete="shipping given-name"
                                      small
                                    />
                                    <VaultInput
                                      label="Last name"
                                      value={addr.lastName}
                                      onChange={(v) => updateAddress(i, 'lastName', v)}
                                      autoComplete="shipping family-name"
                                      small
                                    />
                                  </div>

                                  <VaultInput
                                    label="Street address"
                                    value={addr.streetAddress}
                                    onChange={(v) => updateAddress(i, 'streetAddress', v)}
                                    error={errors[`addr_${i}_streetAddress`]}
                                    autoComplete="shipping street-address"
                                    small
                                  />

                                  <div className="grid grid-cols-2 gap-3">
                                    <VaultInput
                                      label="City"
                                      value={addr.addressLocality}
                                      onChange={(v) => updateAddress(i, 'addressLocality', v)}
                                      error={errors[`addr_${i}_addressLocality`]}
                                      autoComplete="shipping address-level2"
                                      small
                                    />
                                    <VaultInput
                                      label="State / Province"
                                      value={addr.addressRegion}
                                      onChange={(v) => updateAddress(i, 'addressRegion', v)}
                                      autoComplete="shipping address-level1"
                                      small
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <VaultInput
                                      label="Postal code"
                                      value={addr.postalCode}
                                      onChange={(v) => updateAddress(i, 'postalCode', v)}
                                      error={errors[`addr_${i}_postalCode`]}
                                      autoComplete="shipping postal-code"
                                      small
                                    />
                                    <VaultInput
                                      label="Country (ISO)"
                                      value={addr.addressCountry}
                                      onChange={(v) => updateAddress(i, 'addressCountry', v.toUpperCase().slice(0, 2))}
                                      error={errors[`addr_${i}_addressCountry`]}
                                      placeholder="US"
                                      autoComplete="shipping country"
                                      maxLength={2}
                                      small
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    {/* Add address */}
                    {profile.addresses.length < 5 && (
                      <button
                        type="button"
                        onClick={addAddress}
                        className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[var(--border)] rounded-[var(--radius)] text-xs text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      >
                        <Plus size={12} />
                        Add address
                      </button>
                    )}
                  </fieldset>

                  {/* ── Status message ── */}
                  <AnimatePresence mode="wait">
                    {status && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-[var(--radius)] text-xs',
                          status.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400',
                        )}
                      >
                        {status.type === 'success' ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <AlertCircle size={14} />
                        )}
                        {status.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* ── Footer ── */}
            {!loading && (
              <div className="flex-shrink-0 px-5 py-3.5 border-t border-[var(--border)] space-y-2.5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5',
                    'bg-[var(--brand)] hover:opacity-90 text-[var(--brand-foreground)]',
                    'rounded-[var(--radius)] font-medium text-sm transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Encrypting & saving…
                    </>
                  ) : (
                    <>
                      <Shield size={14} />
                      {hasExisting ? 'Update profile' : 'Save to vault'}
                    </>
                  )}
                </button>

                {hasExisting && (
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className={cn(
                      'w-full flex items-center justify-center gap-1.5 py-2',
                      'text-xs text-[var(--muted-foreground)] hover:text-red-500',
                      'rounded-[var(--radius)] transition-colors',
                      'disabled:opacity-50',
                    )}
                  >
                    {clearing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                    Clear saved data
                  </button>
                )}

                <p className="text-[10px] text-center text-[var(--muted-foreground)]/70 leading-relaxed">
                  Your data is AES-256 encrypted and stored only in your browser.
                  <br />
                  We never send it to any server.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/*  VaultInput — Tiny input component (HALO-styled)                    */
/* ------------------------------------------------------------------ */

function VaultInput({
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
  maxLength,
  small,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  small?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className={cn(
        'block font-medium text-[var(--muted-foreground)]',
        small ? 'text-[10px]' : 'text-[11px]',
      )}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          'w-full px-3 rounded-[var(--radius)] border bg-transparent font-sans transition-colors',
          'text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)]/40',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]',
          small ? 'py-1.5 text-xs' : 'py-2 text-sm',
          error
            ? 'border-red-400 dark:border-red-500/60'
            : 'border-[var(--border)]',
        )}
      />
      {error && (
        <p className="text-[10px] text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
