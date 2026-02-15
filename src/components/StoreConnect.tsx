'use client'

import { useState } from 'react'
import { Store, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { StoreCredentials } from '@/types'

interface Props {
  onConnect: (credentials: StoreCredentials) => void
}

export function StoreConnect({ onConnect }: Props) {
  const [storeUrl, setStoreUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setError(null)
    setIsVerifying(true)

    let url = storeUrl.trim()
    if (!url) {
      setError('Store URL is required')
      setIsVerifying(false)
      return
    }
    if (!accessToken.trim()) {
      setError('Access token is required')
      setIsVerifying(false)
      return
    }

    // Normalize URL
    url = url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    if (!url.includes('.myshopify.com')) {
      url = `${url}.myshopify.com`
    }

    const credentials: StoreCredentials = {
      storeUrl: url,
      accessToken: accessToken.trim(),
    }

    try {
      // Verify by fetching products
      const resp = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCredentials: credentials,
          action: 'list',
          includeMetafields: false,
        }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to connect')
      }

      onConnect(credentials)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect. Check your credentials.',
      )
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="max-w-md w-full mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
          <Store className="w-5 h-5 text-brand-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Connect Store</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Enter your Shopify store credentials
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Store URL
          </label>
          <input
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="your-store.myshopify.com"
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Access Token
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="shpat_..."
            className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/40 focus:outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={isVerifying}
          className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Connect Store
            </>
          )}
        </button>
      </div>

      <div className="mt-6 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Your credentials are sent directly to Shopify&apos;s API and are never stored
          on our servers. The token is only used for the duration of your
          session.
        </p>
      </div>
    </div>
  )
}
