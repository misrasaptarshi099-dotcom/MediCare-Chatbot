import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, verifyWhatsAppSignature } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string
          text?: { body?: string }
          type?: string
        }>
      }
    }>
  }>
}

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

  return new NextResponse(challenge, { status: 200 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    const from = message?.from
    const text = message?.text?.body?.trim()

    // Ignore non-text events and status callbacks.
    if (!from || !text || message?.type !== 'text') {
      return NextResponse.json({ ok: true })
    }

    await sendWhatsAppMessage(
      from,
      'Thanks for reaching MediCare. Our WhatsApp assistant is being enabled now. Please continue in the patient portal chat for full booking support.'
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('WhatsApp webhook processing failed:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
