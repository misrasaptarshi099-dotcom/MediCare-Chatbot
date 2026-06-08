import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import {
  getPatientsPaginated,
  getAllAppointments,
  getAllChatSessions,
  getCallbackTickets,
  createOrUpdatePatient,
  linkIdentity,
  deleteAllIdentities
} from '@/lib/db'
import { db } from '@/lib/firestore'
import { adminAuth } from '@/lib/firebase-admin'

export async function GET(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limitStr = searchParams.get('limit')
  const parsedLimit = limitStr ? parseInt(limitStr, 10) : 100
  if (limitStr && (isNaN(parsedLimit) || parsedLimit <= 0)) {
    return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
  }
  const limit = Math.min(Math.max(parsedLimit, 1), 100)

  try {
    const patients = await getPatientsPaginated(limit, cursor || undefined)
    const patientMap: Record<string, any> = {}

    for (const p of patients) {
      // Self-heal: reconcile authProviders with actual data fields
      const providers = [...(p.authProviders || [])]
      if (p.phone && !providers.includes('phone')) providers.push('phone')
      if (p.email && !providers.includes('email')) providers.push('email')

      patientMap[p.uid] = {
        uid: p.uid,
        email: p.email || '',
        phone: p.phone || '',
        name: p.name || 'Unknown',
        authProviders: providers,
        appointmentCount: 0,
        callbackCount: 0,
        chatCount: 0,
        createdAt: (p as any).createdAt || null
      }
    }

    const uids = patients.map(p => p.uid).filter(Boolean)
    const emails = patients.map(p => p.email?.toLowerCase().trim()).filter(Boolean)
    const uniqueEmails = Array.from(new Set(emails))

    const chunkArray = (arr: string[], size: number) => {
      const chunks = []
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
      return chunks
    }

    const uidChunks = chunkArray(uids, 30)
    const emailChunks = chunkArray(uniqueEmails, 30)

    // From appointments (use batched IN queries)
    try {
      const promises: Promise<FirebaseFirestore.QuerySnapshot>[] = []
      for (const chunk of uidChunks) {
        promises.push(db.collection('appointments').where('patientUid', 'in', chunk).select('patientUid', 'patientEmail').get())
      }
      for (const chunk of emailChunks) {
        promises.push(db.collection('appointments').where('patientEmail', 'in', chunk).select('patientUid', 'patientEmail').get())
      }
      const snaps = await Promise.all(promises)
      const seenApts = new Set<string>()
      
      snaps.forEach(snap => {
        snap.forEach(doc => {
          if (seenApts.has(doc.id)) return
          seenApts.add(doc.id)
          const apt = doc.data()
          const uid = apt.patientUid
          if (uid && patientMap[uid]) {
            patientMap[uid].appointmentCount++
          } else if (apt.patientEmail) {
            const e = apt.patientEmail.toLowerCase().trim()
            const p = Object.values(patientMap).find(pat => pat.email?.toLowerCase().trim() === e)
            if (p) p.appointmentCount++
          }
        })
      })
    } catch (err) { console.error('Failed to count appointments:', err) }

    // From callback tickets (use batched IN queries)
    try {
      const promises: Promise<FirebaseFirestore.QuerySnapshot>[] = []
      for (const chunk of uidChunks) {
        promises.push(db.collection('callbackTickets').where('patientUid', 'in', chunk).select('patientUid', 'patientEmail').get())
      }
      for (const chunk of emailChunks) {
        promises.push(db.collection('callbackTickets').where('patientEmail', 'in', chunk).select('patientUid', 'patientEmail').get())
      }
      const snaps = await Promise.all(promises)
      const seenCbs = new Set<string>()
      
      snaps.forEach(snap => {
        snap.forEach(doc => {
          if (seenCbs.has(doc.id)) return
          seenCbs.add(doc.id)
          const cb = doc.data()
          const uid = cb.patientUid
          if (uid && patientMap[uid]) {
            patientMap[uid].callbackCount++
          } else if (cb.patientEmail) {
             const e = cb.patientEmail.toLowerCase().trim()
             const p = Object.values(patientMap).find(pat => pat.email?.toLowerCase().trim() === e)
             if (p) p.callbackCount++
          }
        })
      })
    } catch (err) { console.error('Failed to count callback tickets:', err) }

    // From chat sessions (use batched IN queries)
    try {
      const promises: Promise<FirebaseFirestore.QuerySnapshot>[] = []
      for (const chunk of uidChunks) {
        promises.push(db.collection('chatSessions').where('uid', 'in', chunk).select('uid', 'messageCount').get())
      }
      const snaps = await Promise.all(promises)
      const seenChats = new Set<string>()
      
      snaps.forEach(snap => {
        snap.forEach(doc => {
          if (seenChats.has(doc.id)) return
          seenChats.add(doc.id)
          const data = doc.data()
          const uid = data.uid || doc.id
          if (uid && patientMap[uid]) {
            patientMap[uid].chatCount = data.messageCount ?? 0
          }
        })
      })
    } catch (err) { console.error('Failed to count chat sessions:', err) }

    const patientsList = Object.values(patientMap)
    
    // Only return a next cursor if we hit the limit (meaning there MIGHT be more data)
    const nextCursor = patients.length === limit && patientsList.length > 0 
      ? `${patients[patients.length - 1].createdAt}|${patients[patients.length - 1].uid}` 
      : null
    
    return NextResponse.json({ patients: patientsList, nextCursor })
  } catch (err) {
    console.error('Error fetching patients:', err)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

// DELETE — remove a patient's appointments, waitlist, chats, and/or callback tickets
export async function DELETE(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uid, deleteAppointments, deleteChats, deleteCallbacks } = await request.json()

  if (!uid) {
    return NextResponse.json({ error: 'Patient UID is required' }, { status: 400 })
  }

  const results: string[] = []

  // Delete appointments
  if (deleteAppointments) {
    try {
      const appointments = await getAllAppointments()
      const toDelete = appointments.filter(a => a.patientUid === uid)
      if (toDelete.length > 0) {
        const batch = db.batch()
        toDelete.forEach(a => batch.delete(db.collection('appointments').doc(a.id)))
        await batch.commit()
        results.push(`Removed ${toDelete.length} appointment(s)`)
      }
    } catch (err) {
      console.error('Failed to delete appointments:', err)
      results.push('Failed to remove appointments')
    }
  }

  // Delete chats
  if (deleteChats) {
    try {
      const chatRef = db.collection('chatSessions').doc(uid)
      const doc = await chatRef.get()
      if (doc.exists) {
        await chatRef.delete()
        results.push('Removed chat history')
      }
    } catch (err) {
      console.error('Failed to delete chats:', err)
      results.push('Failed to remove chat history')
    }
  }

  // Delete callbacks
  if (deleteCallbacks) {
    try {
      const tickets = await getCallbackTickets()
      const toDelete = tickets.filter(t => t.patientUid === uid)
      if (toDelete.length > 0) {
        const batch = db.batch()
        toDelete.forEach(t => batch.delete(db.collection('callbackTickets').doc(t.id)))
        await batch.commit()
        results.push(`Removed ${toDelete.length} callback ticket(s)`)
      }
    } catch (err) {
      console.error('Failed to delete callback tickets:', err)
      results.push('Failed to remove callback tickets')
    }
  }

  // Delete identity docs
  try {
    await deleteAllIdentities(uid)
    results.push('Deleted identity records')
  } catch (err) {
    console.error('Failed to delete identity docs:', err)
  }

  // Delete the actual patient account and Firebase Auth user
  try {
    // 1. Delete from Firestore patients collection
    await db.collection('patients').doc(uid).delete()
    
    // 2. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(uid)
      results.push('Deleted patient account & auth completely')
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        console.error('Failed to delete auth user:', authErr)
        results.push('Removed patient profile but failed to remove auth user')
      } else {
        results.push('Deleted patient profile')
      }
    }
  } catch (err) {
    console.error('Failed to delete patient account:', err)
    results.push('Failed to remove patient account')
  }

  if (results.length === 0) {
    results.push('No matching data found to delete.')
  }

  return NextResponse.json({ success: true, results })
}

// POST — create a new patient from the admin dashboard
export async function POST(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, contactType, contactValue } = await request.json()

    if (!name || !contactType || !contactValue) {
      return NextResponse.json({ error: 'Name and contact info are required' }, { status: 400 })
    }

    let uid: string
    let normalizedIdentifier = contactValue.trim()
    if (contactType === 'email') {
      normalizedIdentifier = normalizedIdentifier.toLowerCase()
    }

    const newUserParams: any = { displayName: name }

    if (contactType === 'phone') {
      if (!normalizedIdentifier.startsWith('+')) {
        normalizedIdentifier = '+91' + normalizedIdentifier // Default to India
      }
      newUserParams.phoneNumber = normalizedIdentifier
      
      // Check if user already exists
      try {
        await adminAuth.getUserByPhoneNumber(normalizedIdentifier)
        return NextResponse.json({ error: 'A user with this phone number already exists.' }, { status: 400 })
      } catch {}
    } else {
      newUserParams.email = normalizedIdentifier
      
      try {
        await adminAuth.getUserByEmail(normalizedIdentifier)
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 })
      } catch {}
    }

    try {
      const newUser = await adminAuth.createUser(newUserParams)
      uid = newUser.uid
    } catch (createErr: any) {
      console.error('Failed to create user in Auth:', createErr)
      return NextResponse.json({ error: createErr.message || 'Failed to create user in Auth' }, { status: 400 })
    }

    // Create the Patient record in Firestore
    const patientData: any = { 
      uid, 
      name,
      authProviders: [contactType] 
    }
    if (contactType === 'phone') patientData.phone = normalizedIdentifier
    else patientData.email = normalizedIdentifier

    const patient = await createOrUpdatePatient(patientData)

    // Write identity doc for O(1) lookup
    await linkIdentity(contactType, normalizedIdentifier, uid)

    return NextResponse.json({ success: true, patient })
  } catch (err: any) {
    console.error('Error creating patient:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
