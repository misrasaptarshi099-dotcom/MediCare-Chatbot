import { NextResponse } from 'next/server'
import { verifyOtp, deleteOtp, getAdminUserByEmail } from '@/lib/db'
import { cookies } from 'next/headers'
import { createAdminSession } from '@/lib/admin-auth'
import { verifyOtpSchema, validateInput } from '@/lib/sanitize'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = getClientIp(request)

  // Rate limit: 5 verify attempts per hour per IP
  const ipCheck = checkRateLimit(rateLimitKey('admin-verify-ip', ip), 5, 60 * 60 * 1000)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts. Please try again later.' },
      { status: 429 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }
  // Input validation
  const validation = validateInput(verifyOtpSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, code } = validation.data

  // Rate limit: 5 verify attempts per hour per email
  const emailCheck = checkRateLimit(rateLimitKey('admin-verify-email', email.toLowerCase().trim()), 5, 60 * 60 * 1000)
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many verification attempts for this email. Please try again later.' },
      { status: 429 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Verify OTP using SHA-256 hash comparison (never compare plaintext)
  const entry = await verifyOtp(normalizedEmail, code, 'admin')

  if (!entry) {
    return NextResponse.json({ error: 'Invalid or expired verification code. Please try again.' }, { status: 401 })
  }

  // Code is valid — clean it up
  await deleteOtp(normalizedEmail, 'admin')

  // Look up the admin user (point lookup — 1 read)
  const adminUser = await getAdminUserByEmail(normalizedEmail)

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin user not found.' }, { status: 404 })
  }

  // Create secure session token
  const sessionToken = await createAdminSession(adminUser.id)
  const cookieStore = await cookies()
  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return NextResponse.json({
    success: true,
    user: {
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
    },
  })
}

