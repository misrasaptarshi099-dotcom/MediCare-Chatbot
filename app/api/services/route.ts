export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServices } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')

    let services = await getServices()

    if (department) {
      services = services.filter(s => s.department === department || s.departmentId === department)
    }

    return NextResponse.json(services)
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}
