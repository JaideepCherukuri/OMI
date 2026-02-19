/**
 * Secure Buyer Vault API
 *
 * Stores encrypted buyer profile data in an httpOnly cookie.
 * Uses AES-256-GCM encryption so the cookie value is opaque to the browser.
 *
 * GET  — Read the current buyer profile (decrypts cookie)
 * POST — Save/update the buyer profile (encrypts → cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { encrypt, decrypt } from '@/lib/vault-crypto'

// ── Constants ──

const VAULT_COOKIE = 'omi_vault'
const MAX_COOKIE_SIZE = 4096 // browsers cap cookies at ~4 KB

// ── Types ──

export interface VaultAddress {
  label?: string
  firstName: string
  lastName: string
  streetAddress: string
  addressLocality: string   // city
  addressRegion: string     // state / province
  postalCode: string
  addressCountry: string    // ISO 3166-1 alpha-2
}

export interface BuyerProfile {
  email: string
  phone?: string
  firstName: string
  lastName: string
  addresses: VaultAddress[]
}

// ── Helpers ──

function validateProfile(body: unknown): body is BuyerProfile {
  if (!body || typeof body !== 'object') return false
  const p = body as Record<string, unknown>
  return (
    typeof p.email === 'string' &&
    typeof p.firstName === 'string' &&
    typeof p.lastName === 'string' &&
    Array.isArray(p.addresses)
  )
}

// ── GET: Read vault ──

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get(VAULT_COOKIE)
    if (!cookie?.value) {
      return NextResponse.json({ profile: null })
    }

    const json = decrypt(cookie.value)
    const profile: BuyerProfile = JSON.parse(json)

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('Vault GET error:', err)
    // Corrupt or tampered cookie — clear it
    const resp = NextResponse.json({ profile: null, error: 'Vault read failed' })
    resp.cookies.delete(VAULT_COOKIE)
    return resp
  }
}

// ── POST: Save vault ──

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!validateProfile(body)) {
      return NextResponse.json(
        { error: 'Invalid buyer profile. Required: email, firstName, lastName, addresses[]' },
        { status: 400 },
      )
    }

    const profile: BuyerProfile = {
      email: body.email,
      phone: body.phone || undefined,
      firstName: body.firstName,
      lastName: body.lastName,
      addresses: body.addresses,
    }

    const json = JSON.stringify(profile)
    const encrypted = encrypt(json)

    // Guard against cookie size limit
    if (encrypted.length > MAX_COOKIE_SIZE) {
      return NextResponse.json(
        { error: 'Profile too large for cookie storage. Try reducing addresses.' },
        { status: 413 },
      )
    }

    const resp = NextResponse.json({ success: true, profile })

    resp.cookies.set(VAULT_COOKIE, encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })

    return resp
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vault save failed'
    console.error('Vault POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
