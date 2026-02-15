import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GiftAI — Luxury Gift Store',
  description: 'AI-powered luxury gift shopping and store management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[var(--bg-primary)]">
        {children}
      </body>
    </html>
  )
}
