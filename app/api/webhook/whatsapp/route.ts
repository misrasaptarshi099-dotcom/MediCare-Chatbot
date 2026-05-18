/**
 * WhatsApp Webhook — Meta Cloud API
 *
 * GET  → Webhook verification handshake (one-time Meta setup)
 * POST → Receives all incoming messages, button clicks, and list selections
 *
 * Security: POST requests are verified using X-Hub-Signature-256
 * with HMAC-SHA256 + crypto.timingSafeEqual.
 */

import { NextResponse } from 'next/server'
import { verifyWhatsAppSignature, markAsRead } from '@/lib/whatsapp'
import { handleWhatsAppMessage, type IncomingMessage } from '@/lib/wa-flows'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
}

interface WhatsAppWebhookPayload {
  object: string
  entry?: Array<{
    id: string
    changes?: Array<{
      value?: {
        messaging_product: string
        metadata?: { phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: WhatsAppMessage[]
        statuses?: unknown[]
      }
      field: string
    }>
  }>
}

// ── GET: Webhook Verification ─────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !challenge) {
    return new NextResponse('Invalid webhook verification request', { status: 400 })
  }

  if (!process.env.WHATSAPP_VERIFY_TOKEN || token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse('Verification token mismatch', { status: 403 })
  }

  // Meta expects the challenge echoed back as plain text
  return new NextResponse(challenge, { status: 200 })
}

// ── POST: Incoming Messages ───────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody = await request.text()

  // Verify webhook signature (skip if WHATSAPP_APP_SECRET is not yet set during dev)
  const signature = request.headers.get('x-hub-signature-256')
  if (process.env.WHATSAPP_APP_SECRET) {
    if (!verifyWhatsAppSignature(rawBody, signature)) {
      console.error('WhatsApp webhook: invalid signature')
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
  }

  try {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload

    // Meta sends status updates (delivered, read) — ignore them
    const changes = payload.entry?.[0]?.changes?.[0]?.value
    if (!changes?.messages || changes.messages.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // Process each incoming message
    for (const message of changes.messages) {
      const incoming = parseIncomingMessage(message)
      if (!incoming) continue

      // Mark as read (blue ticks) — fire and forget
      markAsRead(message.id).catch(() => {})

      // Route through the conversation state machine
      await handleWhatsAppMessage(incoming)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook processing failed:', error)
    // Always return 200 to Meta to prevent retries on our errors
    return NextResponse.json({ ok: true })
  }
}

// ── Message Parser ────────────────────────────────────────────────────────────

function parseIncomingMessage(message: WhatsAppMessage): IncomingMessage | null {
  const from = message.from
  const messageId = message.id

  if (!from || !messageId) return null

  // Text message
  if (message.type === 'text' && message.text?.body) {
    return {
      from,
      messageId,
      type: 'text',
      text: message.text.body.trim(),
    }
  }

  // Button reply (user tapped a quick-reply button)
  if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
    return {
      from,
      messageId,
      type: 'interactive',
      buttonReplyId: message.interactive.button_reply?.id,
    }
  }

  // List reply (user selected from a scrollable list)
  if (message.type === 'interactive' && message.interactive?.type === 'list_reply') {
    return {
      from,
      messageId,
      type: 'interactive',
      listReplyId: message.interactive.list_reply?.id,
    }
  }

  // Unsupported message type (images, voice, etc.) — ignore
  return null
}
