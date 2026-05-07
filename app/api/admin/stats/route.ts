import { NextResponse } from 'next/server'
import { getAllAppointments, type Appointment } from '@/lib/db'

export async function GET() {
  try {
    const appointments = await getAllAppointments()
    
    const sortedAppointments = [...appointments].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      appointmentCount: appointments.length,
      recentAppointments: sortedAppointments.slice(0, 5).map(apt => ({
        id: apt.id,
        patientName: apt.patientName,
        doctorName: apt.doctorName,
        date: apt.date,
        time: apt.time
      }))
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ appointmentCount: 0, recentAppointments: [] })
  }
}
