import { NextResponse } from 'next/server'
import { getAllAppointments, getSentReminders, markReminderSent, type Appointment } from '@/lib/db'
import { sendAppointmentReminder } from '@/lib/reminder-email'

// Secure the cron route with a secret token
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'medicare-cron-2026'
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  // Allow admin calls without auth header (handled by admin portal separately)
  // But for automated cron calls, require the secret
  const userAgent = request.headers.get('user-agent') || ''
  const isAdminCall = userAgent.includes('next-internal') || request.headers.get('x-admin-call') === '1'
  
  if (!isAuthorized(request) && !isAdminCall) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const appointments = await getAllAppointments()

    // Get tomorrow's date in IST (UTC+5:30)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const tomorrow = new Date(istNow)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]  // YYYY-MM-DD

    const tomorrowApts = appointments.filter(
      a => a.date === tomorrowStr && a.status === 'scheduled' && a.patientEmail
    )

    const alreadySent = await getSentReminders()
    const sentIds = new Set(alreadySent.map(s => s.appointmentId))

    const results: { appointmentId: string; email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }[] = []

    for (const apt of tomorrowApts) {
      if (sentIds.has(apt.id)) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail!, status: 'skipped' })
        continue
      }
      try {
        await sendAppointmentReminder(apt)
        await markReminderSent(apt.id)
        results.push({ appointmentId: apt.id, email: apt.patientEmail!, status: 'sent' })
      } catch (err) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail!, status: 'failed', error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      date: tomorrowStr,
      totalTomorrow: tomorrowApts.length,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
