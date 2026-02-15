'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldCheck, Store } from 'lucide-react'
import type { StoreCredentials } from '@/types'
import { StoreConnect } from '@/components/StoreConnect'
import { ChatInterface } from '@/components/ChatInterface'

export default function AdminPage() {
  const router = useRouter()
  const [credentials, setCredentials] = useState<StoreCredentials | null>(null)

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <h1 className="text-sm font-semibold">Admin Panel</h1>
            </div>
          </div>

          {credentials && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
              <Store className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-300">
                {credentials.storeUrl}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {credentials ? (
          <ChatInterface mode="admin" credentials={credentials} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <StoreConnect onConnect={setCredentials} />
          </div>
        )}
      </div>
    </div>
  )
}
