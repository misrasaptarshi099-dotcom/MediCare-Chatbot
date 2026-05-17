import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import { getWaitlist, deleteWaitlistEntry, type WaitlistEntry } from '@/lib/db'

// GET — list all waitlist entries (with optional filters)
export async function GET(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url)
  const doctorFilter = searchParams.get('doctorId')
  const dateFilter = searchParams.get('date')

  try {
    let entries = await getWaitlist()

    if (doctorFilter && doctorFilter !== 'all') {
      entries = entries.filter(e => e.doctorId === doctorFilter)
    }
    if (dateFilter && dateFilter !== 'all') {
      entries = entries.filter(e => e.date === dateFilter)
    }

    // Sort by date/time, then by createdAt (queue position)
    entries.sort((a, b) => {
      const dateCompare = (a.date + a.time).localeCompare(b.date + b.time)
      if (dateCompare !== 0) return dateCompare
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    // Attach queue position per slot
    const allEntries = await getWaitlist() // full list for position calc
    const withPosition = entries.map(entry => {
      const slotEntries = allEntries
        .filter(e => e.doctorId === entry.doctorId && e.date === entry.date && e.time === entry.time)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const position = slotEntries.findIndex(e => e.id === entry.id) + 1
      return { ...entry, position }
    })

    return NextResponse.json({ waitlist: withPosition, total: withPosition.length })
  } catch {
    return NextResponse.json({ waitlist: [], total: 0 })
  }
}

// DELETE — remove a specific waitlist entry (admin manually removes someone)
export async function DELETE(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Waitlist entry ID required' }, { status: 400 })
  }

  try {
    const entries = await getWaitlist()
    const exists = entries.find(e => e.id === id)

    if (!exists) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    await deleteWaitlistEntry(id)

    return NextResponse.json({ success: true, message: 'Waitlist entry removed.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
