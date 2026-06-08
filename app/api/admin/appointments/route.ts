import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import {
  getAppointments,
  getAppointment,
  updateAppointment,
  addAppointment,
  type Appointment,
  type WaitlistEntry,
} from '@/lib/db'
import { db } from '@/lib/firestore'

/** Promote first waitlisted patient into a real appointment when a slot frees up.
 *  Uses a Firestore transaction so the read-delete-create is atomic. */
async function promoteFromWaitlist(doctorId: string, date: string, time: string): Promise<WaitlistEntry | null> {
  try {
    return await db.runTransaction(async (txn) => {
      const waitlistQuery = db.collection('waitlist')
        .where('doctorId', '==', doctorId)
        .where('date', '==', date)
        .where('time', '==', time)
        .orderBy('createdAt', 'asc')
        .limit(1)

      const snap = await txn.get(waitlistQuery)
      if (snap.empty) return null

      const doc = snap.docs[0]
      const match = { id: doc.id, ...doc.data() } as WaitlistEntry

      // Delete from waitlist inside the transaction
      txn.delete(doc.ref)

      // Create the appointment inside the transaction
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
      txn.set(db.collection('appointments').doc(newApt.id), newApt)

      return match
    })
  } catch (err) {
    console.error('promoteFromWaitlist transaction failed:', err)
    return null
  }
}

export async function GET(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url)
  const dateFilter = searchParams.get('date')
  const statusFilter = searchParams.get('status')
  const cursor = searchParams.get('cursor')
  const limitStr = searchParams.get('limit')
  const parsedLimit = limitStr ? parseInt(limitStr, 10) : 100
  if (limitStr && (isNaN(parsedLimit) || parsedLimit <= 0)) {
    return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
  }
  const limit = Math.min(Math.max(parsedLimit, 1), 100)

  try {
    const filters: any = { limit }
    if (dateFilter && dateFilter !== 'all') filters.date = dateFilter
    if (statusFilter && statusFilter !== 'all') filters.status = statusFilter
    if (cursor) filters.startAfterCursor = cursor

    const appointments = await getAppointments(filters)
    
    // We get them sorted by createdAt desc by default from the DB.
    const nextCursor = appointments.length === limit && appointments.length > 0 
      ? `${appointments[appointments.length - 1].createdAt}|${appointments[appointments.length - 1].id}` 
      : null

    return NextResponse.json({ appointments, nextCursor })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ appointments: [] })
  }
}

export async function PUT(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status } = await request.json()

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status required' }, { status: 400 })
    }

    const apt = await getAppointment(id)

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
