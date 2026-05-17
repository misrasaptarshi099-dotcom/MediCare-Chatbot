import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    })
  })
}

const db = getFirestore()

async function checkAdminUsers() {
  const snap = await db.collection('adminUsers').get()
  console.log('Total admin users:', snap.size)
  snap.forEach(doc => {
    console.log(doc.id, '=>', doc.data())
  })
}

checkAdminUsers()
