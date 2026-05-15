'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Clock, Calendar, Activity, Microscope, CheckCircle2, Check } from 'lucide-react'
import { usePatient } from '@/lib/patient-context'

interface Service {
  id: string
  name: string
  department: string
  duration: number
  basePrice: number
}

interface Doctor {
  id: string
  name: string
  department: string
}

interface DiagnosticBookingProps {
  initialType: 'blood_test' | 'xray'
  initialEmail?: string
  onClose: () => void
  onSuccess: (appointment: { doctorName: string; date: string; time: string; service: string }) => void
}

export function DiagnosticBooking({
  initialType,
  initialEmail,
  onClose,
  onSuccess
}: DiagnosticBookingProps) {
  const { patient } = usePatient()
  const [type, setType] = useState<'blood_test' | 'xray'>(initialType)
  const [services, setServices] = useState<Service[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  
  const [formData, setFormData] = useState({
    patientName: patient?.name || '',
    patientPhone: patient?.phone || '',
    patientEmail: patient?.email || initialEmail || ''
  })
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [currentSlots, setCurrentSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetchingSlots, setIsFetchingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'now' | 'later'>('now')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // Sync patient data into formData if it loads after mount
  useEffect(() => {
    setFormData(prev => ({
      patientName: patient?.name || prev.patientName,
      patientPhone: patient?.phone || prev.patientPhone,
      patientEmail: patient?.email || prev.patientEmail || initialEmail || ''
    }))
  }, [patient, initialEmail])

  const departmentKeywords = type === 'blood_test' ? ['blood testing', 'blood test', 'pathology'] : ['x-ray', 'xray', 'imaging', 'radiology']
  
  const relevantServices = services.filter(s => {
    const dept = (s.department || '').toLowerCase()
    return departmentKeywords.some(kw => dept.includes(kw))
  })
  const relevantDoctor = doctors.find(d => {
    const dept = (d.department || '').toLowerCase()
    return departmentKeywords.some(kw => dept.includes(kw))
  })

  // Computed values for selected tests
  const selectedServices = relevantServices.filter(s => selectedServiceIds.has(s.id))
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.basePrice, 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)
  const combinedServiceName = selectedServices.map(s => s.name).join(' + ')

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/services').then(r => r.json()),
      fetch('/api/doctors').then(r => r.json())
    ]).then(([servicesData, doctorsData]) => {
      setServices(servicesData || [])
      setDoctors(doctorsData || [])
    }).catch(err => {
      console.error(err)
      setError('Failed to load services and doctors.')
    })
  }, [])

  // Reset selection if type changes
  useEffect(() => {
    setSelectedServiceIds(new Set())
    setSelectedDate('')
    setSelectedSlot(null)
    setCurrentSlots([])
  }, [type])

  // Fetch slots when date changes or doctor changes
  useEffect(() => {
    if (!selectedDate || !relevantDoctor) {
      setCurrentSlots([])
      setSelectedSlot(null)
      return
    }

    setIsFetchingSlots(true)
    setError(null)
    
    fetch(`/api/appointments?doctorId=${encodeURIComponent(relevantDoctor.id)}&doctorName=${encodeURIComponent(relevantDoctor.name)}&date=${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        if (data.availableSlots !== undefined) {
          const now = new Date()
          const [year, month, day] = selectedDate.split('-').map(Number)
          
          const filteredSlots = (data.availableSlots || []).filter((slotStr: string) => {
            let h: number, m: number;
            const matchAMPM = slotStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
            if (matchAMPM) {
              h = parseInt(matchAMPM[1], 10)
              m = parseInt(matchAMPM[2], 10)
              const ampm = matchAMPM[3].toUpperCase()
              if (ampm === 'PM' && h < 12) h += 12
              if (ampm === 'AM' && h === 12) h = 0
            } else {
              const match24 = slotStr.match(/(\d{1,2}):(\d{2})/)
              if (match24) {
                h = parseInt(match24[1], 10)
                m = parseInt(match24[2], 10)
              } else {
                return true
              }
            }
          
            const slotDate = new Date(year, month - 1, day, h, m)
            return slotDate > now
          })
          setCurrentSlots(filteredSlots)
        } else {
          setError(data.error || 'Failed to fetch slots for this date')
          setCurrentSlots([])
        }
      })
      .catch(err => {
        console.error(err)
        setError('Could not fetch available slots')
        setCurrentSlots([])
      })
      .finally(() => setIsFetchingSlots(false))
  }, [selectedDate, relevantDoctor])

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !relevantDoctor || selectedServiceIds.size === 0) return

    setIsSubmitting(true)
    setError(null)
    
    const pName = patient?.name || formData.patientName
    const pPhone = patient?.phone || formData.patientPhone
    const pEmail = patient?.email || formData.patientEmail
    const pUid = patient?.uid

    if (!pName || (!pPhone && !pEmail && !pUid)) {
      setError('Please provide your name and at least one contact method (email or phone).')
      setIsSubmitting(false)
      return
    }

    // Parse time — support both "HH:MM" (24h) and "H:MM AM/PM" (12h) formats
    let formattedTime = selectedSlot.trim()
    const ampmParts = formattedTime.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
    const hhmm = formattedTime.match(/^(\d{2}):(\d{2})$/)
    
    if (ampmParts) {
      let h = parseInt(ampmParts[1], 10)
      const m = ampmParts[2]
      const ampm = ampmParts[3].toUpperCase()
      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      formattedTime = `${h.toString().padStart(2, '0')}:${m}`
    } else if (hhmm) {
      formattedTime = hhmm[0] // already in HH:MM
    } else {
      setError('Invalid time format selected. Please try another slot.')
      setIsSubmitting(false)
      return
    }

    try {
      if (paymentMethod === 'now') {
        setIsProcessingPayment(true)
        await new Promise(r => setTimeout(r, 1500))
        setIsProcessingPayment(false)
      }

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patient?.name || formData.patientName,
          patientPhone: patient?.phone || formData.patientPhone,
          patientEmail: patient?.email || formData.patientEmail,
          patientUid: patient?.uid,
          doctorId: relevantDoctor.id,
          doctorName: relevantDoctor.name,
          date: selectedDate,
          time: formattedTime,
          service: combinedServiceName,
          paymentStatus: paymentMethod === 'now' ? 'paid' : 'unpaid',
          amount: totalPrice
        })
      })

      const data = await response.json()

      if (response.ok) {
        onSuccess({
          doctorName: relevantDoctor.name,
          date: selectedDate,
          time: selectedSlot,
          service: combinedServiceName
        })
      } else {
        setError(data.error || 'Failed to book appointment')
      }
    } catch (err) {
      console.error(err)
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg shadow-xl border-primary/20 my-auto mx-4">
        <CardHeader className="relative pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardTitle className="text-xl">Book Diagnostic Test</CardTitle>
          <CardDescription>Schedule your lab test or imaging appointment.</CardDescription>
          
          <div className="flex gap-2 mt-4 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setType('blood_test')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${type === 'blood_test' ? 'bg-background shadow-sm text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Microscope className="h-4 w-4" /> Blood Test
            </button>
            <button
              onClick={() => setType('xray')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${type === 'xray' ? 'bg-background shadow-sm text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Activity className="h-4 w-4" /> X-Ray / Imaging
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {/* Multi-select test list */}
              <div className="space-y-2">
                <Label>Select {type === 'blood_test' ? 'Tests' : 'Scans'} <span className="text-muted-foreground font-normal">(select one or more)</span></Label>
                <div className="border border-input rounded-lg divide-y divide-border max-h-52 overflow-y-auto">
                  {relevantServices.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading services...</div>
                  ) : (
                    relevantServices.map(s => {
                      const isSelected = selectedServiceIds.has(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50 ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <div className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              <span>₹{s.basePrice}</span>
                              {type !== 'blood_test' && (
                                <>
                                  <span>·</span>
                                  <span>{s.duration} min</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Selection summary */}
                {selectedServices.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedServices.map(s => (
                        <Badge
                          key={s.id}
                          variant="secondary"
                          className="gap-1 pr-1.5 text-xs"
                        >
                          {s.name.length > 20 ? s.name.slice(0, 20) + '…' : s.name}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleService(s.id) }}
                            className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                      <span className="font-semibold text-foreground">₹{totalPrice}</span>
                      {type !== 'blood_test' && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> ~{totalDuration} min
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {selectedDate && (
                <div className="space-y-2">
                  <Label>Available Times</Label>
                  {isFetchingSlots ? (
                    <div className="text-sm text-muted-foreground py-2">Loading available slots...</div>
                  ) : currentSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                      {currentSlots.map(slot => (
                        <Badge
                          key={slot}
                          variant={selectedSlot === slot ? 'default' : 'outline'}
                          className={`justify-center py-1.5 cursor-pointer hover:bg-primary/10 ${selectedSlot === slot ? 'bg-primary hover:bg-primary/90' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-destructive py-2 p-3 bg-destructive/10 rounded-md">
                      No slots available on this date. Please try another date.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Patient Name</Label>
                  <Input
                    id="patientName"
                    required
                    value={formData.patientName}
                    onChange={e => setFormData({ ...formData, patientName: e.target.value })}
                    placeholder="John Doe"
                    readOnly={!!patient?.name}
                    className={patient?.name ? 'bg-muted' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+91..."
                    value={formData.patientPhone}
                    onChange={e => setFormData({ ...formData, patientPhone: e.target.value })}
                    readOnly={!!patient?.phone}
                    className={patient?.phone ? 'bg-muted' : ''}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.patientEmail}
                  onChange={e => setFormData({ ...formData, patientEmail: e.target.value })}
                  readOnly={!!patient?.email}
                  className={patient?.email ? 'bg-muted' : ''}
                />
              </div>
            </div>

            {/* Payment Selection */}
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="font-medium text-sm">Payment Details</h4>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Total</span>
                <span className="font-semibold tracking-tight">₹{totalPrice}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('now')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === 'now' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-transparent bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  <span className="font-medium text-sm">Pay Now</span>
                  <span className="text-xs opacity-80 mt-1">Simulated Gateway</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('later')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === 'later' 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-transparent bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  <span className="font-medium text-sm">Pay at Hospital</span>
                  <span className="text-xs opacity-80 mt-1">Cash or Card</span>
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full gap-2"
              disabled={!selectedDate || !selectedSlot || selectedServiceIds.size === 0 || isSubmitting || isProcessingPayment}
            >
              {(isSubmitting || isProcessingPayment) ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  {isProcessingPayment ? 'Processing Payment...' : 'Booking...'}
                </span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {paymentMethod === 'now'
                    ? `Confirm & Pay ₹${totalPrice}`
                    : selectedServices.length > 1
                      ? `Confirm ${selectedServices.length} Tests`
                      : 'Confirm Booking'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
