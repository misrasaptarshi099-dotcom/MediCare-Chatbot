import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { getPatientByUid, deleteAllIdentities, getAllAppointments, getCallbackTickets } from '@/lib/db'
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

    // 1. Delete all identity docs
    try {
      await deleteAllIdentities(uid)
      results.push('Deleted identity records')
    } catch (e) {
      console.error('Failed to delete identities:', e)
    }

    // 2. Delete appointments
    try {
      const appointments = await getAllAppointments()
      const toDelete = appointments.filter(a => a.patientUid === uid)
      if (toDelete.length > 0) {
        const batch = db.batch()
        toDelete.forEach(a => batch.delete(db.collection('appointments').doc(a.id)))
        await batch.commit()
        results.push(`Removed ${toDelete.length} appointment(s)`)
      }
    } catch (e) {
      console.error('Failed to delete appointments:', e)
    }

    // 3. Delete chat sessions
    try {
      const chatRef = db.collection('chatSessions').doc(uid)
      const chatDoc = await chatRef.get()
      if (chatDoc.exists) {
        await chatRef.delete()
        results.push('Removed chat history')
      }
    } catch (e) {
      console.error('Failed to delete chats:', e)
    }

    // 4. Delete callback tickets
    try {
      const tickets = await getCallbackTickets()
      const toDelete = tickets.filter(t => t.patientUid === uid)
      if (toDelete.length > 0) {
        const batch = db.batch()
        toDelete.forEach(t => batch.delete(db.collection('callbackTickets').doc(t.id)))
        await batch.commit()
        results.push(`Removed ${toDelete.length} callback ticket(s)`)
      }
    } catch (e) {
      console.error('Failed to delete callback tickets:', e)
    }

    // 5. Delete lab reports
    try {
      const reportsSnap = await db.collection('labReports').where('patientUid', '==', uid).get()
      if (!reportsSnap.empty) {
        const batch = db.batch()
        reportsSnap.docs.forEach(doc => batch.delete(doc.ref))
        await batch.commit()
        results.push(`Removed ${reportsSnap.size} lab report(s)`)
      }
    } catch (e) {
      console.error('Failed to delete lab reports:', e)
    }

    // 6. Delete patient document
    try {
      await db.collection('patients').doc(uid).delete()
      results.push('Deleted patient profile')
    } catch (e) {
      console.error('Failed to delete patient doc:', e)
    }

    // 7. Delete Firebase Auth user
    try {
      await adminAuth.deleteUser(uid)
      results.push('Deleted authentication account')
    } catch (e: any) {
      if (e.code !== 'auth/user-not-found') {
        console.error('Failed to delete auth user:', e)
      }
    }

    return NextResponse.json({ success: true, results })

  } catch (error: any) {
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
