import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getPatientByUid, getPatientIdentities, linkIdentity } from '@/lib/db'
import { db } from '@/lib/firestore'

export async function GET(request: Request) {
  try {
    // Verify user is logged in
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    // Fetch patient profile
    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch all linked identities
    let identities = await getPatientIdentities(uid)

    // ── Self-heal: reconcile authProviders with actual data ──────────────
    // If the patient has email/phone in their doc but authProviders or
    // identities are missing them (pre-migration data), fix it now.
    const needsUpdate: string[] = []
    const authProviders = Array.isArray(patient.authProviders) ? patient.authProviders : []

    if (patient.phone && !authProviders.includes('phone')) {
      needsUpdate.push('phone')
    }
    if (patient.email && !authProviders.includes('email')) {
      needsUpdate.push('email')
    }

    // Sync authProviders if needed
    if (needsUpdate.length > 0) {
      const updatedProviders = [...new Set([...authProviders, ...needsUpdate])]
      await db.collection('patients').doc(uid).update({
        authProviders: updatedProviders,
        updatedAt: new Date().toISOString(),
      })
      patient.authProviders = updatedProviders as typeof patient.authProviders
    }

    let createdPhoneIdentity = false
    let createdEmailIdentity = false

    // Sync missing identity docs
    if (patient.phone) {
      const hasPhoneIdentity = identities.some(i => i.provider === 'phone')
      if (!hasPhoneIdentity) {
        await linkIdentity('phone', patient.phone, uid)
        createdPhoneIdentity = true
      }
    }
    if (patient.email) {
      const hasEmailIdentity = identities.some(i => i.provider === 'email')
      if (!hasEmailIdentity) {
        await linkIdentity('email', patient.email.toLowerCase(), uid)
        createdEmailIdentity = true
      }
    }

    // Re-fetch identities after sync
    if (needsUpdate.length > 0 || identities.length === 0 || createdPhoneIdentity || createdEmailIdentity) {
      identities = await getPatientIdentities(uid)
    }

    return NextResponse.json({ patient, identities })
  } catch (error: any) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}
