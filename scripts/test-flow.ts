import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testFlow() {
  console.log('Sending OTP...')
  const sendRes = await fetch('http://localhost:3000/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '7044321588' })
  })
  
  if (!sendRes.ok) {
    const text = await sendRes.text()
    console.error('Send failed:', sendRes.status, text)
    return
  }
  
  console.log('Send Success:', await sendRes.json())
  
  const adminMod = await import('firebase-admin')
  const admin = adminMod.default || adminMod
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    })
  }
  
  const doc = await admin.firestore().collection('otps').doc('+917044321588_patient').get()
  if (!doc.exists) {
    console.error('OTP not found in DB')
    return
  }
  const otp = doc.data()!.code
  console.log('Got OTP from DB:', otp)
  
  console.log('Verifying OTP...')
  const verifyRes = await fetch('http://localhost:3000/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '7044321588', otp, name: 'Test User' })
  })
  
  if (!verifyRes.ok) {
    const text = await verifyRes.text()
    console.error('Verify failed:', verifyRes.status, text)
    return
  }
  
  const data = await verifyRes.json()
  console.log('Verify Success:', data.uid)
}

testFlow()
