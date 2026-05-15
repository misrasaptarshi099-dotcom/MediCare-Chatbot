import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    })
  })
}

const db = getFirestore()

async function dumpServices() {
  const snap = await db.collection('services').get()
  const services = snap.docs.map(d => d.data())
  console.log(JSON.stringify(services.map(s => ({ name: s.name, department: s.department })), null, 2))
}

dumpServices().then(() => process.exit(0))
