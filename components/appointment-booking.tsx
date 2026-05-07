'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { X, Clock, Calendar, ListPlus, CheckCircle2, AlertTriangle } from 'lucide-react'

interface AppointmentBookingProps {
  doctorId: string
  doctorName: string
  date: string
  availableSlots: string[]
  bookedSlots?: string[]
  onClose: () => void
  onSuccess: (appointment: { doctorName: string; date: string; time: string }) => void
  initialEmail?: string
}

export function AppointmentBooking({
  doctorId,
  doctorName,
  date,
  availableSlots,
  bookedSlots = [],
  onClose,
  onSuccess,
  initialEmail
}: AppointmentBookingProps) {
  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: initialEmail || ''
  })
  const [selectedDate, setSelectedDate] = useState<string>(date)
  const [currentSlots, setCurrentSlots] = useState<string[]>(availableSlots)
  const [currentBookedSlots, setCurrentBookedSlots] = useState<string[]>(bookedSlots)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetchingSlots, setIsFetchingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Waitlist state
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false)
  const [waitlistInfo, setWaitlistInfo] = useState<{ count: number; isFull: boolean; maxAllowed: number } | null>(null)
  const [conflictSlot, setConflictSlot] = useState<string | null>(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState<string | null>(null)
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false)

  // On mount: always re-fetch real slots for the initial date so booked slots show immediately
  useEffect(() => {
    if (!date) return
    setIsFetchingSlots(true)
    fetch(`/api/appointments?doctorId=${encodeURIComponent(doctorId)}&doctorName=${encodeURIComponent(doctorName)}&date=${date}`)
      .then(r => r.json())
      .then(data => {
        if (data.availableSlots !== undefined) {
          setCurrentSlots(data.availableSlots || [])
          setCurrentBookedSlots(data.bookedSlots || [])
        }
      })
      .catch(() => {})
      .finally(() => setIsFetchingSlots(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    setSelectedDate(newDate)
    setSelectedSlot(null)
    setIsFetchingSlots(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/appointments?doctorId=${doctorId}&doctorName=${encodeURIComponent(doctorName)}&date=${newDate}`)
      const data = await response.json()
      
      if (response.ok) {
        setCurrentSlots(data.availableSlots || [])
        setCurrentBookedSlots(data.bookedSlots || [])
      } else {
        setError(data.error || 'Failed to fetch slots for this date')
        setCurrentSlots([])
        setCurrentBookedSlots([])
      }
    } catch (err) {
      console.error(err)
      setError('Could not fetch available slots')
      setCurrentSlots([])
      setCurrentBookedSlots([])
    } finally {
      setIsFetchingSlots(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return
    
    setIsSubmitting(true)
    setError(null)

    // Convert "9:00 AM" → "09:00" for the backend
    const timeParts = selectedSlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
    let formattedTime = selectedSlot
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10)
      const minutes = timeParts[2]
      const ampm = timeParts[3].toUpperCase()
      if (ampm === 'PM' && hours < 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0
      formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`
    }

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          doctorId,
          doctorName,
          date: selectedDate,
          time: formattedTime,
          service: 'General Consultation'
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess({ doctorName, date: selectedDate, time: selectedSlot })
        return
      }

      // Slot already booked → show waitlist prompt
      if (response.status === 409) {
        setConflictSlot(formattedTime)
        const wlRes = await fetch(`/api/appointments/waitlist?doctorId=${doctorId}&date=${selectedDate}&time=${formattedTime}`)
        const wlData = await wlRes.json()
        setWaitlistInfo(wlData)
        setShowWaitlistPrompt(true)
        return
      }

      setError(data.error || 'Failed to book appointment')
    } catch (error) {
      console.error('Error booking appointment:', error)
      setError('An error occurred while booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // When user clicks a booked slot badge directly — skip form submit, go straight to waitlist
  const handleClickBookedSlot = async (displaySlot: string) => {
    setError(null)
    // Convert display time e.g. "11:00 AM" to HH:mm
    const tp = displaySlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
    let hhmm = displaySlot
    if (tp) {
      let h = parseInt(tp[1], 10)
      const m = tp[2]; const ampm = tp[3].toUpperCase()
      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      hhmm = `${h.toString().padStart(2, '0')}:${m}`
    }
    setConflictSlot(hhmm)
    // Fetch current waitlist count
    const wlRes = await fetch(`/api/appointments/waitlist?doctorId=${doctorId}&doctorName=${encodeURIComponent(doctorName)}&date=${selectedDate}&time=${hhmm}`)
    const wlData = await wlRes.json()
    setWaitlistInfo(wlData)
    setShowWaitlistPrompt(true)
  }

  const handleJoinWaitlist = async () => {
    if (!conflictSlot) return
    if (!formData.patientName || !formData.patientPhone || !formData.patientEmail) {
      setError('Please fill in all fields before joining the waiting list.')
      setShowWaitlistPrompt(false)
      return
    }

    setIsJoiningWaitlist(true)
    try {
      const res = await fetch('/api/appointments/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          doctorName,
          date: selectedDate,
          time: conflictSlot,
          ...formData,
          service: 'General Consultation',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.slotNowFree) {
          // Slot freed up between the popup and join — close popup, re-fetch slots
          setShowWaitlistPrompt(false)
          setWaitlistSuccess('🎉 Great news! This slot just became available. Select it and book directly!')
        } else {
          setWaitlistSuccess(data.message)
          setShowWaitlistPrompt(false)
        }
      } else {
        setError(data.error || 'Could not join waiting list.')
        setShowWaitlistPrompt(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setShowWaitlistPrompt(false)
    } finally {
      setIsJoiningWaitlist(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">

      {/* Waitlist confirmation popup */}
      {showWaitlistPrompt && waitlistInfo && (
        <Card className="w-full max-w-sm z-60 border-yellow-500/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Slot Already Booked
            </CardTitle>
            <CardDescription>
              This time slot with <strong>{doctorName}</strong> is already taken.
              {waitlistInfo.isFull
                ? ` The waiting list is full (${waitlistInfo.count}/${waitlistInfo.maxAllowed}).`
                : ` There ${waitlistInfo.count === 0 ? 'are no others' : `is ${waitlistInfo.count}`} waiting. Would you like to join the waiting list? (${waitlistInfo.count + 1}/${waitlistInfo.maxAllowed})`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowWaitlistPrompt(false)}>
              Choose Another
            </Button>
            {!waitlistInfo.isFull && (
              <Button
                className="flex-1 gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                onClick={handleJoinWaitlist}
                disabled={isJoiningWaitlist}
              >
                <ListPlus className="h-4 w-4" />
                {isJoiningWaitlist ? 'Joining...' : 'Join Waitlist'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Waitlist success */}
      {waitlistSuccess && (
        <Card className="w-full max-w-sm z-60 border-green-500/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Added to Waiting List!</p>
                <p className="text-sm text-muted-foreground mt-1">{waitlistSuccess}</p>
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </CardContent>
        </Card>
      )}

      {!showWaitlistPrompt && !waitlistSuccess && (
        <Card className="w-full max-w-md">
          <CardHeader className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardTitle>Book Appointment</CardTitle>
            <CardDescription>
              Schedule an appointment with {doctorName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-900 border border-red-200 rounded-md text-sm font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentDate">Select Date *</Label>
                <Input 
                  id="appointmentDate"
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={handleDateChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Select Time Slot *</Label>
                <div className="flex flex-wrap gap-2">
                  {isFetchingSlots ? (
                    <p className="text-sm text-muted-foreground">Loading slots...</p>
                  ) : (
                    <>
                      {currentSlots.map((slot) => (
                        <Badge
                          key={slot}
                          variant={selectedSlot === slot ? 'default' : 'outline'}
                          className="cursor-pointer gap-1 px-3 py-1.5"
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <Clock className="h-3 w-3" /> {slot}
                        </Badge>
                      ))}
                      {currentBookedSlots.map((slot) => (
                        <Badge
                          key={`booked-${slot}`}
                          variant="outline"
                          className="cursor-pointer gap-1 px-3 py-1.5 border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                          onClick={() => handleClickBookedSlot(slot)}
                          title="Slot is full — click to join the waitlist"
                        >
                          <Clock className="h-3 w-3" /> {slot}
                          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded px-1">Full</span>
                        </Badge>
                      ))}
                      {currentSlots.length === 0 && currentBookedSlots.length === 0 && (
                        <p className="text-sm text-muted-foreground">No slots available on this date.</p>
                      )}
                      {currentSlots.length === 0 && currentBookedSlots.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 w-full">All slots are booked. Click an orange slot to join its waitlist.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientName">Full Name *</Label>
                <Input
                  id="patientName"
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="patientPhone">Phone Number *</Label>
                <Input
                  id="patientPhone"
                  type="tel"
                  required
                  value={formData.patientPhone}
                  onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="patientEmail">Email</Label>
                <Input
                  id="patientEmail"
                  type="email"
                  value={formData.patientEmail}
                  onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || !selectedSlot}>
                  {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
