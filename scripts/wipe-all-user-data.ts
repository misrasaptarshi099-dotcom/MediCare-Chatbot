import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const wipeData = async () => {
  // Dynamically import firebase-admin as an ES module
  const adminMod = await import('firebase-admin')
  const admin = adminMod.default || adminMod

  // Initialize Firebase Admin if not already done
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
    })
  }

  const db = admin.firestore()
  const auth = admin.auth()
  const storage = admin.storage().bucket()

  console.log('🚨 STARTING COMPLETE WIPE OF ALL USER DATA 🚨\n')

  // 1. Wipe Firestore Collections
  const collectionsToWipe = [
    'patients',
    'chatSessions',
    'appointments',
    'otps',
    'labReports',
    'waitlist',
    'unansweredQueries',
    'callbackTickets',
    'sentReminders'
  ]

  for (const collectionName of collectionsToWipe) {
    console.log(`🗑️ Deleting all documents in collection: ${collectionName}...`)
    const colRef = db.collection(collectionName)
    const snapshot = await colRef.get()
    
    if (snapshot.empty) {
      console.log(`   └─ Already empty.`)
      continue
    }

    const batch = db.batch()
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref)
    })
    
    await batch.commit()
    console.log(`   └─ Deleted ${snapshot.size} documents.`)
  }

  console.log('\n🗑️ Wiping Firebase Auth users...')
  let pageToken: string | undefined
  let userCount = 0
  
  do {
    const listUsersResult: any = await auth.listUsers(1000, pageToken)
    const users = listUsersResult.users
    
    if (users.length > 0) {
      const uids = users.map((user: any) => user.uid)
      await auth.deleteUsers(uids)
      userCount += users.length
    }
    
    pageToken = listUsersResult.pageToken
  } while (pageToken)
  
  console.log(`   └─ Deleted ${userCount} users from Firebase Auth.`)

  console.log('\n🗑️ Wiping Firebase Storage...')
  try {
    const [files] = await storage.getFiles()
    if (files.length === 0) {
      console.log(`   └─ Storage is already empty.`)
    } else {
      for (const file of files) {
        await file.delete()
      }
      console.log(`   └─ Deleted ${files.length} files from Storage.`)
    }
  } catch (error: any) {
    console.error(`   └─ Failed to access or delete from storage:`, error.message)
  }

  console.log('\n✅ WIPE COMPLETE.')
}

wipeData().catch(console.error)
