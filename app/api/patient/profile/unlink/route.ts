import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getPatientByUid, getPatientIdentities, unlinkIdentity } from '@/lib/db'
import { db } from '@/lib/firestore'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: Request) {
  try {
    // Verify user is logged in
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    const { provider } = await request.json()

    if (!provider || !['email', 'phone', 'google'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider is required (email, phone, or google)' }, { status: 400 })
    }

    // Fetch patient
    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Check that this isn't the last login method
    const identities = await getPatientIdentities(uid)
    if (identities.length <= 1) {
      return NextResponse.json({ 
        error: 'Cannot unlink the last login method. You must have at least one way to sign in.' 
      }, { status: 400 })
    }

    // Find the identity to unlink
    const identityToRemove = identities.find(i => i.provider === provider)
    if (!identityToRemove) {
      return NextResponse.json({ error: `No ${provider} identity linked to this account` }, { status: 404 })
    }

    // 1. Delete the identity document and update patient doc in a single transaction
    const identityDocId = `${provider}_${identityToRemove.value}`
    const identityDocRef = db.collection('identities').doc(identityDocId)
    const patientDocRef = db.collection('patients').doc(uid)

    await db.runTransaction(async (transaction) => {
      // Delete the identity doc
      transaction.delete(identityDocRef)

      // Remove provider from patient authProviders and clear contact field
      const updates: Record<string, any> = {
        authProviders: FieldValue.arrayRemove(provider),
        updatedAt: new Date().toISOString(),
      }

      if (provider === 'email') {
        updates.email = FieldValue.delete()
      } else if (provider === 'phone') {
        updates.phone = FieldValue.delete()
      }

      transaction.update(patientDocRef, updates)
    })

    // 3. Update Firebase Auth user (remove email/phone if applicable)
    try {
      if (provider === 'email') {
        // Can't remove email from Firebase Auth directly, but we can leave it
        // The identity doc is deleted, so lookups won't find this user by email anymore
      } else if (provider === 'phone') {
        await adminAuth.updateUser(uid, { phoneNumber: null })
      }
    } catch (e) {
      console.error('Failed to update Firebase Auth:', e)
    }

    // Fetch updated patient
    const updatedPatient = await getPatientByUid(uid)
    const updatedIdentities = await getPatientIdentities(uid)

    return NextResponse.json({ 
      success: true, 
      patient: updatedPatient, 
      identities: updatedIdentities 
    })

  } catch (error: any) {
    console.error('Unlink error:', error)
    return NextResponse.json({ error: 'Failed to unlink account' }, { status: 500 })
  }
}
