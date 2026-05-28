import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { getPatientByUid, linkIdentity, unlinkIdentity, linkAuthProvider, getPatientIdentities } from '@/lib/db'
import { db } from '@/lib/firestore'
import { adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: Request) {
  const adminUser = await requireAdminSession()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { uid, action, provider, value } = await request.json()

    if (!uid || !action || !provider) {
      return NextResponse.json({ error: 'uid, action, and provider are required' }, { status: 400 })
    }

    if (!['link', 'unlink'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "link" or "unlink"' }, { status: 400 })
    }

    if (!['email', 'phone', 'google'].includes(provider)) {
      return NextResponse.json({ error: 'Provider must be email, phone, or google' }, { status: 400 })
    }

    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    if (action === 'link') {
      if (!value) {
        return NextResponse.json({ error: 'Value is required for linking' }, { status: 400 })
      }

      const normalizedValue = provider === 'email' ? value.toLowerCase().trim() : value.trim()

      // Update Firebase Auth
      try {
        if (provider === 'email') {
          await adminAuth.updateUser(uid, { email: normalizedValue })
        } else if (provider === 'phone') {
          let phone = normalizedValue
          if (!phone.startsWith('+')) {
            phone = phone.length === 10 ? '+91' + phone : '+' + phone
          }
          await adminAuth.updateUser(uid, { phoneNumber: phone })
        }
      } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to update auth' }, { status: 400 })
      }

      // Update patient doc + identity
      await linkAuthProvider(uid, provider as 'email' | 'phone' | 'google', normalizedValue)
      await linkIdentity(provider, normalizedValue, uid)

      return NextResponse.json({ success: true, message: `${provider} linked successfully` })

    } else if (action === 'unlink') {
      // Safety: check at least 1 method remains
      const identities = await getPatientIdentities(uid)
      if (identities.length <= 1) {
        return NextResponse.json({ 
          error: 'Cannot unlink the last login method' 
        }, { status: 400 })
      }

      const identityToRemove = identities.find(i => i.provider === provider)
      if (!identityToRemove) {
        return NextResponse.json({ error: `No ${provider} identity found` }, { status: 404 })
      }

      // Delete identity doc
      await unlinkIdentity(provider, identityToRemove.value)

      // Remove from patient doc
      const updates: Record<string, any> = {
        authProviders: FieldValue.arrayRemove(provider),
        updatedAt: new Date().toISOString(),
      }
      if (provider === 'email') updates.email = FieldValue.delete()
      if (provider === 'phone') updates.phone = FieldValue.delete()

      await db.collection('patients').doc(uid).update(updates)

      // Update Firebase Auth
      try {
        if (provider === 'phone') {
          await adminAuth.updateUser(uid, { phoneNumber: null })
        }
      } catch (e) {
        console.error('Failed to update Firebase Auth:', e)
      }

      return NextResponse.json({ success: true, message: `${provider} unlinked successfully` })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Admin identity management error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
