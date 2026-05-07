'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, MessageSquare, Phone, TrendingUp, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  doctorCount: number
  appointmentCount: number
  pendingCallbacks: number
  unansweredQueries: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    doctorCount: 0,
    appointmentCount: 0,
    pendingCallbacks: 0,
    unansweredQueries: 0
  })
  const [recentAppointments, setRecentAppointments] = useState<Array<{
    id: string
    patientName: string
    doctorName: string
    date: string
    time: string
  }>>([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [doctors, appointments, escalation] = await Promise.all([
        fetch('/api/doctors').then(r => r.json()),
        fetch('/api/appointments?doctorId=all&date=all').then(r => r.json()).catch(() => ({ appointments: [] })),
        fetch('/api/escalation').then(r => r.json())
      ])

      // Get appointments from a workaround since we need to read the file directly
      const appointmentsData = await fetch('/api/admin/stats').then(r => r.json()).catch(() => ({ appointments: [] }))

      setStats({
        doctorCount: Array.isArray(doctors) ? doctors.length : 0,
        appointmentCount: appointmentsData.appointmentCount || 0,
        pendingCallbacks: escalation.tickets?.filter((t: { status: string }) => t.status === 'pending').length || 0,
        unansweredQueries: escalation.queries?.length || 0
      })

      setRecentAppointments(appointmentsData.recentAppointments || [])
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const statCards = [
    { title: 'Total Doctors', value: stats.doctorCount, icon: Users, color: 'text-primary', href: '/admin/doctors' },
    { title: 'Appointments', value: stats.appointmentCount, icon: Calendar, color: 'text-accent', href: '/admin/appointments' },
    { title: 'Pending Callbacks', value: stats.pendingCallbacks, icon: Phone, color: 'text-chart-5', href: '/admin/callbacks' },
    { title: 'Unanswered Queries', value: stats.unansweredQueries, icon: MessageSquare, color: 'text-destructive', href: '/admin/queries' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground">Welcome to MediCare Admin Panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAppointments.length > 0 ? (
              <div className="space-y-3">
                {recentAppointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{apt.patientName}</p>
                      <p className="text-sm text-muted-foreground">with {apt.doctorName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{apt.date}</p>
                      <p className="text-sm text-muted-foreground">{apt.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No recent appointments</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/doctors" className="block">
              <div className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <p className="font-medium text-foreground">Manage Doctors</p>
                <p className="text-sm text-muted-foreground">Add, edit, or remove doctors</p>
              </div>
            </Link>
            <Link href="/admin/callbacks" className="block">
              <div className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <p className="font-medium text-foreground">Review Callbacks</p>
                <p className="text-sm text-muted-foreground">Handle pending callback requests</p>
              </div>
            </Link>
            <Link href="/admin/insurance" className="block">
              <div className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <p className="font-medium text-foreground">Update Insurance</p>
                <p className="text-sm text-muted-foreground">Manage insurance partners</p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
