import { NextResponse } from 'next/server'
import {
  getAllPatients,
  getAllAppointments,
  getAllChatSessions,
  getCallbackTickets,
  createOrUpdatePatient
} from '@/lib/db'
import { db } from '@/lib/firestore'
import { adminAuth } from '@/lib/firebase-admin'

// GET — list all unique patients from the patients collection
export async function GET() {
  try {
    const patients = await getAllPatients()
    const patientMap: Record<string, any> = {}

    for (const p of patients) {
      patientMap[p.uid] = {
        uid: p.uid,
        email: p.email || '',
        phone: p.phone || '',
        name: p.name || 'Unknown',
        authProviders: p.authProviders || [],
        appointmentCount: 0,
        callbackCount: 0,
        chatCount: 0,
      }
    }

    // From appointments
    try {
      const appointments = await getAllAppointments()
      for (const apt of appointments) {
        const uid = apt.patientUid
        if (uid && patientMap[uid]) {
          patientMap[uid].appointmentCount++
        } else if (apt.patientEmail) {
          const e = apt.patientEmail.toLowerCase().trim()
          const p = Object.values(patientMap).find(pat => pat.email?.toLowerCase().trim() === e)
          if (p) p.appointmentCount++
        }
      }
    } catch {}

    // From callback tickets
    try {
      const tickets = await getCallbackTickets()
      for (const cb of tickets) {
        const uid = cb.patientUid
        if (uid && patientMap[uid]) {
          patientMap[uid].callbackCount++
        } else if (cb.patientEmail) {
           const e = cb.patientEmail.toLowerCase().trim()
           const p = Object.values(patientMap).find(pat => pat.email?.toLowerCase().trim() === e)
           if (p) p.callbackCount++
        }
      }
    } catch {}

    // From chat sessions
    try {
      const sessions = await getAllChatSessions()
      // Chat session IDs are usually the user UID
      for (const s of sessions) {
         if (s.id && patientMap[s.id]) {
           patientMap[s.id].chatCount = s.messages?.length || 0
         }
      }
    } catch {}

    return NextResponse.json({ patients: Object.values(patientMap) })
  } catch (err) {
    console.error('Error fetching patients:', err)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

// DELETE — remove a patient's appointments, waitlist, chats, and/or callback tickets
export async function DELETE(request: Request) {
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
  try {
    const { name, contactType, contactValue } = await request.json()

    if (!name || !contactType || !contactValue) {
      return NextResponse.json({ error: 'Name and contact info are required' }, { status: 400 })
    }

    let uid: string
    let normalizedIdentifier = contactValue.trim()

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

    return NextResponse.json({ success: true, patient })
  } catch (err: any) {
    console.error('Error creating patient:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
