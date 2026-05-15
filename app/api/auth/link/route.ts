import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { linkAuthProvider } from '@/lib/db'

export async function POST(request: Request) {
  try {
    // 1. Verify user is logged in
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    // 2. Parse request body
    const { action, value } = await request.json()

    if (!action || !value) {
      return NextResponse.json({ error: 'Action and value are required' }, { status: 400 })
    }

    // 3. Process linking
    if (action === 'link_phone') {
      let normalizedPhone = value.trim()
      
      // Ensure phone numbers have a country code (default to +91 for India if missing)
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.length === 10) {
          normalizedPhone = '+91' + normalizedPhone
        } else {
          normalizedPhone = '+' + normalizedPhone
        }
      }
      
      // Update Firebase Auth user
      await adminAuth.updateUser(uid, { phoneNumber: normalizedPhone })
      
      // Update Patient doc in Firestore
      const patient = await linkAuthProvider(uid, 'phone', normalizedPhone)
      
      return NextResponse.json({ success: true, patient })

    } else if (action === 'link_email') {
      const normalizedEmail = value.toLowerCase().trim()
      
      // Update Firebase Auth user
      await adminAuth.updateUser(uid, { email: normalizedEmail })
      
      // Update Patient doc in Firestore
      const patient = await linkAuthProvider(uid, 'email', normalizedEmail)
      
      return NextResponse.json({ success: true, patient })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Account linking error:', error)
    
    // Handle Firebase specific errors (e.g., email already in use)
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'This email is already linked to another account' }, { status: 400 })
    }
    if (error.code === 'auth/phone-number-already-exists') {
      return NextResponse.json({ error: 'This phone number is already linked to another account' }, { status: 400 })
    }
    if (error.code === 'auth/invalid-phone-number') {
      return NextResponse.json({ error: 'Invalid phone number format. Use E.164 format (e.g., +1234567890)' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to link account' }, { status: 500 })
  }
}
