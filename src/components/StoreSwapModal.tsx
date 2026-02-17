'use client'

/**
 * StoreSwapModal — HALO Design System styled store switcher.
 */

import { useState } from 'react'
import type { StoreCredentials } from '@/types'
import { X, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StoreSwapModalProps {
  isOpen: boolean
  onClose: () => void
  onConnect: (credentials: StoreCredentials) => void
  currentStore?: string
}

export default function StoreSwapModal({ isOpen, onClose, onConnect, currentStore }: StoreSwapModalProps) {
  const [storeUrl, setStoreUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const url = storeUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    const token = accessToken.trim()
    if (!url || !token) {
      setError('Both fields are required')
      return
    }
    if (!token.startsWith('shpat_') && !token.startsWith('Shpat_')) {
      setError('Token should start with shpat_')
      return
    }
    onConnect({ storeUrl: url, accessToken: token })
    setStoreUrl('')
    setAccessToken('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--card)] rounded-[var(--radius)] shadow-2xl w-full max-w-md p-6 mx-4">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-[var(--muted)]/30 rounded-[var(--radius)]">
          <X className="w-5 h-5 text-[var(--muted-foreground)]" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">Switch Store</h2>
        </div>

        {currentStore && (
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Currently connected: <span className="font-medium text-[var(--foreground)]">{currentStore}</span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
              placeholder="your-store.myshopify.com"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-[var(--radius)] text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Access Token</label>
            <input
              type="password"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="shpat_..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-[var(--radius)] text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] outline-none"
            />
          </div>

          {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-2.5 bg-[var(--brand)] text-[var(--brand-foreground)] rounded-[var(--radius)] font-medium hover:opacity-90 transition-all"
          >
            Connect Store
          </button>
        </form>
      </div>
    </div>
  )
}
