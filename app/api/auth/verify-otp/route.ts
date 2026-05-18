import { NextResponse } from 'next/server'
import { getOtp, deleteOtp, createOrUpdatePatient, getPatientByIdentifier } from '@/lib/db'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  try {
    const { identifier, otp, name, isLinking } = await request.json()

    if (!identifier || !otp) {
      return NextResponse.json({ error: 'Identifier and OTP are required' }, { status: 400 })
    }

    let normalizedIdentifier = identifier.trim()
    const isPhone = /^\+?[0-9]{10,15}$/.test(normalizedIdentifier)

    // Ensure phone numbers have a country code (default to +91 for India if missing)
    if (isPhone && !normalizedIdentifier.startsWith('+')) {
      // If it's 10 digits without country code, assume India (+91)
      if (normalizedIdentifier.length === 10) {
        normalizedIdentifier = '+91' + normalizedIdentifier
      } else {
        // Fallback for generic numbers without + 
        normalizedIdentifier = '+' + normalizedIdentifier
      }
    }

    const entry = await getOtp(normalizedIdentifier, 'patient')

    if (!entry) {
      return NextResponse.json({ error: 'No OTP found for this identifier. Please request a new code.' }, { status: 400 })
    }

    if (Date.now() > entry.expiresAt) {
      // Clean up expired entry
      await deleteOtp(normalizedIdentifier, 'patient')
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 })
    }

    if (entry.code !== otp.trim()) {
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
    }

    // Check if user exists first so we don't delete the OTP if they just need to provide a name
    let uid: string = ''
    let userExists = false
    try {
      if (isPhone) {
        const existing = await adminAuth.getUserByPhoneNumber(normalizedIdentifier)
        uid = existing.uid
        userExists = true
      } else {
        const existing = await adminAuth.getUserByEmail(normalizedIdentifier)
        uid = existing.uid
        userExists = true
      }
    } catch {
      userExists = false
    }

    // ── Bridge WhatsApp auto-registered patients ──────────────────────────
    // If Firebase Auth doesn't know this user, check if they were already
    // auto-registered via WhatsApp (Firestore patient record exists).
    let existingPatientName: string | undefined
    if (!userExists && isPhone) {
      const existing = await getPatientByIdentifier(normalizedIdentifier)
      if (existing) {
        existingPatientName = existing.name || 'WhatsApp User'
      }
    }

    if (!userExists && !isLinking && !name && !existingPatientName) {
      // First time login requires a name! We should tell the client to ask for a name.
      // We DO NOT delete the OTP yet, because they need to submit it again with their name.
      return NextResponse.json({ 
        error: 'Name is required for new users', 
        requiresName: true 
      }, { status: 400 })
    }

    // OTP is valid and we are proceeding — remove it so it can't be reused
    await deleteOtp(normalizedIdentifier, 'patient')

    if (isLinking) {
      // If we are just verifying for an account link, we don't need to create a user or patient document here.
      // The /api/auth/link route will handle that.
      return NextResponse.json({ success: true })
    }

    // Determine the display name: explicit input > existing Firestore record > fallback
    const displayName = name || existingPatientName || 'Patient'

    if (!userExists) {
      const newUserParams: any = { displayName }
      if (isPhone) newUserParams.phoneNumber = normalizedIdentifier
      else newUserParams.email = normalizedIdentifier

      try {
        const newUser = await adminAuth.createUser(newUserParams)
        uid = newUser.uid
      } catch (createErr: any) {
        console.error('Failed to create user:', createErr)
        return NextResponse.json({ error: createErr.message || 'Failed to create user' }, { status: 400 })
      }
    }

    // Upsert the Patient record in Firestore
    const patientData: any = { uid, authProviders: [isPhone ? 'phone' : 'email'] }
    if (displayName) patientData.name = displayName
    if (isPhone) patientData.phone = normalizedIdentifier
    else patientData.email = normalizedIdentifier

    const patient = await createOrUpdatePatient(patientData)

    const customToken = await adminAuth.createCustomToken(uid)
    return NextResponse.json({ customToken, uid, patient })
  } catch (error: any) {
    console.error('Verify OTP Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
