import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const migrateData = async () => {
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
  
  const patientsSnap = await db.collection('patients').get()
  const patients = patientsSnap.docs.map(doc => doc.data())
  
  const reportsSnap = await db.collection('labReports').get()
  
  let updatedCount = 0
  const batch = db.batch()
  
  for (const doc of reportsSnap.docs) {
    const report = doc.data()
    if (!report.patientUid) {
      // Find patient by phone or email
      const patient = patients.find(p => 
        (p.phone && report.patientPhone && p.phone === report.patientPhone) || 
        (p.email && report.patientEmail && p.email.toLowerCase() === report.patientEmail.toLowerCase())
      )
      if (patient) {
        batch.update(doc.ref, { patientUid: patient.uid })
        updatedCount++
      }
    }
  }
  
  if (updatedCount > 0) {
    await batch.commit()
    console.log(`Updated ${updatedCount} reports with patientUid.`)
  } else {
    console.log('No reports needed updating.')
  }
}

migrateData().catch(console.error)
