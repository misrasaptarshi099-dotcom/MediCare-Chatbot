import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { createOrUpdatePatient, getPatientByUid, resolveIdentity, linkIdentity } from '@/lib/db'

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

    // Check if the patient already exists in our database under this Google UID
    const existingPatient = await getPatientByUid(uid)

    if (!existingPatient) {
      // ── Bridge: check if a patient with this email already exists ──────
      // (e.g., registered via WhatsApp and linked their email)
      const existingUid = await resolveIdentity('email', email.toLowerCase())
      if (existingUid) {
        const existingByEmail = await getPatientByUid(existingUid)
        if (existingByEmail) {
          // Delete the auto-created Google Auth user
          try {
            await adminAuth.deleteUser(uid)
          } catch (e) {
            console.error('Failed to delete auto-created Google Auth user (uid:', uid, ', existingUid:', existingUid, '):', e)
            throw e
          }

          // Add Google as a linked identity + update patient
          await linkIdentity('google', uid, existingUid)
          await createOrUpdatePatient({
            uid: existingUid,
            authProviders: ['google'],
            email: existingByEmail.email || email,
          })

          // Issue custom token for the ORIGINAL uid
          const customToken = await adminAuth.createCustomToken(existingUid)
          return NextResponse.json({
            uid: existingUid,
            patient: { ...existingByEmail, authProviders: [...new Set([...existingByEmail.authProviders, 'google'])] },
            customToken,
          })
        }
      }

      // Truly new user — no existing patient anywhere
      if (!name) {
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
      
      // Write identity docs for the new user
      await linkIdentity('email', email.toLowerCase(), uid)
      await linkIdentity('google', uid, uid)
      
      // Update Firebase Auth display name
      await adminAuth.updateUser(uid, { displayName: name })

      return NextResponse.json({ uid, patient })
    }

    // Existing user: ensure 'google' is in their auth providers
    const updatedPatient = await createOrUpdatePatient({
      uid,
      authProviders: ['google'],
      email: existingPatient.email || email,
    })

    // Ensure identity docs exist
    await linkIdentity('google', uid, uid)
    if (!existingPatient.email) {
      await linkIdentity('email', email.toLowerCase(), uid)
    }

    return NextResponse.json({ uid, patient: updatedPatient })

  } catch (error: any) {
    console.error('Google callback error:', error)
    return NextResponse.json({ error: 'Failed to authenticate with Google' }, { status: 500 })
  }
}
