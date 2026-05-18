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

/**
 * Retrieve the WhatsApp phone number ID from the environment.
 *
 * @returns The value of `WHATSAPP_PHONE_NUMBER_ID`.
 * @throws Error if `WHATSAPP_PHONE_NUMBER_ID` is not set.
 */
function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  return id
}

/**
 * Retrieve the WhatsApp Cloud API access token from the environment.
 *
 * @returns The value of `process.env.WHATSAPP_ACCESS_TOKEN`.
 * @throws Error if `WHATSAPP_ACCESS_TOKEN` is not set.
 */
function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set')
  return token
}

/**
 * Verifies that a WhatsApp webhook signature matches the HMAC-SHA256 of the raw request body.
 *
 * @param rawBody - The raw request body used to compute the expected HMAC
 * @param signatureHeader - The `X-Hub-Signature-256` header value (must start with `sha256=`); may be `null`
 * @returns `true` if the provided signature equals the computed HMAC, `false` otherwise (also `false` when the app secret is not configured or the header is malformed)
 */

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

/**
 * Send a prepared JSON payload to the WhatsApp Cloud API for the configured phone number.
 *
 * @param payload - The message payload to POST to the WhatsApp messages endpoint (must match the Graph API message schema)
 * @throws Error when the HTTP response is not OK (contains status and response body)
 */

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

/**
 * Sends a plain text WhatsApp message to the specified recipient.
 *
 * @param to - Recipient phone number or WhatsApp ID in international format
 * @param text - Message body to send
 */

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

/**
 * Send an interactive reply-button message via the WhatsApp Cloud API.
 *
 * @param to - Recipient phone number in international format (country code + number)
 * @param bodyText - Main message body displayed above the buttons
 * @param buttons - Array of reply buttons; each item must include an `id` and `title` (maximum 3 buttons)
 * @param headerText - Optional header text shown above the message body
 * @param footerText - Optional footer text shown below the buttons
 * @throws Error if more than 3 buttons are provided
 */
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

/**
 * Sends an interactive list message to a WhatsApp recipient.
 *
 * @param to - Recipient phone number in WhatsApp format (e.g., including country code)
 * @param bodyText - Main body text of the list message
 * @param buttonLabel - Label shown on the action button (recommended max 20 characters)
 * @param sections - Array of list sections; each section contains a title and an array of rows with `id`, `title`, and optional `description`
 * @param headerText - Optional header text to display above the body
 * @param footerText - Optional footer text to display below the list
 */
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

/**
 * Sends a document file to a WhatsApp recipient using the WhatsApp Cloud API.
 *
 * @param to - Recipient phone number in international format (e.g., "15551234567")
 * @param documentUrl - Publicly accessible URL linking to the document file
 * @param filename - Filename presented to the recipient for the downloaded document
 * @param caption - Optional caption text shown with the document
 */

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

/**
 * Marks the specified WhatsApp message as read (sends a read receipt) for the configured phone number.
 *
 * @param messageId - The WhatsApp message ID to mark as read
 */

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
