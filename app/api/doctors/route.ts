export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  getDoctors,
  addDoctor,
  updateDoctor,
  deleteDoctor,
  type Doctor,
} from '@/lib/db'

export async function GET() {
  try {
    const doctors = await getDoctors()
    return NextResponse.json(doctors)
  } catch (error) {
    console.error('Error fetching doctors:', error)
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, specialty, department, departmentId, consultationFee, roomNumber, availability } = body

    if (!name || !specialty || !department) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newDoctor: Doctor = {
      id: `doc-${Date.now()}`,
      name,
      specialty,
      department,
      departmentId: departmentId || '',
      consultationFee: consultationFee || 150,
      roomNumber: roomNumber || 'TBD',
      availability: availability || {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      }
    }

    await addDoctor(newDoctor)

    return NextResponse.json({ success: true, doctor: newDoctor })
  } catch (error) {
    console.error('Error adding doctor:', error)
    return NextResponse.json({ error: 'Failed to add doctor' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const doctors = await getDoctors()
    const doctor = doctors.find(d => d.id === id)

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    await updateDoctor(id, updates)

    return NextResponse.json({ success: true, doctor: { ...doctor, ...updates } })
  } catch (error) {
    console.error('Error updating doctor:', error)
    return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 })
    }

    const doctors = await getDoctors()
    const doctor = doctors.find(d => d.id === id)

    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    await deleteDoctor(id)

    return NextResponse.json({ success: true, deleted: doctor })
  } catch (error) {
    console.error('Error deleting doctor:', error)
    return NextResponse.json({ error: 'Failed to delete doctor' }, { status: 500 })
  }
}
