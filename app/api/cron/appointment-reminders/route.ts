export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAppointments, type Appointment } from '@/lib/db'
import { sendAppointmentReminder } from '@/lib/reminder-email'
import { db } from '@/lib/firestore'

// GET /api/cron/appointment-reminders
// Called manually from the Admin Reminders page.
// The real nightly cron runs on Firebase Cloud Functions (9-min timeout).
// This is a convenience endpoint for manual triggers only.
export async function GET(request: Request) {
  // Auth check — require CRON_SECRET env var (no hardcoded fallback)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set')
    return NextResponse.json({ error: 'Cron endpoint is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  let isAuthorized = false;

  if (authHeader === `Bearer ${cronSecret}`) {
    isAuthorized = true;
  } else {
    // Try admin session fallback for manual UI triggers
    const { requireAdminSession } = await import('@/lib/admin-auth');
    const adminUser = await requireAdminSession();
    if (adminUser) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
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

    // Get scheduled appointments for tomorrow (targeted Firestore query — not a full-table scan)
    const tomorrowApts = (await getAppointments({ date: tomorrowStr, status: 'scheduled' }))
      .filter(a => a.patientEmail) // only those with email

    // Check which reminders have already been sent (targeted lookups by appointment ID)
    const reminderChecks = await Promise.all(
      tomorrowApts.map(apt =>
        db.collection('sentReminders').doc(apt.id).get()
      )
    )
    const sentIds = new Set<string>(
      reminderChecks.filter(d => d.exists).map(d => d.id)
    )

    const results: { appointmentId: string; email: string; status: 'sent' | 'skipped' | 'failed'; error?: string }[] = []

    for (const apt of tomorrowApts) {
      if (sentIds.has(apt.id)) {
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'skipped' })
        continue
      }

      const docRef = db.collection('sentReminders').doc(apt.id)

      try {
        await docRef.create({
          appointmentId: apt.id,
          state: 'pending',
          createdAt: new Date().toISOString()
        })
      } catch (err: any) {
        if (err.code === 6) { // ALREADY_EXISTS
          results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'skipped' })
          continue
        }
        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'failed', error: String(err) })
        continue
      }

      try {
        await sendAppointmentReminder(apt)

        await docRef.update({
          state: 'sent',
          sentAt: new Date().toISOString(),
        })

        results.push({ appointmentId: apt.id, email: apt.patientEmail, status: 'sent' })
      } catch (err) {
        await docRef.delete().catch(console.error)
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
