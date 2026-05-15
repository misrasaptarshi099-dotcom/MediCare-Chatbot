import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { createOrUpdatePatient, getPatientByUid } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { idToken, name } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 })
    }

    // Verify the Google ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid
    const email = decodedToken.email

    if (!email) {
      return NextResponse.json({ error: 'Google account must have an email' }, { status: 400 })
    }

    // Check if the patient already exists in our database
    const existingPatient = await getPatientByUid(uid)

    if (!existingPatient) {
      // New user
      if (!name) {
        // We need a name for first-time login
        return NextResponse.json({ 
          error: 'Name is required for new users', 
          requiresName: true 
        }, { status: 400 })
      }

      // Create new patient record
      const patient = await createOrUpdatePatient({
        uid,
        name,
        email,
        authProviders: ['google'],
      })
      
      // Update Firebase Auth display name if we got one from the user
      await adminAuth.updateUser(uid, { displayName: name })

      return NextResponse.json({ uid, patient })
    }

    // Existing user: ensure 'google' is in their auth providers
    const updatedPatient = await createOrUpdatePatient({
      uid,
      authProviders: ['google'],
      email: existingPatient.email || email, // Set email if they didn't have one
    })

    return NextResponse.json({ uid, patient: updatedPatient })

  } catch (error: any) {
    console.error('Google callback error:', error)
    return NextResponse.json({ error: 'Failed to authenticate with Google' }, { status: 500 })
  }
}
