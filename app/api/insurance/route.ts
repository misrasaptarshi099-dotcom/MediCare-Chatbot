export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import {
  getInsurancePartners,
  addInsurance,
  updateInsurance,
  deleteInsurance,
  type Insurance,
} from '@/lib/db'

export async function GET() {
  try {
    const insurancePartners = await getInsurancePartners()
    return NextResponse.json({ insurancePartners })
  } catch (error) {
    console.error('Error fetching insurance:', error)
    return NextResponse.json({ error: 'Failed to fetch insurance data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, proceduresCovered, coveragePercentage, networkType, contactNumber } = body

    if (!name || !proceduresCovered || !coveragePercentage || !networkType || !contactNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newInsurance: Insurance = {
      id: `ins-${Date.now()}`,
      name,
      proceduresCovered,
      coveragePercentage,
      networkType,
      contactNumber,
    }

    await addInsurance(newInsurance)

    return NextResponse.json({ success: true, insurance: newInsurance })
  } catch (error) {
    console.error('Error adding insurance:', error)
    return NextResponse.json({ error: 'Failed to add insurance' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Insurance ID is required' }, { status: 400 })
    }

    const partners = await getInsurancePartners()
    const existing = partners.find(p => p.id === id)
    if (!existing) {
      return NextResponse.json({ error: 'Insurance partner not found' }, { status: 404 })
    }

    await updateInsurance(id, updates)

    return NextResponse.json({ success: true, insurance: { ...existing, ...updates } })
  } catch (error) {
    console.error('Error updating insurance:', error)
    return NextResponse.json({ error: 'Failed to update insurance' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Insurance ID is required' }, { status: 400 })
    }

    const partners = await getInsurancePartners()
    const existing = partners.find(p => p.id === id)
    if (!existing) {
      return NextResponse.json({ error: 'Insurance partner not found' }, { status: 404 })
    }

    await deleteInsurance(id)

    return NextResponse.json({ success: true, deleted: existing })
  } catch (error) {
    console.error('Error deleting insurance:', error)
    return NextResponse.json({ error: 'Failed to delete insurance' }, { status: 500 })
  }
}
