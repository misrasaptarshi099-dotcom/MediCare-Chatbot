export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  getDepartments,
  getServices,
  getVisitingHours,
  updateDepartment,
  type Department,
  type DepartmentsData,
} from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  try {
    if (searchParams.get('type') === 'services') {
      const services = await getServices()
      return NextResponse.json({ services })
    }

    const departments = await getDepartments()
    const visitingHours = await getVisitingHours()

    return NextResponse.json({
      departments,
      visitingHours: visitingHours || {
        general: { weekdays: 'Not configured', weekends: 'Not configured' },
        icu: { allowed: 'Not configured', maxVisitors: 0, notes: '' }
      }
    })
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 })
    }

    await updateDepartment(id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}
