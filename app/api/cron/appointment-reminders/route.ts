export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAllAppointments, type Appointment } from '@/lib/db'
import { sendAppointmentReminder } from '@/lib/reminder-email'
import { db } from '@/lib/firestore'

// GET /api/cron/appointment-reminders
// Called manually from the Admin Reminders page.
// The real nightly cron runs on Firebase Cloud Functions (9-min timeout).
// This is a convenience endpoint for manual triggers only.
export async function GET(request: Request) {
  // Simple auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'medicare-cron-2026'
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Calculate tomorrow's date in IST
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const tomorrow = new Date(istNow)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Get all scheduled appointments for tomorrow
    const appointments = await getAllAppointments()
    const tomorrowApts = appointments.filter(
      (a) => a.date === tomorrowStr && a.status === 'scheduled' && a.patientEmail
    )

    // Check which reminders have already been sent
    const remindersSnap = await db.collection('sentReminders').get()
    const sentIds = new Set<string>()
    remindersSnap.forEach((doc) => sentIds.add(doc.data().appointmentId))

    const results: { appointmentId: string; email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }[] = []

    for (const apt of tomorrowApts) {
      if (sentIds.has(apt.id)) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'skipped' })
        continue
      }

      try {
        await sendAppointmentReminder(apt)

        // Record that we sent this reminder
        await db.collection('sentReminders').doc(apt.id).set({
          appointmentId: apt.id,
          sentAt: new Date().toISOString(),
        })

        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'sent' })
      } catch (err) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'failed', error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
