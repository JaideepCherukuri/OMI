import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import crypto from 'crypto'

/**
 * Token API — Generate a LiveKit room token for the voice agent.
 *
 * Supports both GET (simple) and POST (with conversation context).
 *
 * POST body:
 *   room     — Optional room name (for reconnecting to existing session)
 *   identity — Optional participant identity
 *   context  — Conversation history from text mode (for seamless transition)
 *
 * GET query params:
 *   room     — Optional room name
 *   identity — Optional participant identity
 */

async function generateToken(
  roomName: string,
  identity: string,
  conversationContext?: string,
) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const serverUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !serverUrl) {
    throw new Error('LiveKit credentials not configured')
  }

  // Build participant metadata with conversation context
  const metadata: Record<string, string> = {}
  if (conversationContext) {
    metadata.conversationContext = conversationContext
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: '30m',
    metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
  })

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  const jwt = await token.toJwt()

  return {
    serverUrl,
    participantToken: jwt,
    participantName: identity,
    roomName,
  }
}

export async function GET(req: NextRequest) {
  try {
    const roomName =
      req.nextUrl.searchParams.get('room') ||
      `gift-${crypto.randomUUID()}`

    const identity =
      req.nextUrl.searchParams.get('identity') ||
      `user-${crypto.randomUUID().slice(0, 8)}`

    const result = await generateToken(roomName, identity)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Token generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const roomName =
      body.room ||
      req.nextUrl.searchParams.get('room') ||
      `gift-${crypto.randomUUID()}`

    const identity =
      body.identity ||
      req.nextUrl.searchParams.get('identity') ||
      `user-${crypto.randomUUID().slice(0, 8)}`

    // Conversation context from text mode (for seamless text→voice transition)
    const context = body.context || undefined

    const result = await generateToken(roomName, identity, context)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Token generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 },
    )
  }
}
