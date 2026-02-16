import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, storeCredentials, history, cartId, cartState: clientCartState, mcpSessionId } = body

    if (!message || !storeCredentials?.storeUrl || !storeCredentials?.accessToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const response = await chat(message, storeCredentials, history || [], cartId, clientCartState, mcpSessionId)
    return NextResponse.json(response)
  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
