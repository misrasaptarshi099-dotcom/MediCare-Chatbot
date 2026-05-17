import { NextResponse } from 'next/server'
import { db } from '@/lib/firestore'
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split('Bearer ')[1]
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const uid = decodedToken.uid

    const { appointmentId, amount, method } = await request.json()

    if (!appointmentId) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    // In a real scenario, you would integrate Stripe or Razorpay here.
    // e.g. const charge = await stripe.charges.create({ amount: amount * 100, ... })
    // For now, we simulate a small delay to mimic a payment gateway processing time
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Verify appointment exists
    const docRef = db.collection('appointments').doc(appointmentId)
    const doc = await docRef.get()

    if (!doc.exists) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const aptData = doc.data()
    if (aptData?.patientUid !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update payment status
    await docRef.update({
      paymentStatus: 'paid',
      updatedAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true, message: 'Payment successful' })

  } catch (error: any) {
    console.error('Payment processing error:', error)
    return NextResponse.json({ error: error.message || 'Payment failed' }, { status: 500 })
  }
}
