/**
 * WhatsApp Cloud API Client — Meta Business Platform
 *
 * Sends text, interactive buttons, interactive lists, and document
 * messages through the official Meta WhatsApp Cloud API.
 *
 * All functions are stateless and safe to call from serverless handlers.
 */

import crypto from 'crypto'

// ── Configuration ─────────────────────────────────────────────────────────────

const WA_API_VERSION = 'v22.0'
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  return id
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set')
  return token
}

// ── Signature Verification ────────────────────────────────────────────────────

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')}`

  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(signatureHeader)

  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

// ── Low-level sender ──────────────────────────────────────────────────────────

async function sendToWhatsApp(payload: Record<string, unknown>): Promise<void> {
  const phoneNumberId = getPhoneNumberId()
  const accessToken = getAccessToken()

  const url = `${WA_BASE_URL}/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`WhatsApp API error [${res.status}]:`, errorBody)
    throw new Error(`WhatsApp API returned ${res.status}: ${errorBody}`)
  }
}

// ── Public: Send plain text ───────────────────────────────────────────────────

export async function sendTextMessage(to: string, text: string): Promise<void> {
  await sendToWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  })
}

// ── Public: Send reply buttons (max 3) ────────────────────────────────────────

export interface ReplyButton {
  id: string    // max 256 chars — your internal action ID
  title: string // max 20 chars — what the user sees
}

export async function sendButtonMessage(
  to: string,
  bodyText: string,
  buttons: ReplyButton[],
  headerText?: string,
  footerText?: string,
): Promise<void> {
  if (buttons.length > 3) {
    throw new Error('WhatsApp allows max 3 reply buttons per message')
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map(b => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      })),
    },
  }

  if (headerText) interactive.header = { type: 'text', text: headerText }
  if (footerText) interactive.footer = { text: footerText }

  await sendToWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  })
}

// ── Public: Send a list menu (up to 10 items per section) ─────────────────────

export interface ListRow {
  id: string           // max 200 chars
  title: string        // max 24 chars
  description?: string // max 72 chars
}

export interface ListSection {
  title: string // max 24 chars
  rows: ListRow[]
}

export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
  headerText?: string,
  footerText?: string,
): Promise<void> {
  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonLabel, // max 20 chars
      sections,
    },
  }

  if (headerText) interactive.header = { type: 'text', text: headerText }
  if (footerText) interactive.footer = { text: footerText }

  await sendToWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  })
}

// ── Public: Send a document (e.g. lab report PDF) ─────────────────────────────

export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string,
): Promise<void> {
  const document: Record<string, string> = {
    link: documentUrl,
    filename,
  }
  if (caption) document.caption = caption

  await sendToWhatsApp({
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document,
  })
}

// ── Public: Mark a message as read (blue ticks) ───────────────────────────────

export async function markAsRead(messageId: string): Promise<void> {
  const phoneNumberId = getPhoneNumberId()
  const accessToken = getAccessToken()

  await fetch(`${WA_BASE_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  })
}
