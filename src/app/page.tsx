'use client'

import { useRouter } from 'next/navigation'
import {
  Gift,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-brand-800/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Gift<span className="text-brand-400">AI</span>
          </h1>
        </div>

        <p className="text-lg text-[var(--text-secondary)] mb-12 max-w-md mx-auto leading-relaxed">
          AI-powered luxury gift store — browse curated gifts or manage your
          Shopify inventory through natural conversation.
        </p>

        {/* Mode cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* User Mode */}
          <button
            onClick={() => router.push('/user')}
            className="group relative p-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-brand-500/30 transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <ShoppingBag className="w-5 h-5 text-brand-400" />
              </div>
              <h2 className="text-lg font-semibold mb-1.5 flex items-center gap-2">
                Shop Gifts
                <ArrowRight className="w-4 h-4 text-brand-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Browse luxury gifts, get AI recommendations by occasion &
                budget, and checkout instantly.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Recommendations • Checkout • Chat</span>
              </div>
            </div>
          </button>

          {/* Admin Mode */}
          <button
            onClick={() => router.push('/admin')}
            className="group relative p-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-brand-500/30 transition-all duration-300 text-left"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
              </div>
              <h2 className="text-lg font-semibold mb-1.5 flex items-center gap-2">
                Admin Panel
                <ArrowRight className="w-4 h-4 text-brand-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Connect your Shopify store. Manage inventory, create products,
                and update stock via chat.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-[var(--text-secondary)]">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Inventory • CRUD • Analytics</span>
              </div>
            </div>
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)]/60">
          Powered by Gemini AI & Shopify Admin API
        </p>
      </div>
    </div>
  )
}
