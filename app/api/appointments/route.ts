import { NextResponse } from 'next/server'
import {
  getDoctors,
  getAllAppointments,
  addAppointment,
  type Appointment,
  type Doctor,
} from '@/lib/db'

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
        .map(apt => apt.time)
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
    const { patientName, patientPhone, patientEmail, doctorId, date, time, service } = body

    if (!patientName || !patientPhone || (!doctorId && !body.doctorName) || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const doctors = await getDoctors()
    const appointments = await getAllAppointments()

    // Try finding by ID first, fallback to name (case-insensitive)
    let doctor = doctors.find(d => d.id === doctorId)
    if (!doctor && body.doctorName) {
      doctor = doctors.find(d => 
        d.name.toLowerCase() === body.doctorName.toLowerCase() || 
        d.name.toLowerCase().includes(body.doctorName.toLowerCase())
      )
    }

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    // Ensure we use the resolved doctor's actual ID for the booking record
    const resolvedDoctorId = doctor.id

    // Check if slot is available
    const existingAppointment = appointments.find(
      apt => apt.doctorId === resolvedDoctorId && apt.date === date && apt.time === time && apt.status === 'scheduled'
    )

    if (existingAppointment) {
      return NextResponse.json({ error: 'This slot is already booked' }, { status: 409 })
    }

    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      patientName,
      patientPhone,
      patientEmail: patientEmail || '',
      doctorId: resolvedDoctorId,
      doctorName: doctor.name,
      date,
      time,
      service: service || 'General Consultation',
      status: 'scheduled',
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
