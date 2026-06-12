'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, User, Phone, Mail, CheckCircle2, XCircle, AlertCircle, ListOrdered } from 'lucide-react'
import Link from 'next/link'

interface Appointment {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  service: string
  status: 'scheduled' | 'completed' | 'cancelled'
  paymentStatus?: 'paid' | 'unpaid' | 'refunded'
  amount?: number
  createdAt: string
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null)

  // Pagination State
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'info' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  // Reset pagination when filter changes
  useEffect(() => {
    setCursorStack([])
    setNextCursor(null)
    fetchAppointments()
  }, [filter])

  const fetchAppointments = async (cursor?: string) => {
    const url = new URL('/api/admin/appointments', window.location.origin)
    if (cursor) url.searchParams.set('cursor', cursor)
    if (filter !== 'all') url.searchParams.set('status', filter)
    const res = await fetch(url.toString())
    const data = await res.json()
    setAppointments(data.appointments || [])
    setNextCursor(data.nextCursor || null)
  }

  const updateStatus = async (id: string, status: 'completed' | 'cancelled') => {
    const res = await fetch('/api/admin/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    const data = await res.json()
    if (res.ok && data.promoted) {
      showToast(
        `✓ Cancelled. ${data.promoted.name} (${data.promoted.email}) was automatically promoted from waitlist!`,
        'success'
      )
    } else if (res.ok) {
      showToast(data.message || 'Status updated.', 'info')
    }
    const currentCursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : undefined
    fetchAppointments(currentCursor)
  }

  // When a status filter is active, the server already returns only matching results.
  // When 'all', we still need to show everything (no client-side filter needed).
  const filteredAppointments = filter === 'all'
    ? appointments
    : appointments.filter(apt => apt.status === filter)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="gap-1 bg-primary"><Clock className="h-3 w-3" /> Scheduled</Badge>
      case 'completed':
        return <Badge className="gap-1 bg-accent"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const categorizeApt = (service: string) => {
    const s = service.toLowerCase()
    if (s.includes('x-ray') || s.includes('xray') || s.includes('scan') || s.includes('mri') || s.includes('ultrasound')) {
      return 'xray'
    }
    if (s.includes('blood') || s.includes('panel') || s.includes('cbc') || s.includes('lft') || s.includes('kft') || s.includes('tft')) {
      return 'blood'
    }
    return 'general'
  }

  // Get tomorrow's appointments for preparation checklist
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const tomorrowAppointments = appointments.filter(apt => apt.date === tomorrowStr && apt.status === 'scheduled')

  const renderTable = (categoryApts: Appointment[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryApts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No appointments found
                </TableCell>
              </TableRow>
            ) : (
              categoryApts.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{apt.patientName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{apt.doctorName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{apt.date}</span>
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      <span>{apt.time}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {apt.patientPhone}
                      </div>
                      {apt.patientEmail && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {apt.patientEmail}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {(apt as any).amount != null && (
                        <span className="text-xs font-medium">₹{(apt as any).amount}</span>
                      )}
                      <Badge className={`w-fit text-xs border ${
                        (apt as any).paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : (apt as any).paymentStatus === 'refunded'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                      }`}>
                        {(apt as any).paymentStatus === 'paid' ? '✓ Paid' : (apt as any).paymentStatus === 'refunded' ? '↩ Refunded' : '⏳ Unpaid'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(apt.status)}</TableCell>
                  <TableCell className="text-right">
                    {apt.status === 'scheduled' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(apt.id, 'completed')}
                        >
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(apt.id, 'cancelled')}
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Waitlist promotion toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-start gap-2 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            <ListOrdered className="h-4 w-4 shrink-0 mt-0.5" />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
        <p className="text-muted-foreground">View and manage patient appointments</p>
      </div>

      {/* Tomorrow's Appointments Alert */}
      {tomorrowAppointments.length > 0 && (
        <Card className="border-accent bg-accent/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground">Appointments Tomorrow</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {tomorrowAppointments.length} patient(s) scheduled for tomorrow. Preparation reminders:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Remind patients to bring insurance cards and ID</li>
                  <li>Check for any fasting requirements</li>
                  <li>Confirm parking availability</li>
                  <li>Ensure required documents are ready</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        {(['all', 'scheduled', 'completed', 'cancelled'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="blood">Blood Tests</TabsTrigger>
          <TabsTrigger value="xray">X-Ray & Imaging</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          {renderTable(filteredAppointments.filter(apt => categorizeApt(apt.service) === 'general'))}
        </TabsContent>
        <TabsContent value="blood">
          {renderTable(filteredAppointments.filter(apt => categorizeApt(apt.service) === 'blood'))}
        </TabsContent>
        <TabsContent value="xray">
          {renderTable(filteredAppointments.filter(apt => categorizeApt(apt.service) === 'xray'))}
        </TabsContent>
      </Tabs>

      {/* Pagination Controls */}
      {(appointments.length > 0 || cursorStack.length > 0) && (
        <div className="flex items-center justify-between py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newStack = [...cursorStack]
              newStack.pop()
              const prevCursor = newStack[newStack.length - 1] || undefined
              setCursorStack(newStack)
              fetchAppointments(prevCursor)
            }}
            disabled={cursorStack.length === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {cursorStack.length + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (nextCursor) {
                setCursorStack([...cursorStack, nextCursor])
                fetchAppointments(nextCursor)
              }
            }}
            disabled={!nextCursor}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
