import { NextResponse } from 'next/server'
import {
  getDoctors,
  getAllAppointments,
  getWaitlist,
  addWaitlistEntry,
  type Appointment,
  type Doctor,
  type WaitlistEntry,
} from '@/lib/db'

const WAITLIST_MAX = 2

/** Resolve a doctor by ID or name, returning the canonical ID */
async function resolveDoctor(doctorId: string | null, doctorName: string | null): Promise<{ id: string; name: string } | null> {
  try {
    const doctors = await getDoctors()
    if (doctorId) {
      const d = doctors.find(d => d.id === doctorId)
      if (d) return { id: d.id, name: d.name }
    }
    if (doctorName) {
      const d = doctors.find(d =>
        d.name.toLowerCase() === doctorName.toLowerCase() ||
        d.name.toLowerCase().includes(doctorName.toLowerCase())
      )
      if (d) return { id: d.id, name: d.name }
    }
    return null
  } catch {
    return null
  }
}

// GET — check waitlist status for a slot
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const doctorId = searchParams.get('doctorId')
  const doctorName = searchParams.get('doctorName')
  const date = searchParams.get('date')
  const time = searchParams.get('time')

  if ((!doctorId && !doctorName) || !date || !time) {
    return NextResponse.json({ error: 'doctorId or doctorName, date, and time are required' }, { status: 400 })
  }

  try {
    const doctor = await resolveDoctor(doctorId, doctorName)
    const resolvedId = doctor?.id ?? doctorId ?? ''

    const waitlist = await getWaitlist()
    const entries = waitlist.filter(e => e.doctorId === resolvedId && e.date === date && e.time === time)

    return NextResponse.json({
      count: entries.length,
      isFull: entries.length >= WAITLIST_MAX,
      maxAllowed: WAITLIST_MAX,
    })
  } catch {
    return NextResponse.json({ count: 0, isFull: false, maxAllowed: WAITLIST_MAX })
  }
}

// POST — join the waitlist for a slot
export async function POST(request: Request) {
  const body = await request.json()
  const { doctorId, doctorName, date, time, patientName, patientEmail, patientPhone, service } = body

  if (!date || !time || !patientName || !patientEmail || !patientPhone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // Resolve the real doctorId from DB (handles AI returning wrong/empty ID)
    const doctor = await resolveDoctor(doctorId || null, doctorName || null)
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found. Please try again.' }, { status: 404 })
    }
    const resolvedId = doctor.id
    const resolvedName = doctor.name

    // Verify the slot is actually booked
    const appointments = await getAllAppointments()
    const slotTaken = appointments.some(
      a => a.doctorId === resolvedId && a.date === date && a.time === time && a.status === 'scheduled'
    )
    if (!slotTaken) {
      return NextResponse.json({
        slotNowFree: true,
        message: 'Great news! This slot just became available. You can book it directly now.',
      }, { status: 200 })
    }

    const waitlist = await getWaitlist()
    const existing = waitlist.filter(e => e.doctorId === resolvedId && e.date === date && e.time === time)

    if (existing.length >= WAITLIST_MAX) {
      return NextResponse.json({ error: `The waiting list for this slot is full (max ${WAITLIST_MAX}).`, isFull: true }, { status: 409 })
    }

    // Prevent duplicate entries for same patient in same slot
    const already = existing.find(e => e.patientEmail.toLowerCase() === patientEmail.toLowerCase())
    if (already) {
      return NextResponse.json({ error: 'You are already on the waiting list for this slot.', alreadyOnList: true }, { status: 409 })
    }

    const entry: WaitlistEntry = {
      id: `wl-${Date.now()}`,
      doctorId: resolvedId,
      doctorName: resolvedName,
      date,
      time,
      patientName,
      patientEmail,
      patientPhone,
      service: service || 'General Consultation',
      createdAt: new Date().toISOString(),
    }

    await addWaitlistEntry(entry)

    const updatedWaitlist = await getWaitlist()
    const position = updatedWaitlist.filter(e => e.doctorId === resolvedId && e.date === date && e.time === time).length

    return NextResponse.json({
      success: true,
      position,
      message: `✓ You're #${position} on the waiting list for ${resolvedName} on ${date} at ${time}. You'll be automatically booked if the slot opens up!`,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
