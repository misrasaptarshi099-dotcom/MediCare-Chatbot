import { NextResponse } from 'next/server'
import {
  getAllAppointments,
  updateAppointment,
  addAppointment,
  getWaitlist,
  deleteWaitlistEntry,
  type Appointment,
  type WaitlistEntry,
} from '@/lib/db'

async function promoteFromWaitlist(doctorId: string, date: string, time: string) {
  try {
    const waitlist = await getWaitlist()
    const match = waitlist
      .filter(e => e.doctorId === doctorId && e.date === date && e.time === time)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

    if (!match) return

    // Remove from waitlist
    await deleteWaitlistEntry(match.id)

    // Book their appointment automatically
    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      patientName: match.patientName,
      patientPhone: match.patientPhone,
      patientEmail: match.patientEmail,
      doctorId: match.doctorId,
      doctorName: match.doctorName,
      date: match.date,
      time: match.time,
      service: match.service,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    }
    await addAppointment(newApt)
  } catch {}
}

// PATCH /api/appointments/manage  — cancel or reschedule
export async function PATCH(request: Request) {
  const { appointmentId, action, newDate, newTime, patientEmail } = await request.json()

  if (!appointmentId || !action) {
    return NextResponse.json({ error: 'appointmentId and action are required' }, { status: 400 })
  }

  try {
    const appointments = await getAllAppointments()
    const apt = appointments.find(a => a.id === appointmentId)

    if (!apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Security: only allow the patient who owns it (if email provided)
    if (patientEmail && apt.patientEmail?.toLowerCase() !== patientEmail.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'cancel') {
      await updateAppointment(appointmentId, { status: 'cancelled' })
      // Promote next person on waitlist for the freed slot
      await promoteFromWaitlist(apt.doctorId, apt.date, apt.time)
      return NextResponse.json({ success: true, message: 'Appointment cancelled successfully.' })
    }

    if (action === 'reschedule') {
      if (!newDate || !newTime) {
        return NextResponse.json({ error: 'newDate and newTime are required for rescheduling' }, { status: 400 })
      }

      // Check the new slot is free
      const conflict = appointments.find(
        a => a.doctorId === apt.doctorId && a.date === newDate && a.time === newTime && a.status === 'scheduled' && a.id !== appointmentId
      )
      if (conflict) {
        return NextResponse.json({ error: 'The new slot is already booked. Please choose another.' }, { status: 409 })
      }

      const oldDoctorId = apt.doctorId
      const oldDate = apt.date
      const oldTime = apt.time

      await updateAppointment(appointmentId, { date: newDate, time: newTime })

      // Free the old slot → promote from waitlist
      await promoteFromWaitlist(oldDoctorId, oldDate, oldTime)

      return NextResponse.json({
        success: true,
        message: `Rescheduled to ${newDate} at ${newTime}.`,
        appointment: { ...apt, date: newDate, time: newTime },
      })
    }

    return NextResponse.json({ error: 'Invalid action. Use "cancel" or "reschedule".' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
