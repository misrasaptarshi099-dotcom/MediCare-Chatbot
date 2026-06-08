import { requireAdminSession } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getAppointmentStats } from '@/lib/db'

export async function GET() {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const stats = await getAppointmentStats()

    return NextResponse.json({
      appointmentCount: stats.count,
      recentAppointments: stats.recent
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ appointmentCount: 0, recentAppointments: [] })
  }
}
