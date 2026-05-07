'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Mic, Send, Bot, User, Calendar, MapPin, CreditCard, Clock, Stethoscope,
  XCircle, CheckCircle2, RotateCcw, ListChecks, Volume2, VolumeX, PhoneCall,
  Sparkles
} from 'lucide-react'
import { CallbackForm } from './callback-form'
import { AppointmentBooking } from './appointment-booking'
import { AuroraBackground } from './aurora-background'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
  data?: {
    type: string
    results?: Array<{
      type: string
      data: Record<string, unknown>
      message: string
    }>
    needsEscalation?: boolean
    suggestedAction?: string
  }
}

// ── Sample questions ──────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  "Is Dr Mehta available Saturday for knee consultation and does ICICI Lombard cover it?",
  "Which cardiologist is available tomorrow morning?",
  "What are the visiting hours for ICU patients?",
  "Where is the orthopedics department located?",
  "How much is my surgery bill?",
]

// ── Typing Dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/60"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ── Animated Background Blobs — Mouse Parallax ─────────────────────────────
function BackgroundBlobs() {
  // All springs declared at top level — React hooks rules require this
  // Each pair has different stiffness/damping → different speed → parallax depth
  const x0 = useSpring(useMotionValue(0), { stiffness: 40,  damping: 18, mass: 1 })
  const y0 = useSpring(useMotionValue(0), { stiffness: 40,  damping: 18, mass: 1 })
  const x1 = useSpring(useMotionValue(0), { stiffness: 60,  damping: 22, mass: 1 })
  const y1 = useSpring(useMotionValue(0), { stiffness: 60,  damping: 22, mass: 1 })
  const x2 = useSpring(useMotionValue(0), { stiffness: 85,  damping: 26, mass: 1 })
  const y2 = useSpring(useMotionValue(0), { stiffness: 85,  damping: 26, mass: 1 })
  const x3 = useSpring(useMotionValue(0), { stiffness: 115, damping: 30, mass: 1 })
  const y3 = useSpring(useMotionValue(0), { stiffness: 115, damping: 30, mass: 1 })
  const x4 = useSpring(useMotionValue(0), { stiffness: 155, damping: 36, mass: 1 })
  const y4 = useSpring(useMotionValue(0), { stiffness: 155, damping: 36, mass: 1 })

  const springs = [
    { x: x0, y: y0, multiplier: 1.0  },  // slowest — "deepest"
    { x: x1, y: y1, multiplier: 0.7  },
    { x: x2, y: y2, multiplier: 0.5  },
    { x: x3, y: y3, multiplier: 0.35 },
    { x: x4, y: y4, multiplier: 0.2  },  // fastest — "closest"
  ]

  useEffect(() => {
    const MAX = 30 // px — kept small for a premium subtle feel
    function handleMouseMove(e: MouseEvent) {
      const nx = (e.clientX / window.innerWidth  - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      x0.set(nx * MAX * 1.0);  y0.set(ny * MAX * 1.0)
      x1.set(nx * MAX * 0.7);  y1.set(ny * MAX * 0.7)
      x2.set(nx * MAX * 0.5);  y2.set(ny * MAX * 0.5)
      x3.set(nx * MAX * 0.35); y3.set(ny * MAX * 0.35)
      x4.set(nx * MAX * 0.2);  y4.set(ny * MAX * 0.2)
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const BLOBS = [
    { style: { background: 'radial-gradient(circle, #3b82f6 0%, #8b5cf6 60%, transparent 100%)', top: '-15%', left: '-15%', filter: 'blur(90px)', opacity: 0.07, width: 700, height: 700 } },
    { style: { background: 'radial-gradient(circle, #06b6d4 0%, #3b82f6 60%, transparent 100%)', bottom: '-10%', right: '-10%', filter: 'blur(80px)', opacity: 0.07, width: 550, height: 550 } },
    { style: { background: 'radial-gradient(circle, #a855f7 0%, #ec4899 60%, transparent 100%)', top: '35%', left: '45%', filter: 'blur(75px)', opacity: 0.05, width: 450, height: 450 } },
    { style: { background: 'radial-gradient(circle, #10b981 0%, #06b6d4 60%, transparent 100%)', top: '10%', right: '20%', filter: 'blur(70px)', opacity: 0.045, width: 380, height: 380 } },
    { style: { background: 'radial-gradient(circle, #f59e0b 0%, #ef4444 60%, transparent 100%)', bottom: '20%', left: '20%', filter: 'blur(70px)', opacity: 0.04, width: 320, height: 320 } },
  ]

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      {/* Ambient slow-drift base layer */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.04) 0%, transparent 60%)',
        }}
      />
      {/* 5 parallax blob layers — each moves at a different speed */}
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            ...blob.style,
            width: blob.style.width,
            height: blob.style.height,
            x: springs[i].x,
            y: springs[i].y,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ChatInterface({
  initialEmail,
  initialMessages = []
}: {
  initialEmail?: string
  initialMessages?: any[]
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCallback, setShowCallback] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState<{
    id: string; name: string; date: string; slots: string[]
  } | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [manageAction, setManageAction] = useState<{ appointmentId: string; action: 'cancel' | 'reschedule'; doctorId: string; doctorName: string; currentDate: string; currentTime: string } | null>(null)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageSuccess, setManageSuccess] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([])
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState('')
  const [fetchingRescheduleSlots, setFetchingRescheduleSlots] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Web Audio API refs — used to analyse mic volume during STT
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  // TTS pulse interval ref
  const ttsPulseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Web Audio mic analysis for STT aurora sync ───────────────────────────
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        // Normalise: average byte value is typically 0–80 for speech; clamp to 0-1
        setAudioLevel(Math.min(1, avg / 60))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // Fall back to simulated pulse if mic permission denied
      let phase = 0
      const id = setInterval(() => {
        phase = (phase + 1) % 3
        setAudioLevel(phase === 1 ? 0.7 : 0.25)
      }, 300)
      ttsPulseRef.current = id
    }
  }

  const stopAudioAnalysis = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null }
    if (ttsPulseRef.current) { clearInterval(ttsPulseRef.current); ttsPulseRef.current = null }
    setAudioLevel(0)
  }

  // ── speak() — Web Speech API TTS ──────────────────────────────────────────
  function speak(id: string, text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    if (speakingId === id) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      if (ttsPulseRef.current) { clearInterval(ttsPulseRef.current); ttsPulseRef.current = null }
      setAudioLevel(0)
      return
    }
    window.speechSynthesis.cancel()
    const hasDevanagari = /[\u0900-\u097F]/.test(text)
    const hasChinese = /[\u4E00-\u9FFF]/.test(text)
    const hasArabic = /[\u0600-\u06FF]/.test(text)
    let lang = 'en-US'
    if (hasDevanagari) lang = 'hi-IN'
    else if (hasChinese) lang = 'zh-CN'
    else if (hasArabic) lang = 'ar-SA'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1
    utterance.pitch = 1
    // TTS aurora: simulate speech-rhythm amplitude wave every ~280ms (avg word beat)
    utterance.onstart = () => {
      let phase = 0
      const id2 = setInterval(() => {
        phase = (phase + 1) % 4
        // Sawtooth-ish pattern: peak, mid, mid, low — mimics natural speech cadence
        const levels = [0.9, 0.55, 0.75, 0.3]
        setAudioLevel(levels[phase])
      }, 280)
      ttsPulseRef.current = id2
    }
    utterance.onend = () => {
      setSpeakingId(null)
      if (ttsPulseRef.current) { clearInterval(ttsPulseRef.current); ttsPulseRef.current = null }
      setAudioLevel(0)
    }
    utterance.onerror = () => {
      setSpeakingId(null)
      if (ttsPulseRef.current) { clearInterval(ttsPulseRef.current); ttsPulseRef.current = null }
      setAudioLevel(0)
    }
    setSpeakingId(id)
    window.speechSynthesis.speak(utterance)
  }

  // Initialise welcome message on client only (avoids hydration mismatch)
  useEffect(() => {
    if (!isInitialized) {
      if (initialMessages && initialMessages.length > 0) {
        const loaded: Message[] = initialMessages.map(m => ({
          id: m.id || Date.now().toString() + Math.random(),
          type: m.type as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp || Date.now()
        }))
        setMessages(loaded)
        const history = loaded.map(m => ({ role: m.type, content: m.content }))
        setConversationHistory(history)
      } else {
        setMessages([{
          id: '1',
          type: 'assistant',
          content: "Hello! I'm MediCare's AI assistant. I can help you with:\n\n- Doctor availability and appointments\n- Insurance coverage questions\n- Department locations\n- Visiting hours\n\nHow can I assist you today?",
          timestamp: Date.now(),
        }])
      }
      setIsInitialized(true)
    }
  }, [isInitialized, initialMessages])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userText = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userText,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText, conversationHistory, email: initialEmail }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unknown API error')
      const content = data.message ?? "I'm sorry, I couldn't find an answer to your question. Would you like to speak with a staff member?"
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content,
        timestamp: Date.now(),
        data: {
          type: data.success ? 'results' : 'escalation',
          results: data.results,
          needsEscalation: data.needsEscalation,
          suggestedAction: data.suggestedAction,
        },
      }
      setMessages(prev => [...prev, assistantMessage])
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content },
      ])
      if (data.needsEscalation && data.suggestedAction === 'create_callback') {
        setShowCallback(true)
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'There was an error processing your request. Please try again.'
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `⚠️ ${errorMsg}`,
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Voice input ─────────────────────────────────────────────────────────────
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => {
      setIsListening(true)
      startAudioAnalysis()   // ← begin mic-level analysis for aurora
    }
    recognition.onend = () => {
      setIsListening(false)
      stopAudioAnalysis()    // ← stop mic analysis, reset aurora
    }
    recognition.onerror = () => {
      setIsListening(false)
      stopAudioAnalysis()
    }
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
    }
    recognition.start()
  }

  // ── Manage appointment (cancel/reschedule) ───────────────────────────────────
  const handleManageAppointment = async (action: 'cancel' | 'reschedule', appointmentId: string) => {
    setManageLoading(true)
    try {
      const body: any = { appointmentId, action }
      if (action === 'reschedule') {
        if (!rescheduleDate || !rescheduleSelectedSlot) {
          setManageLoading(false)
          return
        }
        const tp = rescheduleSelectedSlot.match(/(\d+):(\d+)\s*(AM|PM)/i)
        let hhmm = rescheduleSelectedSlot
        if (tp) {
          let h = parseInt(tp[1], 10)
          const m = tp[2]; const ampm = tp[3].toUpperCase()
          if (ampm === 'PM' && h < 12) h += 12
          if (ampm === 'AM' && h === 12) h = 0
          hhmm = `${h.toString().padStart(2, '0')}:${m}`
        }
        body.newDate = rescheduleDate
        body.newTime = hhmm
      }
      const res = await fetch('/api/appointments/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setManageSuccess(data.message || (action === 'cancel' ? 'Appointment cancelled.' : 'Appointment rescheduled.'))
        setManageAction(null)
        setTimeout(() => {
          setManageSuccess(null)
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'assistant',
            content: data.message || (action === 'cancel'
              ? `Your appointment has been cancelled successfully.`
              : `Your appointment has been rescheduled to ${rescheduleDate} at ${rescheduleSelectedSlot}.`),
            timestamp: Date.now(),
          }])
        }, 1200)
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: `❌ ${data.error || 'Failed to process your request. Please try again.'}`,
          timestamp: Date.now(),
        }])
        setManageAction(null)
      }
    } catch {
      setManageAction(null)
    } finally {
      setManageLoading(false)
    }
  }

  // ── Render result cards ──────────────────────────────────────────────────────
  function renderResultCard(result: { type: string; data: Record<string, unknown>; message: string }) {
    const { type, data } = result

    if (type === 'doctor_availability') {
      const doctor = data.doctor as { id: string; name: string; specialty: string; department: string; roomNumber: string; consultationFee: number }
      const slots = data.availableSlots as string[]
      const date = data.date as string
      if (!doctor) return null
      return (
        <Card className="mt-3 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-3.5 w-3.5 text-primary" />
              </div>
              {doctor.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground pl-9">{doctor.specialty} — {doctor.department}</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex gap-3 text-xs text-muted-foreground pl-1">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{doctor.roomNumber}</span>
              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />${doctor.consultationFee}</span>
            </div>
            {slots && slots.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Available Slots</p>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map(slot => (
                    <Badge key={slot} variant="outline" className="text-xs gap-1 cursor-default">
                      <Clock className="h-2.5 w-2.5" /> {slot}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedDoctor({ id: doctor.id, name: doctor.name, date: date || new Date().toISOString().split('T')[0], slots: slots || [] })
                setShowBooking(true)
              }}
              className="w-full mt-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Calendar className="h-3.5 w-3.5" /> Book Appointment
            </motion.button>
          </CardContent>
        </Card>
      )
    }

    if (type === 'insurance_coverage') {
      type InsurerEntry = { name: string; covered: boolean; coveragePercentage: number; networkType: string }
      const allInsurers = (data.allInsurers as InsurerEntry[] | undefined) || []
      const procedure = (data.procedure as string) || 'this procedure'
      if (allInsurers.length === 0) {
        const covered = data.covered as boolean
        const pct = data.coveragePercentage as number
        return (
          <Card className={`mt-3 ${covered ? 'border-green-500/20 bg-green-500/5' : 'border-destructive/20 bg-destructive/5'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Badge variant={covered ? 'default' : 'destructive'}>{covered ? `${pct}% Coverage` : 'Not Covered'}</Badge>
                <span className="text-sm text-muted-foreground">{data.insurer as string}</span>
              </div>
            </CardContent>
          </Card>
        )
      }
      const covered = allInsurers.filter(i => i.covered)
      const notCovered = allInsurers.filter(i => !i.covered)
      return (
        <Card className="mt-3 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              Insurance Coverage — {procedure}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{covered.length} insurer{covered.length !== 1 ? 's' : ''} cover · {notCovered.length} do not</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {covered.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 uppercase tracking-wide">✅ Covered</p>
                <div className="space-y-1.5">
                  {covered.map(ins => (
                    <div key={ins.name} className="flex items-center justify-between rounded-md px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <span className="text-sm font-medium">{ins.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-300">{ins.coveragePercentage}% covered</Badge>
                        <span className="text-xs text-muted-foreground">{ins.networkType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {notCovered.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">❌ Not Covered</p>
                <div className="space-y-1.5">
                  {notCovered.map(ins => (
                    <div key={ins.name} className="flex items-center justify-between rounded-md px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <span className="text-sm font-medium">{ins.name}</span>
                      <span className="text-xs text-muted-foreground">{ins.networkType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )
    }

    if (type === 'manage_appointment') {
      const apt = data.appointment as { id: string; doctorId: string; doctorName: string; date: string; time: string; service: string } | undefined
      const action = data.action as 'cancel' | 'reschedule' | undefined
      if (!apt || !action) return null
      return (
        <Card className={`mt-3 ${action === 'cancel' ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {action === 'cancel' ? <XCircle className="h-4 w-4 text-destructive" /> : <RotateCcw className="h-4 w-4 text-primary" />}
              {action === 'cancel' ? 'Cancel Appointment' : 'Reschedule Appointment'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{apt.doctorName} · {apt.date} at {apt.time}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {manageSuccess ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">{manageSuccess}</span>
              </div>
            ) : (
              <>
                {action === 'reschedule' && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">New Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm"
                      min={new Date().toISOString().split('T')[0]}
                      value={rescheduleDate}
                      onChange={async (e) => {
                        const d = e.target.value
                        setRescheduleDate(d)
                        setRescheduleSelectedSlot('')
                        if (!d) return
                        setFetchingRescheduleSlots(true)
                        try {
                          // Use apt values from closure — manageAction state may still be null at this point
                          const safeId = apt.doctorId && apt.doctorId !== 'undefined' ? apt.doctorId : ''
                          const safeName = apt.doctorName || ''
                          const res = await fetch(
                            `/api/appointments?doctorId=${encodeURIComponent(safeId)}&doctorName=${encodeURIComponent(safeName)}&date=${d}`
                          )
                          const json = await res.json()
                          setRescheduleSlots(json.availableSlots || [])
                        } catch { setRescheduleSlots([]) }
                        finally { setFetchingRescheduleSlots(false) }
                      }}
                    />
                    {fetchingRescheduleSlots && <p className="text-xs text-muted-foreground">Loading slots…</p>}
                    {rescheduleSlots.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rescheduleSlots.map(slot => (
                          <Badge
                            key={slot}
                            variant={rescheduleSelectedSlot === slot ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => setRescheduleSelectedSlot(slot)}
                          >
                            {slot}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setManageAction(null); setRescheduleDate(''); setRescheduleSlots([]); setRescheduleSelectedSlot('') }}
                  >
                    Cancel
                  </Button>
                  {action === 'cancel' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1"
                      disabled={manageLoading}
                      onClick={() => handleManageAppointment('cancel', apt.id)}
                    >
                      <XCircle className="h-3 w-3" />{manageLoading ? 'Cancelling...' : 'Confirm Cancel'}
                    </Button>
                  )}
                  {action === 'reschedule' && (
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      disabled={manageLoading || !rescheduleDate || !rescheduleSelectedSlot}
                      onClick={() => handleManageAppointment('reschedule', apt.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {manageLoading ? 'Rescheduling...' : !rescheduleDate ? 'Pick a date first' : !rescheduleSelectedSlot ? 'Pick a slot' : 'Confirm Reschedule'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )
    }

    // Set manageAction when a manage_appointment card appears
    if (type === 'manage_appointment' && data.appointment && data.action && !manageAction) {
      const apt2 = data.appointment as any
      setTimeout(() => setManageAction({
        appointmentId: apt2.id,
        action: data.action as any,
        // Use doctorId if valid, otherwise leave empty so the API falls back to name lookup
        doctorId: (apt2.doctorId && apt2.doctorId !== 'undefined') ? apt2.doctorId : '',
        doctorName: apt2.doctorName || '',
        currentDate: apt2.date,
        currentTime: apt2.time
      }), 0)
    }

    if (type === 'visiting_hours' || type === 'location' || type === 'department_info') {
      return (
        <Card className="mt-3 border-accent/20 bg-accent/5">
          <CardContent className="pt-4">
            <p className="text-sm">{result.message}</p>
          </CardContent>
        </Card>
      )
    }

    return null
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <BackgroundBlobs />

      {/* Aurora — STT: blue/indigo, driven by real mic level */}
      <AuroraBackground
        visible={isListening}
        colorStops={['#3b82f6', '#6366f1', '#06b6d4']}
        opacity={0.72}
        blend="screen"
        audioLevel={audioLevel}
        className="absolute inset-0 pointer-events-none z-0"
      />
      {/* Aurora — TTS: violet/cyan, driven by simulated speech-rhythm pulse */}
      <AuroraBackground
        visible={!!speakingId && !isListening}
        colorStops={['#8b5cf6', '#06b6d4', '#10b981']}
        opacity={0.65}
        blend="screen"
        audioLevel={audioLevel}
        className="absolute inset-0 pointer-events-none z-0"
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex items-center gap-3 px-5 py-3.5 border-b bg-card/80 backdrop-blur-xl shrink-0"
      >
        <div className="relative">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
            <Bot className="h-5 w-5" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground leading-tight">MediCare AI Assistant</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Powered by Gemini · Online
          </p>
        </div>
      </motion.div>

      {/* Sample questions */}
      <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0">
        <p className="text-xs font-medium text-foreground/50 mb-2">Try asking:</p>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.slice(0, 3).map((q, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setInput(q)}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-background text-foreground/75 hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {q.length > 40 ? q.substring(0, 40) + '…' : q}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-1 scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(128,128,128,0.3) transparent' }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 16, x: message.type === 'user' ? 16 : -16 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI avatar */}
                {message.type === 'assistant' && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                    className="flex items-end justify-center w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shrink-0 shadow-md shadow-primary/20"
                  >
                    <Bot className="h-4 w-4 mb-1" />
                  </motion.div>
                )}

                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-first' : ''}`}>
                  {/* Bubble */}
                  <motion.div
                    whileHover={{ scale: 1.005 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className={`relative rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md ml-auto'
                        : 'bg-card border border-border text-foreground rounded-bl-md'
                    }`}
                  >
                    {/* AI glow pulse on newest message */}
                    {message.type === 'assistant' && idx === messages.length - 1 && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl rounded-bl-md pointer-events-none"
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1.8, ease: 'easeOut' }}
                        style={{ boxShadow: '0 0 0 2px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.15)' }}
                      />
                    )}
                    {message.content}
                  </motion.div>

                  {/* Structured result cards */}
                  {message.type === 'assistant' && message.data?.results?.map((result, i) => (
                    <div key={i}>{renderResultCard(result)}</div>
                  ))}

                  {/* Escalation callback */}
                  {message.type === 'assistant' && message.data?.needsEscalation && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-2 rounded-xl"
                        onClick={() => setShowCallback(true)}
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Request Callback
                      </Button>
                    </motion.div>
                  )}

                  {/* Timestamp row + TTS */}
                  <div className={`flex items-center gap-2 mt-1 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.type === 'assistant' && (
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => speak(message.id, message.content)}
                        title={speakingId === message.id ? 'Stop speaking' : 'Read aloud'}
                        className={`flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                          speakingId === message.id
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                            : 'text-foreground/50 hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <motion.div
                          animate={speakingId === message.id ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                          transition={{ duration: 0.8, repeat: speakingId === message.id ? Infinity : 0 }}
                        >
                          {speakingId === message.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </motion.div>
                      </motion.button>
                    )}
                    <p className="text-[11px] text-muted-foreground/70" suppressHydrationWarning>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* User avatar */}
                {message.type === 'user' && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                    className="flex items-end justify-center w-8 h-8 rounded-2xl bg-secondary text-secondary-foreground shrink-0"
                  >
                    <User className="h-4 w-4 mb-1" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 12, x: -12 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="flex gap-3 justify-start"
              >
                <div className="flex items-end justify-center w-8 h-8 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shrink-0 shadow-md shadow-primary/20">
                  <Bot className="h-4 w-4 mb-1" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Glass Input Bar */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 8px 32px rgba(59,130,246,0.18), 0 2px 8px rgba(0,0,0,0.12)'
              : '0 4px 16px rgba(0,0,0,0.08)',
            borderColor: isFocused ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.08)'
          }}
          transition={{ duration: 0.25 }}
          className="max-w-3xl mx-auto flex items-center gap-2 px-3 py-2 rounded-2xl border border-border bg-card backdrop-blur-xl"
        >
          {/* Mic button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleVoiceInput}
            disabled={isLoading}
            className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors shrink-0 ${
              isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}
          >
            {/* Pulsing ring while listening */}
            {isListening && (
              <>
                <motion.span
                  className="absolute inset-0 rounded-xl bg-red-400"
                  animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.span
                  className="absolute inset-0 rounded-xl bg-red-300"
                  animate={{ scale: [1, 1.9], opacity: [0.4, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeOut', delay: 0.2 }}
                />
              </>
            )}
            <motion.div
              animate={isListening ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, repeat: isListening ? Infinity : 0 }}
            >
              <Mic className="h-4 w-4" />
            </motion.div>
          </motion.button>

          {/* Input field */}
          <input
            ref={inputRef}
            placeholder="Ask about doctors, appointments, insurance…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60 text-foreground min-w-0"
          />

          {/* Send button */}
          <AnimatePresence mode="wait">
            <motion.button
              key={input.trim() ? 'active' : 'inactive'}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.88 }}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors ${
                input.trim() && !isLoading
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Callback Form Modal */}
      {showCallback && (
        <CallbackForm
          onClose={() => setShowCallback(false)}
          onSuccess={() => {
            setShowCallback(false)
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              type: 'assistant',
              content: 'Your callback request has been submitted successfully. Our team will contact you soon.',
              timestamp: Date.now(),
            }])
          }}
          initialEmail={initialEmail}
        />
      )}

      {/* Appointment Booking Modal */}
      {showBooking && selectedDoctor && (
        <AppointmentBooking
          doctorId={selectedDoctor.id}
          doctorName={selectedDoctor.name}
          date={selectedDoctor.date}
          availableSlots={selectedDoctor.slots}
          initialEmail={initialEmail}
          onClose={() => setShowBooking(false)}
          onSuccess={(appointment) => {
            setShowBooking(false)
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              type: 'assistant',
              content: `Great news! Your appointment with ${appointment.doctorName} has been confirmed for ${appointment.date} at ${appointment.time}. Please arrive 15 minutes early.`,
              timestamp: Date.now(),
            }])
          }}
        />
      )}
    </div>
  )
}
