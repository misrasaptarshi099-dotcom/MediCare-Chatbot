import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const checkData = async () => {
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

  const db = admin.firestore()
  
  const reportsSnap = await db.collection('labReports').get()
  const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  
  const patientsSnap = await db.collection('patients').get()
  const patients = patientsSnap.docs.map(doc => doc.data())
  
  const appointmentsSnap = await db.collection('appointments').get()
  const appointments = appointmentsSnap.docs.map(doc => doc.data())
  
  console.log('--- LAB REPORTS ---')
  console.log(JSON.stringify(reports, null, 2))
  
  console.log('--- PATIENTS ---')
  console.log(JSON.stringify(patients, null, 2))
}

checkData().catch(console.error)
