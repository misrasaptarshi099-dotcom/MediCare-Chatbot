import admin from 'firebase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  } else {
    console.error('Missing Firebase credentials.')
    process.exit(1)
  }
}

const db = admin.firestore()

async function migrateChatSessions() {
  console.log('Starting chat sessions migration...')
  
  // 1. Get all patients
  const patientsSnapshot = await db.collection('patients').get()
  const emailToUidMap = new Map<string, string>()
  
  patientsSnapshot.forEach(doc => {
    const data = doc.data()
    if (data.email) {
      emailToUidMap.set(data.email.toLowerCase().trim(), data.uid)
    }
  })
  
  console.log(`Found ${emailToUidMap.size} patients with email addresses.`)

  // 2. Get all chat sessions
  const chatSessionsSnapshot = await db.collection('chat_sessions').get()
  let migratedCount = 0
  let skippedCount = 0

  for (const doc of chatSessionsSnapshot.docs) {
    const emailKey = doc.id
    
    // Check if the id is actually an email (contains @)
    if (!emailKey.includes('@')) {
      // It's likely already a UID or something else, skip it.
      skippedCount++
      continue
    }

    const uid = emailToUidMap.get(emailKey.toLowerCase().trim())
    
    if (uid) {
      const chatData = doc.data()
      // Copy to new document keyed by uid
      await db.collection('chat_sessions').doc(uid).set(chatData)
      console.log(`Migrated chat session from ${emailKey} to ${uid}`)
      
      // Optional: Delete the old document. We'll leave it as backup for now.
      // await db.collection('chat_sessions').doc(emailKey).delete()
      migratedCount++
    } else {
      console.log(`No patient found for chat session: ${emailKey}`)
      skippedCount++
    }
  }

  console.log('Migration complete.')
  console.log(`Migrated: ${migratedCount}`)
  console.log(`Skipped: ${skippedCount}`)
}

migrateChatSessions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
