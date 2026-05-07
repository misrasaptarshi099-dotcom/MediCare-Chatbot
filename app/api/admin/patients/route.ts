import { NextResponse } from 'next/server'
import {
  getAllAppointments,
  getAllChatSessions,
  getCallbackTickets,
  getAppointments,
  saveChatSession,
  type Appointment,
  type CallbackTicket,
  type ChatSession,
} from '@/lib/db'
import { db } from '@/lib/firestore'

// GET — list all unique patients from appointments + callback tickets + chats
export async function GET() {
  try {
    const emails = new Set<string>()
    const patientMap: Record<string, { email: string; name: string; appointmentCount: number; callbackCount: number; chatCount: number }> = {}

    // From appointments
    try {
      const appointments = await getAllAppointments()
      for (const apt of appointments) {
        if (apt.patientEmail) {
          const e = apt.patientEmail.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: apt.patientName || e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].appointmentCount++
        }
      }
    } catch {}

    // From callback tickets
    try {
      const tickets = await getCallbackTickets()
      for (const cb of tickets) {
        if (cb.patientEmail) {
          const e = cb.patientEmail.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: cb.patientName || e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].callbackCount++
        }
      }
    } catch {}

    // From chat sessions
    try {
      const sessions = await getAllChatSessions()
      for (const s of sessions) {
        if (s.email) {
          const e = s.email.toLowerCase().trim()
          emails.add(e)
          if (!patientMap[e]) patientMap[e] = { email: e, name: e, appointmentCount: 0, callbackCount: 0, chatCount: 0 }
          patientMap[e].chatCount = s.messages?.length || 0
        }
      }
    } catch {}

    return NextResponse.json({ patients: Object.values(patientMap) })
  } catch (err) {
    console.error('Error fetching patients:', err)
    return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
  }
}

// DELETE — remove a patient's appointments, chats, and/or callback tickets
export async function DELETE(request: Request) {
  const { email, deleteAppointments, deleteChats, deleteCallbacks } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const results: string[] = []

  // Delete appointments
  if (deleteAppointments) {
    try {
      const appointments = await getAllAppointments()
      const toDelete = appointments.filter(a => a.patientEmail?.toLowerCase().trim() === normalizedEmail)
      const batch = db.batch()
      toDelete.forEach(a => batch.delete(db.collection('appointments').doc(a.id)))
      await batch.commit()
      results.push(`Removed ${toDelete.length} appointment(s)`)
    } catch {
      results.push('No appointments found')
    }
  }

  // Delete chat history
  if (deleteChats) {
    try {
      await db.collection('chatSessions').doc(normalizedEmail).delete()
      results.push('Removed chat session')
    } catch {
      results.push('No chat history found')
    }
  }

  // Delete callback tickets
  if (deleteCallbacks) {
    try {
      const tickets = await getCallbackTickets()
      const toDelete = tickets.filter(t => t.patientEmail?.toLowerCase().trim() === normalizedEmail)
      const batch = db.batch()
      toDelete.forEach(t => batch.delete(db.collection('callbackTickets').doc(t.id)))
      await batch.commit()
      results.push(`Removed ${toDelete.length} callback ticket(s)`)
    } catch {
      results.push('No callback tickets found')
    }
  }

  return NextResponse.json({ success: true, results })
}
