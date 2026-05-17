import { NextResponse } from 'next/server'
import { getOtp, deleteOtp, getAdminUsers, type User } from '@/lib/db'
import { cookies } from 'next/headers'
import { createAdminSession } from '@/lib/admin-auth'

export async function POST(request: Request) {
  const { email, code } = await request.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Validate OTP
  const entry = await getOtp(normalizedEmail, 'admin')

  if (!entry || entry.code !== String(code)) {
    return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 })
  }

  if (Date.now() > entry.expiresAt) {
    await deleteOtp(normalizedEmail, 'admin')
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 401 })
  }

  // Code is valid — clean it up
  await deleteOtp(normalizedEmail, 'admin')

  // Look up the admin user
  const users = await getAdminUsers()
  const adminUser = users.find(u => u.email?.toLowerCase().trim() === normalizedEmail)

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
