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

/** Promote first waitlisted patient into a real appointment when a slot frees up */
async function promoteFromWaitlist(doctorId: string, date: string, time: string): Promise<WaitlistEntry | null> {
  try {
    const waitlist = await getWaitlist()
    const match = waitlist
      .filter(e => e.doctorId === doctorId && e.date === date && e.time === time)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]

    if (!match) return null

    // Remove from waitlist
    await deleteWaitlistEntry(match.id)

    // Book their appointment
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
    return match
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateFilter = searchParams.get('date')
  const statusFilter = searchParams.get('status')

  try {
    const appointments = await getAllAppointments()
    let filtered = [...appointments]

    if (dateFilter && dateFilter !== 'all') {
      filtered = filtered.filter(a => a.date === dateFilter)
    }
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter)
    }

    const sorted = filtered.sort((a, b) =>
      new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime()
    )
    return NextResponse.json({ appointments: sorted })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ appointments: [] })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 })
    }

    const appointments = await getAllAppointments()
    const apt = appointments.find(a => a.id === id)

    if (!apt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const oldStatus = apt.status
    const updateData: Record<string, any> = { status }

    // ── Payment status logic ──
    // If admin marks "completed", assume patient paid upfront/offline → set paid
    if (status === 'completed') {
      updateData.paymentStatus = 'paid'
    }
    // If admin cancels and it was previously paid → initiate refund
    if (status === 'cancelled' && apt.paymentStatus === 'paid') {
      updateData.paymentStatus = 'refunded'
    }

    await updateAppointment(id, updateData)

    // ── KEY FIX: promote from waitlist whenever admin cancels a scheduled slot ──
    let promoted: WaitlistEntry | null = null
    if (status === 'cancelled' && oldStatus === 'scheduled') {
      promoted = await promoteFromWaitlist(apt.doctorId, apt.date, apt.time)
    }

    return NextResponse.json({
      success: true,
      appointment: { ...apt, status },
      promoted: promoted
        ? { name: promoted.patientName, email: promoted.patientEmail }
        : null,
      message: promoted
        ? `Appointment cancelled. ${promoted.patientName} was automatically promoted from the waitlist.`
        : 'Appointment status updated.',
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
