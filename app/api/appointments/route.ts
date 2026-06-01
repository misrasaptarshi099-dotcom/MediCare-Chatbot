import { NextResponse } from 'next/server'
import {
  getDoctors,
  getAllAppointments,
  addAppointment,
  type Appointment,
  type Doctor,
} from '@/lib/db'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { appointmentSchema, validateInput } from '@/lib/sanitize'

function normalizeToHHMM(value: string): string {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed

  const timeParts = trimmed.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!timeParts) return trimmed

  let hours = parseInt(timeParts[1], 10)
  const minutes = timeParts[2]
  const ampm = timeParts[3].toUpperCase()
  if (ampm === 'PM' && hours < 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${minutes}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const doctorId = searchParams.get('doctorId')
  const doctorName = searchParams.get('doctorName')
  const date = searchParams.get('date')

  // Treat the literal string "undefined" as missing (guard against bad client calls)
  const effectiveId = doctorId && doctorId !== 'undefined' ? doctorId : null
  const effectiveName = doctorName && doctorName.trim() ? doctorName.trim() : null

  if (!effectiveId && !effectiveName || !date) {
    return NextResponse.json({ error: 'doctorId or doctorName, and date are required' }, { status: 400 })
  }

  try {
    const doctors = await getDoctors()
    const appointments = await getAllAppointments()

    // Try finding by ID first, fallback to name (case-insensitive)
    let doctor: Doctor | null = null;
    if (effectiveId) {
      doctor = doctors.find(d => d.id === effectiveId) ?? null
    }
    if (!doctor && effectiveName) {
      doctor = doctors.find(d => 
        d.name.toLowerCase() === effectiveName.toLowerCase() || 
        d.name.toLowerCase().includes(effectiveName.toLowerCase())
      ) ?? null
    }

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const resolvedDoctorId = doctor.id
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const allSlots = doctor.availability[dayOfWeek] || []

    // Booked slots: stored as HH:mm in appointments
    const bookedTimesSet = new Set(
      appointments
        .filter(apt => apt.doctorId === resolvedDoctorId && apt.date === date && apt.status === 'scheduled')
        .map(apt => normalizeToHHMM(apt.time))
    )

    // Match HH:mm against a display slot like "11:00 AM"
    function slotMatchesHHMM(displaySlot: string, hhmm: string): boolean {
      const tp = displaySlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
      if (!tp) return false
      let h = parseInt(tp[1], 10)
      const m = tp[2]
      const ampm = tp[3].toUpperCase()
      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      return hhmm === `${h.toString().padStart(2, '0')}:${m}`
    }

    const bookedSlots = allSlots.filter(slot =>
      [...bookedTimesSet].some(hhmm => slotMatchesHHMM(slot, hhmm))
    )
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot))

    return NextResponse.json({
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        department: doctor.department,
        roomNumber: doctor.roomNumber,
        consultationFee: doctor.consultationFee
      },
      date,
      dayOfWeek,
      availableSlots,
      bookedSlots
    })
  } catch (error) {
    console.error('Error fetching doctor schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Input validation
    const validation = validateInput(appointmentSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { patientName, patientPhone, patientEmail, patientUid, doctorId, date, time, service, paymentStatus, amount } = validation.data

    // Rate limit: 3 bookings per day per IP/UID
    const rateLimitId = patientUid || getClientIp(request)
    const bookingCheck = checkRateLimit(rateLimitKey('booking-day', rateLimitId), 3, 24 * 60 * 60 * 1000)
    if (!bookingCheck.allowed) {
      return NextResponse.json(
        { error: 'You have reached the maximum number of bookings for today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const doctors = await getDoctors()
    const appointments = await getAllAppointments()

    // Try finding by ID first, fallback to name (case-insensitive)
    let doctor = doctors.find(d => d.id === doctorId)
    if (!doctor && validation.data.doctorName) {
      doctor = doctors.find(d => 
        d.name.toLowerCase() === validation.data.doctorName!.toLowerCase() || 
        d.name.toLowerCase().includes(validation.data.doctorName!.toLowerCase())
      )
    }

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Ensure we use the resolved doctor's actual ID for the booking record
    const resolvedDoctorId = doctor.id

    // Check if slot is available
    const normalizedRequestedTime = normalizeToHHMM(time)
    const existingAppointment = appointments.find(
      apt =>
        apt.doctorId === resolvedDoctorId &&
        apt.date === date &&
        normalizeToHHMM(apt.time) === normalizedRequestedTime &&
        apt.status === 'scheduled'
    )

    if (existingAppointment) {
      return NextResponse.json({ error: 'This slot is already booked' }, { status: 409 })
    }

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      patientName,
      patientPhone,
      patientEmail: patientEmail || '',
      patientUid: patientUid || undefined,
      doctorId: resolvedDoctorId,
      doctorName: doctor.name,
      date,
      time: normalizedRequestedTime,
      service: service || 'General Consultation',
      status: 'scheduled',
      paymentStatus: paymentStatus || 'unpaid',
      amount: amount || doctor.consultationFee || 0,
      createdAt: new Date().toISOString()
    }

    await addAppointment(newAppointment)

    return NextResponse.json({
      success: true,
      appointment: newAppointment,
      message: `Appointment booked with ${doctor.name} on ${date} at ${time}`
    })
  } catch (error) {
    console.error('Error booking appointment:', error)
    return NextResponse.json({ error: 'Failed to book appointment' }, { status: 500 })
  }
}
