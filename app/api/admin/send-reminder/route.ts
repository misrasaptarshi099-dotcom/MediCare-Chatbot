import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { getAllAppointments, type Appointment } from '@/lib/db'
import { sendAppointmentReminder } from '@/lib/reminder-email'

// POST /api/admin/send-reminder
// Body: { appointmentId: string }  — send to one appointment
// Body: { date: string }           — send to all appointments on a given date
export async function POST(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json()
  const { appointmentId, date } = body

  try {
    const appointments = await getAllAppointments()

    let targets: Appointment[] = []

    if (appointmentId) {
      const apt = appointments.find(a => a.id === appointmentId)
      if (!apt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      targets = [apt]
    } else if (date) {
      targets = appointments.filter(a => a.date === date && a.status === 'scheduled' && a.patientEmail)
    } else {
      return NextResponse.json({ error: 'Provide appointmentId or date' }, { status: 400 })
    }

    const results: { appointmentId: string; email: string; status: 'sent' | 'failed'; error?: string }[] = []

    for (const apt of targets) {
      if (!apt.patientEmail) {
        results.push({ appointmentId: apt.id, email: '—', status: 'failed', error: 'No email on record' })
        continue
      }
      try {
        await sendAppointmentReminder(apt)
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'sent' })
      } catch (err) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'failed', error: String(err) })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    return NextResponse.json({ success: true, sent, total: results.length, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
