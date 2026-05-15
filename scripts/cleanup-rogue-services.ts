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

async function deleteRogueServices() {
  const snap = await db.collection('services').where('name', '==', 'Blood Test').get()
  const batch = db.batch()
  let count = 0
  
  for (const doc of snap.docs) {
    if (doc.data().department === 'Radiology') {
      batch.delete(doc.ref)
      count++
      console.log(`Deleting rogue service: ${doc.id}`)
    }
  }
  
  if (count > 0) {
    await batch.commit()
    console.log(`Deleted ${count} rogue services.`)
  } else {
    console.log('No rogue services found.')
  }
}

deleteRogueServices().then(() => process.exit(0))
