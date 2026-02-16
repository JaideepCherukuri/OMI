import { AccessToken } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const roomName = req.nextUrl.searchParams.get('room') || 'gift-session'
  const identity = req.nextUrl.searchParams.get('identity') || `user_${Math.random().toString(36).substring(2, 11)}`

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const wsUrl = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
  }

  const at = new AccessToken(apiKey, apiSecret, { identity })
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true })
  const token = await at.toJwt()

  return NextResponse.json({ serverUrl: wsUrl, participantToken: token, participantName: identity })
}
