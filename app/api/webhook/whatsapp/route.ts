/**
 * WhatsApp Webhook — Meta Cloud API
 *
 * GET  → Webhook verification handshake (one-time Meta setup)
 * POST → Receives all incoming messages, button clicks, and list selections
 *
 * Security:
 * - POST requests are verified using X-Hub-Signature-256 (HMAC-SHA256 + timingSafeEqual)
 * - Signature bypass is ONLY permitted in development mode (NODE_ENV === 'development')
 * - All entry/changes batches are processed (no dropped messages from batched webhooks)
 * - Idempotency: duplicate message.id values are tracked and skipped
 */

import { NextResponse } from 'next/server'
import { verifyWhatsAppSignature, markAsRead } from '@/lib/whatsapp'
import { handleWhatsAppMessage, type IncomingMessage } from '@/lib/wa-flows'
import { db } from '@/lib/firestore'

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

// ── Idempotency ───────────────────────────────────────────────────────────────

const PROCESSED_COLLECTION = 'waProcessedMessages'

/**
 * Checks if a message has already been processed and marks it if not.
 * Uses Firestore for durable, cross-instance idempotency.
 * Returns true if the message was already processed (should be skipped).
 */
async function isMessageAlreadyProcessed(messageId: string): Promise<boolean> {
  const docRef = db.collection(PROCESSED_COLLECTION).doc(messageId)

  try {
    // Atomically claim this message ID — create() fails if doc already exists
    await docRef.create({
      processedAt: new Date().toISOString(),
      // Auto-expire after 24 hours (Firestore TTL policy can enforce this)
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    return false
  } catch (error: unknown) {
    // ALREADY_EXISTS (code 6) means another instance already claimed this message
    if (error instanceof Error && 'code' in error && (error as { code: number }).code === 6) {
      return true
    }
    // Other Firestore errors — allow processing (better to double-send than drop)
    console.error(`Idempotency check failed for message ${messageId}`)
    return false
  }
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

  // ── SECURITY: Webhook Signature Verification ──────────────────────────────
  // Only bypass signature check in local development.
  // In production, ALWAYS reject unsigned or mis-signed requests.
  const signature = request.headers.get('x-hub-signature-256')
  const isDev = process.env.NODE_ENV === 'development'

  if (!process.env.WHATSAPP_APP_SECRET) {
    if (!isDev) {
      console.error('CRITICAL: WHATSAPP_APP_SECRET is not configured in production')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }
    // Dev-only: allow unsigned requests with a warning
    console.warn('⚠️ DEV MODE: Skipping WhatsApp signature verification (WHATSAPP_APP_SECRET not set)')
  } else {
    // Secret is configured — enforce signature check in ALL environments
    if (!verifyWhatsAppSignature(rawBody, signature)) {
      console.error('WhatsApp webhook: invalid signature — rejecting request')
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
  }

  try {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload

    // ── BATCH PROCESSING: Iterate ALL entries and changes ──────────────────
    // Meta can batch multiple entries and changes in a single POST.
    // We must process every message across all of them.
    const messages: WhatsAppMessage[] =
      payload.entry?.flatMap(entry =>
        entry.changes?.flatMap(change => change.value?.messages ?? []) ?? []
      ) ?? []

    // If no messages (status updates, delivery receipts, etc.), acknowledge
    if (messages.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // Process each incoming message with idempotency
    let processedCount = 0
    let errorCount = 0

    for (const message of messages) {
      const incoming = parseIncomingMessage(message)
      if (!incoming) continue

      // ── IDEMPOTENCY: Skip already-processed messages ────────────────────
      const alreadyProcessed = await isMessageAlreadyProcessed(message.id)
      if (alreadyProcessed) {
        console.log(`Skipping duplicate message: ${message.id}`)
        continue
      }

      // Mark as read (blue ticks) — fire and forget
      markAsRead(message.id).catch(() => {})

      // Route through the conversation state machine
      try {
        await handleWhatsAppMessage(incoming)
        processedCount++
      } catch (error) {
        errorCount++
        console.error(`Failed to process message ${message.id}:`, error)
        // Continue processing remaining messages in the batch
      }
    }

    // If ALL messages in a batch failed, signal an error to Meta so it retries
    if (processedCount === 0 && errorCount > 0) {
      console.error(`All ${errorCount} messages in batch failed — requesting Meta retry`)
      return NextResponse.json({ error: 'All messages failed processing' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook payload parsing failed:', error)
    // Return 500 for parse failures so Meta retries the delivery
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ── Message Parser ────────────────────────────────────────────────────────────

function parseIncomingMessage(message: WhatsAppMessage): IncomingMessage | null {
  const from = message.from
  const messageId = message.id

  if (!from || !messageId) return null

  // ── INPUT VALIDATION: Sanitize phone number format ──────────────────────
  // WhatsApp sends E.164 format (digits only, no +). Reject anything else.
  if (!/^\d{7,15}$/.test(from)) {
    console.warn(`Rejecting message with invalid phone format: ${from}`)
    return null
  }

  // Text message
  if (message.type === 'text' && message.text?.body) {
    return {
      from,
      messageId,
      type: 'text',
      // Limit text length to prevent abuse (WhatsApp max is 4096 chars)
      text: message.text.body.trim().slice(0, 4096),
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

  // Unsupported message type (images, voice, etc.) — ignore silently
  return null
}
