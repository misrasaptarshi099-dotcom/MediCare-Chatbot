import { NextResponse } from 'next/server'
import { getOtp, deleteOtp, getAdminUserByEmail } from '@/lib/db'
import { cookies } from 'next/headers'
import { createAdminSession } from '@/lib/admin-auth'
import { verifyOtpSchema, validateInput } from '@/lib/sanitize'

export async function POST(request: Request) {
  const body = await request.json()

  // Input validation
  const validation = validateInput(verifyOtpSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, code } = validation.data

  const normalizedEmail = email.toLowerCase().trim()

  // Validate OTP
  const entry = await getOtp(normalizedEmail, 'admin')

  if (!entry || entry.code !== code) {
    return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 })
  }

  if (Date.now() > entry.expiresAt) {
    await deleteOtp(normalizedEmail, 'admin')
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 401 })
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

