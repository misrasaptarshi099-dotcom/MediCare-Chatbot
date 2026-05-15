import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getPatientByUid } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    
    const patient = await getPatientByUid(decodedToken.uid)
    
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ patient })
  } catch (error: any) {
    console.error('Auth check error:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
