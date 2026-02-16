import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import crypto from 'crypto'

/**
 * GET /api/token — Generate a LiveKit room token for the voice agent.
 *
 * Each request creates a unique room name (gift-{uuid}) unless a specific
 * room is provided. This ensures per-session isolation per the PRD.
 *
 * Query params:
 *   room     — Optional room name (for reconnecting to existing session)
 *   identity — Optional participant identity (for reconnecting)
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const serverUrl = process.env.LIVEKIT_URL

    if (!apiKey || !apiSecret || !serverUrl) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 },
      )
    }

    // Per-session room names (PRD 3.1.1)
    const roomName =
      req.nextUrl.searchParams.get('room') ||
      `gift-${crypto.randomUUID()}`

    const identity =
      req.nextUrl.searchParams.get('identity') ||
      `user-${crypto.randomUUID().slice(0, 8)}`

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '30m',
    })

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    const jwt = await token.toJwt()

    return NextResponse.json({
      serverUrl,
      participantToken: jwt,
      participantName: identity,
      roomName,
    })
  } catch (err) {
    console.error('Token generation error:', err)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 },
    )
  }
}
