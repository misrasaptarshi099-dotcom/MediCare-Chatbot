'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Bell, Send, RefreshCw, Calendar, User, Clock, Mail, CheckCircle2, XCircle, AlertTriangle, Play } from 'lucide-react'

type Appointment = {
  id: string
  patientName: string
  patientEmail: string
  doctorName: string
  date: string
  time: string
  service: string
  status: string
}

type SendResult = {
  appointmentId: string
  email: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
}

export default function RemindersPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filterDate, setFilterDate] = useState(getTomorrow())
  const [isLoading, setIsLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'sent' | 'failed'>>({})
  const [cronResult, setCronResult] = useState<string | null>(null)
  const [isRunningCron, setIsRunningCron] = useState(false)

  function getTomorrow(): string {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      params.set('status', 'scheduled')
      const res = await fetch(`/api/admin/appointments?${params}`)
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      setAppointments([])
    } finally {
      setIsLoading(false)
    }
  }, [filterDate])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const sendSingle = async (apt: Appointment) => {
    setSendingId(apt.id)
    try {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: apt.id }),
      })
      const data = await res.json()
      const r = data.results?.[0]
      setResults(prev => ({ ...prev, [apt.id]: r?.status === 'sent' ? 'sent' : 'failed' }))
    } catch {
      setResults(prev => ({ ...prev, [apt.id]: 'failed' }))
    } finally {
      setSendingId(null)
    }
  }

  const sendAll = async () => {
    setSendingId('all')
    try {
      const res = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: filterDate }),
      })
      const data = await res.json()
      const newResults: Record<string, 'sent' | 'failed'> = {}
      for (const r of (data.results || [])) {
        newResults[r.appointmentId] = r.status
      }
      setResults(prev => ({ ...prev, ...newResults }))
      setCronResult(`Sent ${data.sent}/${data.total} reminders for ${filterDate}`)
    } catch {
      setCronResult('Failed to send reminders')
    } finally {
      setSendingId(null)
    }
  }

  const runAutoCron = async () => {
    setIsRunningCron(true)
    setCronResult(null)
    try {
      const res = await fetch('/api/cron/appointment-reminders', {
        headers: {
          'authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'medicare-cron-2026'}`,
          'x-admin-call': '1',
        },
      })
      const data = await res.json()
      setCronResult(`Auto-cron ran: ${data.results?.filter((r: SendResult) => r.status === 'sent').length || 0} sent, ${data.results?.filter((r: SendResult) => r.status === 'skipped').length || 0} already sent, for ${data.date}`)
    } catch {
      setCronResult('Cron failed')
    } finally {
      setIsRunningCron(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Appointment Reminders
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Send preparation checklists to patients before their appointments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAppointments} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Auto-cron card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Automatic Nightly Reminder
          </CardTitle>
          <CardDescription>
            Runs automatically every evening at 6 PM to email patients with appointments the next day.
            Click below to run it manually right now.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button onClick={runAutoCron} disabled={isRunningCron} className="gap-2">
            <Play className={`h-4 w-4 ${isRunningCron ? 'animate-pulse' : ''}`} />
            {isRunningCron ? 'Running…' : "Run Tonight's Cron Now"}
          </Button>
          {cronResult && (
            <span className="text-sm text-muted-foreground">{cronResult}</span>
          )}
        </CardContent>
      </Card>

      {/* Date filter + Send All */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Manual Push — Filter by Date
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-center flex-wrap">
            <Input
              type="date"
              value={filterDate}
              min={today}
              onChange={e => setFilterDate(e.target.value)}
              className="w-44"
            />
            <Button variant="outline" onClick={() => setFilterDate(getTomorrow())} size="sm">
              Tomorrow
            </Button>
            <Button
              onClick={sendAll}
              disabled={sendingId === 'all' || appointments.length === 0}
              className="gap-2 ml-auto"
            >
              <Send className="h-4 w-4" />
              {sendingId === 'all' ? 'Sending…' : `Send All (${appointments.length})`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointment list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading appointments…</div>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No scheduled appointments found for {filterDate || 'the selected date'}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map(apt => {
            const result = results[apt.id]
            return (
              <Card key={apt.id} className={`transition-colors ${result === 'sent' ? 'border-green-500/30 bg-green-500/5' : result === 'failed' ? 'border-red-500/30 bg-red-500/5' : ''}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{apt.patientName}</span>
                        <Badge variant="outline" className="text-xs">{apt.service || 'Consultation'}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />{apt.doctorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />{apt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />{apt.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[200px]">{apt.patientEmail || <span className="text-destructive">No email</span>}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result === 'sent' && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Sent
                        </span>
                      )}
                      {result === 'failed' && (
                        <span className="flex items-center gap-1 text-destructive text-sm font-medium">
                          <XCircle className="h-4 w-4" /> Failed
                        </span>
                      )}
                      {!apt.patientEmail && (
                        <span className="flex items-center gap-1 text-amber-600 text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" /> No email
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant={result === 'sent' ? 'outline' : 'default'}
                        disabled={sendingId === apt.id || sendingId === 'all' || !apt.patientEmail}
                        onClick={() => sendSingle(apt)}
                        className="gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingId === apt.id ? 'Sending…' : result === 'sent' ? 'Resend' : 'Send Reminder'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
