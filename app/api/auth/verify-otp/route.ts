import { NextResponse } from 'next/server'
import { getOtp, deleteOtp } from '@/lib/db'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  const { email, otp } = await request.json()

  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const entry = await getOtp(normalizedEmail, 'patient')

  if (!entry) {
    return NextResponse.json({ error: 'No OTP found for this email. Please request a new code.' }, { status: 400 })
  }

  if (Date.now() > entry.expiresAt) {
    // Clean up expired entry
    await deleteOtp(normalizedEmail, 'patient')
    return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 })
  }

  if (entry.code !== otp.trim()) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  // OTP is valid — remove it so it can't be reused
  await deleteOtp(normalizedEmail, 'patient')

  // Create (or get) a Firebase user for this email, then mint a custom token
  let uid: string
  try {
    const existing = await adminAuth.getUserByEmail(normalizedEmail)
    uid = existing.uid
  } catch {
    // User doesn't exist yet — create them
    const newUser = await adminAuth.createUser({ email: normalizedEmail })
    uid = newUser.uid
  }

  const customToken = await adminAuth.createCustomToken(uid)
  return NextResponse.json({ customToken, email: normalizedEmail })
}
