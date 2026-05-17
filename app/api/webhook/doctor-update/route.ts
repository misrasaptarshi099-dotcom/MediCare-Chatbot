import { NextResponse } from 'next/server'
import { getDoctors, addDoctor, updateDoctor, type Doctor } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhookSecret !== process.env.DOCTOR_UPDATE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, doctor } = body

    const doctors = await getDoctors()

    if (action === 'update') {
      const existing = doctors.find(d => d.id === doctor.id)

      if (existing) {
        // Update existing doctor
        await updateDoctor(doctor.id, doctor)
        return NextResponse.json({
          success: true,
          message: `Updated doctor: ${doctor.name}`,
          doctor,
        })
      } else {
        // Add new doctor
        await addDoctor(doctor)
        return NextResponse.json({
          success: true,
          message: `Added new doctor: ${doctor.name}`,
          doctor,
        })
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Doctor update webhook error:', error)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
