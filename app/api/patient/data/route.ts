export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  getAllAppointments,
  getCallbackTickets,
  getChatSession,
  getWaitlist,
  getPatientReports,
  type Appointment,
  type CallbackTicket,
  type WaitlistEntry,
  type LabReport,
} from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    const normalizedEmail = email.toLowerCase().trim()

    // Appointments
    let userAppointments: Appointment[] = []
    try {
      const appointments = await getAllAppointments()
      userAppointments = appointments
        .filter(apt => apt.patientEmail?.toLowerCase().trim() === normalizedEmail)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Callbacks
    let userCallbacks: CallbackTicket[] = []
    try {
      const tickets = await getCallbackTickets()
      userCallbacks = tickets
        .filter(cb => cb.patientEmail?.toLowerCase().trim() === normalizedEmail)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Chats
    let userChats: { id: string, type: string, content: string, timestamp: number }[] = []
    try {
      const session = await getChatSession(normalizedEmail)
      if (session?.messages) userChats = session.messages
    } catch {}

    // Waitlist entries for this patient, with their position in each slot's queue
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
        .filter(e => e.patientEmail?.toLowerCase().trim() === normalizedEmail)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch {}

    // Reports
    let userReports: LabReport[] = []
    try {
      userReports = await getPatientReports(normalizedEmail)
    } catch (e) {
      console.error('Error fetching patient reports:', e)
    }

    return NextResponse.json({
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
