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

async function checkDuplicates() {
  const snap = await db.collection('doctors').get()
  for (const doc of snap.docs) {
    const data = doc.data()
    const availability = data.availability || {}
    for (const day of Object.keys(availability)) {
      const slots = availability[day] || []
      const uniqueSlots = new Set(slots)
      if (slots.length !== uniqueSlots.size) {
        console.log(`Doctor ${data.name} (${doc.id}) has duplicates on ${day}: ${JSON.stringify(slots)}`)
      }
    }
  }
}

checkDuplicates().then(() => {
  console.log('Check complete')
  process.exit(0)
})
