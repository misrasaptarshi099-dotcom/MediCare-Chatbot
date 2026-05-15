export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  getAllAppointments,
  getCallbackTickets,
  getChatSession,
  getWaitlist,
  getPatientReportsByUid,
  getPatientByUid,
  type Appointment,
  type CallbackTicket,
  type WaitlistEntry,
  type LabReport,
} from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ error: 'UID is required' }, { status: 400 })
  }

  try {
    const patient = await getPatientByUid(uid)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const email = patient.email?.toLowerCase().trim()

    // Appointments (match by patientUid or fallback to email if old record)
    let userAppointments: Appointment[] = []
    try {
      const appointments = await getAllAppointments()
      userAppointments = appointments
        .filter(apt => {
          if (apt.patientUid === uid) return true
          if (email && apt.patientEmail?.toLowerCase().trim() === email) return true
          if (patient.phone && apt.patientPhone === patient.phone) return true
          return false
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Callbacks
    let userCallbacks: CallbackTicket[] = []
    try {
      const tickets = await getCallbackTickets()
      userCallbacks = tickets
        .filter(cb => {
          if (cb.patientUid === uid) return true
          if (email && cb.patientEmail?.toLowerCase().trim() === email) return true
          if (patient.phone && cb.patientPhone === patient.phone) return true
          return false
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Chats
    let userChats: { id: string, type: string, content: string, timestamp: number }[] = []
    try {
      const session = await getChatSession(uid)
      if (session?.messages) userChats = session.messages
    } catch {}

    // Waitlist entries
    let userWaitlist: (WaitlistEntry & { position: number })[] = []
    try {
      const waitlist = await getWaitlist()
      userWaitlist = waitlist
        .map(entry => {
          const slotQueue = waitlist.filter(
            e => e.doctorId === entry.doctorId && e.date === entry.date && e.time === entry.time
          )
          const position = slotQueue.findIndex(e => e.id === entry.id) + 1
          return { ...entry, position }
        })
        .filter(e => {
          if (e.patientUid === uid) return true
          if (email && e.patientEmail?.toLowerCase().trim() === email) return true
          if (patient.phone && e.patientPhone === patient.phone) return true
          return false
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Reports — strict UID-based as requested
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
