import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getPatientByUid, deleteAllIdentities, getAppointmentsByPatientUid, getCallbackTicketsByPatientUid } from '@/lib/db'
import { db } from '@/lib/firestore'

export async function POST(request: Request) {
  try {
    // Verify user is logged in
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    const { confirmText } = await request.json()

    // Safety: require typing DELETE to confirm
    if (confirmText !== 'DELETE') {
      return NextResponse.json({ error: 'You must type DELETE to confirm account deletion' }, { status: 400 })
    }

    // Verify patient exists
    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const results: string[] = []
    const errors: string[] = []
    const CHUNK_SIZE = 500

    // 1. Delete all identity docs
    try {
      await deleteAllIdentities(uid)
      results.push('Deleted identity records')
    } catch (e: any) {
      console.error('Failed to delete identities:', e)
      errors.push(`deleteAllIdentities: ${e.message || e}`)
    }

    // 2. Delete appointments
    try {
      const appointments = await getAppointmentsByPatientUid(uid)
      if (appointments.length > 0) {
        for (let i = 0; i < appointments.length; i += CHUNK_SIZE) {
          const chunk = appointments.slice(i, i + CHUNK_SIZE)
          const batch = db.batch()
          chunk.forEach(a => batch.delete(db.collection('appointments').doc(a.id)))
          await batch.commit()
        }
        results.push(`Removed ${appointments.length} appointment(s)`)
      }
    } catch (e: any) {
      console.error('Failed to delete appointments:', e)
      errors.push(`appointments batch delete: ${e.message || e}`)
    }

    // 3. Delete chat sessions
    try {
      const chatRef = db.collection('chatSessions').doc(uid)
      const chatDoc = await chatRef.get()
      if (chatDoc.exists) {
        await chatRef.delete()
        results.push('Removed chat history')
      }
    } catch (e: any) {
      console.error('Failed to delete chats:', e)
      errors.push(`chatSessions doc delete: ${e.message || e}`)
    }

    // 4. Delete callback tickets
    try {
      const tickets = await getCallbackTicketsByPatientUid(uid)
      if (tickets.length > 0) {
        for (let i = 0; i < tickets.length; i += CHUNK_SIZE) {
          const chunk = tickets.slice(i, i + CHUNK_SIZE)
          const batch = db.batch()
          chunk.forEach(t => batch.delete(db.collection('callbackTickets').doc(t.id)))
          await batch.commit()
        }
        results.push(`Removed ${tickets.length} callback ticket(s)`)
      }
    } catch (e: any) {
      console.error('Failed to delete callback tickets:', e)
      errors.push(`callbackTickets batch delete: ${e.message || e}`)
    }

    // 5. Delete lab reports
    try {
      const reportsSnap = await db.collection('labReports').where('patientUid', '==', uid).get()
      if (!reportsSnap.empty) {
        const docs = reportsSnap.docs
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE)
          const batch = db.batch()
          chunk.forEach(doc => batch.delete(doc.ref))
          await batch.commit()
        }
        results.push(`Removed ${reportsSnap.size} lab report(s)`)
      }
    } catch (e: any) {
      console.error('Failed to delete lab reports:', e)
      errors.push(`labReports batch delete: ${e.message || e}`)
    }

    // 6. Delete patient document
    try {
      await db.collection('patients').doc(uid).delete()
      results.push('Deleted patient profile')
    } catch (e: any) {
      console.error('Failed to delete patient doc:', e)
      errors.push(`patients doc delete: ${e.message || e}`)
    }

    // 7. Delete Firebase Auth user
    try {
      await adminAuth.deleteUser(uid)
      results.push('Deleted authentication account')
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        console.error('Failed to delete auth user:', e)
        errors.push(`adminAuth.deleteUser: ${e.message || e}`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors, results }, { status: 500 })
    }

    return NextResponse.json({ success: true, results })

  } catch (error: any) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
