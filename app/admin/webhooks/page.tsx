'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Webhook, Send, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react'

interface WebhookLog {
  id: string
  type: string
  payload: Record<string, unknown>
  status: 'success' | 'error'
  timestamp: string
  response?: string
}

interface Doctor {
  id: string
  name: string
  specialty: string
  department: string
  available: boolean
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function WebhooksPage() {
  const { data: doctorsData } = useSWR<{ doctors: Doctor[] }>('/api/doctors', fetcher)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Doctor Update Form
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'unavailable'>('available')
  const [reason, setReason] = useState('')

  // Custom Webhook Form
  const [webhookType, setWebhookType] = useState('doctor_schedule_update')
  const [customPayload, setCustomPayload] = useState('')

  const doctors = doctorsData?.doctors || []

  const simulateDoctorUpdate = async () => {
    if (!selectedDoctor) return
    
    setIsSubmitting(true)
    const doctor = doctors.find(d => d.id === selectedDoctor)
    
    const payload = {
      doctorId: selectedDoctor,
      doctorName: doctor?.name,
      available: availabilityStatus === 'available',
      reason: reason || (availabilityStatus === 'available' ? 'Back on duty' : 'Emergency leave'),
      timestamp: new Date().toISOString()
    }

    try {
      const response = await fetch('/api/webhook/doctor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      
      const log: WebhookLog = {
        id: `log-${Date.now()}`,
        type: 'doctor_availability_update',
        payload,
        status: response.ok ? 'success' : 'error',
        timestamp: new Date().toISOString(),
        response: JSON.stringify(data, null, 2)
      }

      setLogs(prev => [log, ...prev])
      
      if (response.ok) {
        // Refresh doctors data
        mutate('/api/doctors')
        setReason('')
      }
    } catch (error) {
      const log: WebhookLog = {
        id: `log-${Date.now()}`,
        type: 'doctor_availability_update',
        payload,
        status: 'error',
        timestamp: new Date().toISOString(),
        response: String(error)
      }
      setLogs(prev => [log, ...prev])
    } finally {
      setIsSubmitting(false)
    }
  }

  const simulateCustomWebhook = async () => {
    setIsSubmitting(true)
    
    let payload: Record<string, unknown>
    try {
      payload = customPayload ? JSON.parse(customPayload) : { test: true, timestamp: new Date().toISOString() }
    } catch {
      payload = { raw: customPayload, timestamp: new Date().toISOString() }
    }

    const log: WebhookLog = {
      id: `log-${Date.now()}`,
      type: webhookType,
      payload,
      status: 'success',
      timestamp: new Date().toISOString(),
      response: 'Webhook received and processed successfully'
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    setLogs(prev => [log, ...prev])
    setIsSubmitting(false)
    setCustomPayload('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook Simulation</h1>
        <p className="text-muted-foreground">
          Test external system integrations by simulating incoming webhooks
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Doctor Availability Update */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Doctor Availability Update
            </CardTitle>
            <CardDescription>
              Simulate an external system updating doctor availability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Select Doctor</FieldLabel>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map(doctor => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>New Status</FieldLabel>
                <Select 
                  value={availabilityStatus} 
                  onValueChange={(v) => setAvailabilityStatus(v as 'available' | 'unavailable')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Reason (Optional)</FieldLabel>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={availabilityStatus === 'available' ? 'Back from leave' : 'Emergency leave'}
                />
              </Field>
            </FieldGroup>

            <Button 
              onClick={simulateDoctorUpdate} 
              disabled={!selectedDoctor || isSubmitting}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Webhook
            </Button>
          </CardContent>
        </Card>

        {/* Custom Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Custom Webhook
            </CardTitle>
            <CardDescription>
              Simulate any custom webhook payload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Webhook Type</FieldLabel>
                <Select value={webhookType} onValueChange={setWebhookType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor_schedule_update">Doctor Schedule Update</SelectItem>
                    <SelectItem value="insurance_policy_change">Insurance Policy Change</SelectItem>
                    <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                    <SelectItem value="lab_results_ready">Lab Results Ready</SelectItem>
                    <SelectItem value="emergency_alert">Emergency Alert</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Payload (JSON)</FieldLabel>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  placeholder='{"key": "value"}'
                />
              </Field>
            </FieldGroup>

            <Button 
              onClick={simulateCustomWebhook} 
              disabled={isSubmitting}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Custom Webhook
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Webhook Activity Log
          </CardTitle>
          <CardDescription>
            Recent webhook events and their responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhook activity yet</p>
              <p className="text-sm">Send a webhook to see the logs here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="grid gap-2 text-sm">
                    <div>
                      <span className="font-medium">Payload:</span>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                    {log.response && (
                      <div>
                        <span className="font-medium">Response:</span>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                          {log.response}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
