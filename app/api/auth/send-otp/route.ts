import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { saveOtp } from '@/lib/db'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { patientOtpSchema, validateInput } from '@/lib/sanitize'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(request: Request) {
  const ip = getClientIp(request)

  // Rate limit: 5 OTPs per hour per IP
  const ipCheck = checkRateLimit(rateLimitKey('patient-otp-ip', ip), 5, 60 * 60 * 1000)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many OTP requests. Please try again later.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Input validation
  const validation = validateInput(patientOtpSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  let normalizedIdentifier = validation.data.identifier.trim()
  const isPhone = /^\+?[0-9]{10,15}$/.test(normalizedIdentifier)

  // Normalize early: lowercase for emails so case variations share the same bucket
  if (!isPhone) {
    normalizedIdentifier = normalizedIdentifier.toLowerCase()
  }

  // Ensure phone numbers have a country code (default to +91 for India if missing)
  if (isPhone && !normalizedIdentifier.startsWith('+')) {
    if (normalizedIdentifier.length === 10) {
      normalizedIdentifier = '+91' + normalizedIdentifier
    } else {
      normalizedIdentifier = '+' + normalizedIdentifier
    }
  }

  // Rate limit: 5 OTPs per hour per identifier
  const idCheck = checkRateLimit(rateLimitKey('patient-otp-id', normalizedIdentifier), 5, 60 * 60 * 1000)
  if (!idCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many OTP requests for this identifier. Please try again later.' },
      { status: 429 }
    )
  }

  // Generate a secure 6-digit OTP
  const code = String(crypto.randomInt(100000, 1000000))
  const expiresAt = Date.now() + OTP_TTL_MS

  // Persist the OTP in Firestore ONLY after successful delivery

  if (isPhone) {
    // Check if an SMS provider is configured (Twilio, MSG91, etc.)
    const smsConfigured = !!(process.env.TWILIO_ACCOUNT_SID || process.env.MSG91_AUTH_KEY || process.env.SMS_PROVIDER)

    if (smsConfigured) {
      // TODO: Integrate actual SMS provider here (Twilio, MSG91, AWS SNS)
      // await sendSms(normalizedIdentifier, `Your MediCare code is: ${code}`)
      console.error('SMS Provider is configured in env but SMS integration code is not yet implemented')
      return NextResponse.json(
        { error: 'SMS integration is not fully implemented yet' },
        { status: 501 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      await saveOtp(normalizedIdentifier, code, expiresAt, 'patient')
      console.log(`\n\n📱 [MOCK SMS] OTP for ${normalizedIdentifier} is: ${code}\n\n`)
      return NextResponse.json({ success: true, message: 'OTP sent to phone (mock)' })
    }

    // Production with no SMS provider configured — fail explicitly
    console.error('SMS OTP requested but no SMS provider is configured')
    return NextResponse.json(
      { error: 'SMS delivery is not configured. Please use email login or contact support.' },
      { status: 503 }
    )
  }

  // Send the OTP via email
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transporter.sendMail({
      from: `"MediCare Patient Portal" <${process.env.EMAIL_USER}>`,
      to: normalizedIdentifier,
      subject: 'Your MediCare Login Code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2563eb; border-radius: 10px; padding: 12px 18px;">
              <span style="color: white; font-size: 20px; font-weight: 700;">🏥 MediCare</span>
            </div>
          </div>
          <h2 style="color: #111827; text-align: center; margin-bottom: 8px;">Your Login Code</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Use this code to sign into the Patient Portal. It expires in 10 minutes.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e5e7eb; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #2563eb; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #9ca3af; text-align: center; font-size: 13px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Failed to send email. Please check server email configuration.' }, { status: 500 })
  }

  await saveOtp(normalizedIdentifier, code, expiresAt, 'patient')
  return NextResponse.json({ success: true })
}

