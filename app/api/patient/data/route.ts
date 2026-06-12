export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import {
  getAppointmentsByPatientIdentifiers,
  getCallbackTicketsByPatientIdentifiers,
  getChatSession,
  getWaitlistByPatientUid,
  getWaitlistForSlot,
  getPatientReportsByUid,
  getPatientByUid,
  type WaitlistEntry,
  type LabReport,
} from '@/lib/db'

export async function GET(request: Request) {
  // ── AUTH: Verify Firebase ID token ──────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
  }

  let decodedToken
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1])
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ error: 'UID is required' }, { status: 400 })
  }

  // Ensure the authenticated user is only accessing their own data
  if (decodedToken.uid !== uid) {
    return NextResponse.json({ error: 'Forbidden: uid mismatch' }, { status: 403 })
  }

  try {
    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const email = patient.email?.toLowerCase().trim()
    const phone = patient.phone

    // Appointments — targeted queries by UID + email + phone fallback (no full-table scan)
    const userAppointments = await getAppointmentsByPatientIdentifiers(uid, email, phone)
      .catch(() => [])

    // Callbacks — targeted queries by UID + email + phone fallback
    const userCallbacks = await getCallbackTicketsByPatientIdentifiers(uid, email, phone)
      .catch(() => [])

    // Chats — already UID-scoped
    let userChats: { id: string, type: string, content: string, timestamp: number }[] = []
    try {
      const session = await getChatSession(uid)
      if (session?.messages) userChats = session.messages
    } catch {}

    // Waitlist entries — targeted query by UID, then compute positions per-slot
    let userWaitlist: (WaitlistEntry & { position: number })[] = []
    try {
      const entries = await getWaitlistByPatientUid(uid)
      // For each entry, get the full slot queue to compute position
      const withPositions = await Promise.all(
        entries.map(async (entry) => {
          const slotQueue = await getWaitlistForSlot(entry.doctorId, entry.date, entry.time)
          const position = slotQueue.findIndex(e => e.id === entry.id) + 1
          return { ...entry, position: position > 0 ? position : slotQueue.length + 1 }
        })
      )
      userWaitlist = withPositions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    } catch {}

    // Reports — strict UID-based
    let userReports: LabReport[] = []
    try {
      userReports = await getPatientReportsByUid(uid)
    } catch (e) {
      console.error('Error fetching patient reports:', e)
    }

    return NextResponse.json({
      patient,
      appointments: userAppointments,
      callbacks: userCallbacks,
      chats: userChats,
      waitlist: userWaitlist,
      reports: userReports,
    })
  } catch (error) {
    console.error('Error fetching patient data:', error)
    return NextResponse.json({ error: 'Failed to fetch patient records' }, { status: 500 })
  }
}
