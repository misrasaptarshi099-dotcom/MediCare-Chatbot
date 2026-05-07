/**
 * One-time migration script: reads all existing JSON files and uploads to Firestore.
 *
 * Usage:
 *   npx tsx scripts/seed-firestore.ts
 *
 * Prerequisites:
 *   - Firebase Admin env vars must be set (NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 *   - Or: run with dotenv: npx dotenv -e .env.local -- npx tsx scripts/seed-firestore.ts
 */

import * as admin from 'firebase-admin'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

// ── Init Firebase Admin ──────────────────────────────────────────────────────
// Load env from .env.local
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv')
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

if (!admin.apps.length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

const db = admin.firestore()
const DB_PATH = path.join(process.cwd(), 'database')
const LOGS_PATH = path.join(process.cwd(), 'logs')

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    console.log(`  ⏭️  Skipped (not found): ${filePath}`)
    return null
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

async function seedCollection(collectionName: string, docs: Array<{ id: string; [key: string]: any }>) {
  const batch = db.batch()
  for (const doc of docs) {
    batch.set(db.collection(collectionName).doc(doc.id), doc)
  }
  await batch.commit()
  console.log(`  ✅ ${collectionName}: ${docs.length} documents`)
}

async function main() {
  console.log('🚀 Starting Firestore seed...\n')

  // 1. Doctors
  const doctorsData = readJson<{ doctors: any[] }>(path.join(DB_PATH, 'doctors.json'))
  if (doctorsData?.doctors) {
    await seedCollection('doctors', doctorsData.doctors)
  }

  // 2. Appointments
  const aptsData = readJson<{ appointments: any[] }>(path.join(DB_PATH, 'appointments.json'))
  if (aptsData?.appointments) {
    await seedCollection('appointments', aptsData.appointments)
  }

  // 3. Departments + Visiting Hours
  const deptsData = readJson<{ departments: any[]; visitingHours: any }>(path.join(DB_PATH, 'departments.json'))
  if (deptsData?.departments) {
    await seedCollection('departments', deptsData.departments)
    if (deptsData.visitingHours) {
      await db.collection('config').doc('visitingHours').set(deptsData.visitingHours)
      console.log('  ✅ config/visitingHours: 1 document')
    }
  }

  // 4. Services
  const servicesData = readJson<{ services: any[] }>(path.join(DB_PATH, 'services.json'))
  if (servicesData?.services) {
    await seedCollection('services', servicesData.services)
  }

  // 5. Insurance
  const insData = readJson<{ insurancePartners: any[] }>(path.join(DB_PATH, 'insurance.json'))
  if (insData?.insurancePartners) {
    await seedCollection('insurancePartners', insData.insurancePartners)
  }

  // 6. Admin Users
  const usersData = readJson<{ users: any[] }>(path.join(DB_PATH, 'users.json'))
  if (usersData?.users) {
    await seedCollection('adminUsers', usersData.users)
  }

  // 7. Chat Sessions
  const chatsData = readJson<{ sessions: any[] }>(path.join(DB_PATH, 'chats.json'))
  if (chatsData?.sessions) {
    const batch = db.batch()
    for (const session of chatsData.sessions) {
      const docId = session.email.toLowerCase()
      batch.set(db.collection('chatSessions').doc(docId), session)
    }
    await batch.commit()
    console.log(`  ✅ chatSessions: ${chatsData.sessions.length} documents`)
  }

  // 8. Waitlist
  const waitlistData = readJson<{ waitlist: any[] }>(path.join(DB_PATH, 'waitlist.json'))
  if (waitlistData?.waitlist && waitlistData.waitlist.length > 0) {
    await seedCollection('waitlist', waitlistData.waitlist)
  } else {
    console.log('  ⏭️  waitlist: empty or not found')
  }

  // 9. OTPs (usually transient, but seed if present)
  const otpsData = readJson<any[]>(path.join(DB_PATH, 'otps.json'))
  if (otpsData && Array.isArray(otpsData) && otpsData.length > 0) {
    const batch = db.batch()
    for (const otp of otpsData) {
      const purpose = otp.purpose || 'patient'
      const docId = `${otp.email.toLowerCase()}_${purpose}`
      batch.set(db.collection('otps').doc(docId), otp)
    }
    await batch.commit()
    console.log(`  ✅ otps: ${otpsData.length} documents`)
  } else {
    console.log('  ⏭️  otps: empty or not found')
  }

  // 10. Sent Reminders
  const remindersData = readJson<{ sentReminders: any[] }>(path.join(DB_PATH, 'sent_reminders.json'))
  if (remindersData?.sentReminders && remindersData.sentReminders.length > 0) {
    const batch = db.batch()
    for (const r of remindersData.sentReminders) {
      batch.set(db.collection('sentReminders').doc(r.appointmentId), r)
    }
    await batch.commit()
    console.log(`  ✅ sentReminders: ${remindersData.sentReminders.length} documents`)
  } else {
    console.log('  ⏭️  sentReminders: empty or not found')
  }

  // 11. Unanswered Queries (logs)
  const queriesData = readJson<{ queries: any[] }>(path.join(LOGS_PATH, 'unanswered_queries.json'))
  if (queriesData?.queries && queriesData.queries.length > 0) {
    await seedCollection('unansweredQueries', queriesData.queries)
  } else {
    console.log('  ⏭️  unansweredQueries: empty or not found')
  }

  // 12. Callback Tickets (logs)
  const ticketsData = readJson<{ tickets: any[] }>(path.join(LOGS_PATH, 'callback_tickets.json'))
  if (ticketsData?.tickets && ticketsData.tickets.length > 0) {
    await seedCollection('callbackTickets', ticketsData.tickets)
  } else {
    console.log('  ⏭️  callbackTickets: empty or not found')
  }

  console.log('\n🎉 Firestore seed complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
