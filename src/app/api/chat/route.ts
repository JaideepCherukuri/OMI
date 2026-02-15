import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/gemini'
import type { ChatRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json()

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      )
    }

    if (!body.storeCredentials?.storeUrl || !body.storeCredentials?.accessToken) {
      return NextResponse.json(
        { error: 'Store credentials are required' },
        { status: 400 },
      )
    }

    const response = await chat(
      body.message,
      body.mode,
      body.storeCredentials,
      body.history || [],
    )

    return NextResponse.json(response)
  } catch (err) {
    console.error('Chat API error:', err)
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
