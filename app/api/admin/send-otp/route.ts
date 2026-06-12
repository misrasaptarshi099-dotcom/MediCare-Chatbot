import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import {
  getAdminUserByEmail,
  saveOtp,
  type User,
} from '@/lib/db'
import { db } from '@/lib/firestore'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { adminOtpSchema, validateInput } from '@/lib/sanitize'

const OTP_TTL_MS = 10 * 60 * 1000

/**
 * Check if an email belongs to a patient using targeted Firestore queries.
 * Checks patients collection first (O(1) index lookup), then falls back
 * to a single appointments query with limit(1) for legacy records.
 * Much cheaper than the previous full-table scan approach.
 */
async function isPatientEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim()
  try {
    // Check patients collection (indexed by email)
    const patientSnap = await db.collection('patients')
      .where('email', '==', normalized)
      .limit(1)
      .get()
    if (!patientSnap.empty) return true

    // Fallback: check appointments for legacy records
    const aptSnap = await db.collection('appointments')
      .where('patientEmail', '==', normalized)
      .limit(1)
      .get()
    if (!aptSnap.empty) return true
  } catch {}
  return false
}

export async function POST(request: Request) {
  const ip = getClientIp(request)

  // Rate limit: 5 OTPs per hour per IP
  const ipCheck = checkRateLimit(rateLimitKey('admin-otp-ip', ip), 5, 60 * 60 * 1000)
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
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  // Input validation
  const validation = validateInput(adminOtpSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email } = validation.data
  const normalizedEmail = email.toLowerCase().trim()

  // Rate limit: 5 OTPs per hour per email
  const emailCheck = checkRateLimit(rateLimitKey('admin-otp-email', normalizedEmail), 5, 60 * 60 * 1000)
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many OTP requests for this email. Please try again later.' },
      { status: 429 }
    )
  }

  // 1. Check if email belongs to a registered admin (point lookup — 1 read)
  const adminUser = await getAdminUserByEmail(normalizedEmail)

  if (!adminUser) {
    // 2. Check if it's a patient email — give a specific error
    if (await isPatientEmail(normalizedEmail)) {
      return NextResponse.json({
        error: 'This email is registered as a patient account and cannot be used to access the admin panel. Please use your designated admin email address.',
        isPatientEmail: true,
      }, { status: 403 })
    }
    return NextResponse.json({
      error: 'This email is not registered as an admin. Please contact your system administrator.',
    }, { status: 403 })
  }

  // 3. Generate OTP
  const code = String(crypto.randomInt(100000, 1000000))
  const expiresAt = Date.now() + OTP_TTL_MS

  await saveOtp(normalizedEmail, code, expiresAt, 'admin')

  // 4. Send email
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
    await transporter.sendMail({
      from: `"MediCare Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'MediCare Admin Login Code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #dc2626; border-radius: 10px; padding: 12px 18px;">
              <span style="color: white; font-size: 20px; font-weight: 700;">🏥 MediCare Admin</span>
            </div>
          </div>
          <h2 style="color: #111827; text-align: center; margin-bottom: 8px;">Admin Login Code</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Use this code to access the Admin Panel. It expires in <strong>10 minutes</strong>.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 2px solid #dc2626; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #dc2626; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #9ca3af; text-align: center; font-size: 13px;">If you did not request this, someone may be attempting to access the admin panel. Please secure your account immediately.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Admin email error:', err)
    return NextResponse.json({ error: 'Failed to send OTP email.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, adminName: adminUser.name })
}

