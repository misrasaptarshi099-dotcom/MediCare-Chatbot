async function testLoginFlow() {
  console.log('Sending OTP request...')
  let res = await fetch('http://localhost:3000/api/admin/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hospital.com' })
  });
  let data = await res.json();
  console.log('send-otp res:', data);

  // We need the OTP code. We can fetch it directly from Firestore via firebase-admin.
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
  
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      })
    });
  }
  const db = getFirestore();
  const otpDoc = await db.collection('otps').doc('admin_admin@hospital.com').get();
  const code = otpDoc.data()?.code;
  console.log('Got OTP from db:', code);

  console.log('Verifying OTP...')
  res = await fetch('http://localhost:3000/api/admin/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hospital.com', code })
  });
  const verifyData = await res.json();
  console.log('verify-otp res:', verifyData);

  const cookies = res.headers.get('set-cookie');
  console.log('Set-Cookie header:', cookies);

  if (cookies) {
    const sessionCookie = cookies.split(';')[0];
    console.log('Extracted session cookie:', sessionCookie);
    
    console.log('Checking Auth endpoint...')
    const authRes = await fetch('http://localhost:3000/api/auth', {
      headers: { 'Cookie': sessionCookie }
    });
    const authData = await authRes.json();
    console.log('Auth GET res:', authData);
  }
}

testLoginFlow();
