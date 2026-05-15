import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const deleteLinkingPatient = async () => {
  const adminMod = await import('firebase-admin')
  const admin = adminMod.default || adminMod

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      })
    })
  }

  const db = admin.firestore()
  const snapshot = await db.collection('patients').where('name', '==', 'Linking').get()

  if (snapshot.empty) {
    console.log('No patient named "Linking" found.')
    return
  }

  const batch = db.batch()
  snapshot.forEach(doc => {
    batch.delete(doc.ref)
    console.log('Deleted patient document:', doc.id)
  })

  await batch.commit()
  console.log('Successfully removed the orphaned Linking patient.')
}

deleteLinkingPatient()
