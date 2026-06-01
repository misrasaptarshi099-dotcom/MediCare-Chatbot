'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Stethoscope, LogOut, Calendar, MessageSquare, PhoneCall, ListOrdered,
  Sparkles, User, Activity, FileText, Download
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChatInterface } from '@/components/chat-interface'
import { ThemeToggle } from '@/components/theme-toggle'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { PatientProvider } from '@/lib/patient-context'

// ── Spring config ─────────────────────────────────────────────────────────────
const SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 } as const

// ── Stagger variants ──────────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
}
const fadeUp = {
  hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...SPRING } }
}

// ── Portal mesh background ─────────────────────────────────────────────────────
function PortalMesh() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <motion.div
        className="absolute -top-32 -left-32 w-[min(500px,100vw)] h-[min(500px,100vw)] rounded-full opacity-[0.05] dark:opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, #3b82f6 50%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ scale: [1, 1.08, 1], x: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-[min(400px,100vw)] h-[min(400px,100vw)] rounded-full opacity-[0.04] dark:opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, #06b6d4 50%, transparent 70%)', filter: 'blur(60px)' }}
        animate={{ scale: [1, 1.1, 1], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />
    </div>
  )
}

// ── Loading screen ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-background z-50"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="flex flex-col items-center gap-5"
      >
        {/* Animated logo */}
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/30"
          >
            <Stethoscope className="h-8 w-8 text-white" />
          </motion.div>
          {/* Orbit ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-2 rounded-2xl border-2 border-primary/20 border-dashed"
          />
        </div>
        <div className="text-center">
          <motion.p
            className="font-semibold text-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            Loading your portal
          </motion.p>
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Appointment card ─────────────────────────────────────────────────────────
function AppointmentCard({ apt, index, onPaymentSuccess }: { apt: any; index: number; onPaymentSuccess?: () => void }) {
  const [isPaying, setIsPaying] = useState(false)

  const handlePayNow = async () => {
    setIsPaying(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        alert('You must be logged in to make a payment.')
        return
      }
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId: apt.id, amount: apt.amount })
      })
      if (res.ok) {
        alert('Payment successful!')
        onPaymentSuccess?.()
      } else {
        const errorData = await res.json()
        alert(`Payment failed: ${errorData.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Payment failed', err)
      alert('Payment failed. Please try again.')
    } finally {
      setIsPaying(false)
    }
  }

  const paymentColor = apt.paymentStatus === 'paid'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : apt.paymentStatus === 'refunded'
    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: index * 0.07 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/60 rounded-xl bg-card/70 gap-4 cursor-default"
    >
      <div className="flex-1">
        <p className="font-semibold text-foreground">{apt.service}</p>
        <p className="text-sm text-muted-foreground mt-0.5">with {apt.doctorName}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border/60 bg-background text-foreground/70">
            <Calendar className="h-3 w-3" /> {apt.date}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-background text-foreground/70">
            {apt.time}
          </span>
          {apt.amount != null && (
            <span className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-background text-foreground/70 font-medium">
              ₹{apt.amount}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <Badge
          variant={apt.status === 'scheduled' ? 'default' : apt.status === 'completed' ? 'secondary' : 'destructive'}
          className="w-fit text-xs"
        >
          {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
        </Badge>
        <Badge className={`w-fit text-xs border ${paymentColor}`}>
          {apt.paymentStatus === 'paid' ? '✓ Paid' : apt.paymentStatus === 'refunded' ? '↩ Refunded' : '⏳ Unpaid'}
        </Badge>
        {apt.paymentStatus === 'unpaid' && apt.status === 'scheduled' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={handlePayNow}
            disabled={isPaying}
          >
            {isPaying ? (
              <span className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Paying...
              </span>
            ) : 'Pay Now'}
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Callback card ─────────────────────────────────────────────────────────────
function CallbackCard({ cb, index }: { cb: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: index * 0.07 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className="flex flex-col sm:flex-row sm:items-start justify-between p-4 border border-border/60 rounded-xl bg-card/70 gap-4 cursor-default"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{cb.querySummary || 'Callback Request'}</p>
        <p className="text-sm text-muted-foreground mt-0.5">Name: {cb.patientName}</p>
        <p className="text-sm text-muted-foreground">Phone: {cb.patientPhone}</p>
        {cb.department && <p className="text-sm text-muted-foreground">Dept: {cb.department}</p>}
        <p className="text-xs text-muted-foreground/70 mt-1">Submitted: {new Date(cb.createdAt).toLocaleString()}</p>
        {cb.resolvedAt && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Resolved: {new Date(cb.resolvedAt).toLocaleString()}</p>
        )}
      </div>
      <Badge className={`w-fit shrink-0 ${
        cb.status === 'pending'
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
          : cb.status === 'resolved'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
      }`}>
        {cb.status === 'pending' ? '⏳ Pending' : cb.status === 'resolved' ? '✓ Resolved' : '🔄 In Progress'}
      </Badge>
    </motion.div>
  )
}

// ── Report card ─────────────────────────────────────────────────────────────
function ReportCard({ report, index, uid }: { report: any; index: number; uid: string }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        alert('You must be logged in to download reports.')
        return
      }
      const url = `/api/reports/download?reportId=${encodeURIComponent(report.id)}&token=${encodeURIComponent(token)}`
      window.open(url, '_blank')
    } catch (err) {
      console.error('Download failed', err)
      alert('Failed to initiate download.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: index * 0.07 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/60 rounded-xl bg-card/70 gap-4 cursor-default"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground flex items-center gap-2">
          {report.testName}
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            {report.reportType === 'blood_test' ? 'Blood Test' : 'Imaging'}
          </Badge>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date(report.createdAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
        {report.notes && (
          <p className="text-xs text-muted-foreground/80 mt-2 bg-muted/50 p-2 rounded-md border border-border/40 inline-block">
            <span className="font-medium text-foreground/80">Notes:</span> {report.notes}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Badge className={`w-fit ${
          report.status === 'sent' || report.status === 'ready'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
        }`}>
          {report.status === 'sent' || report.status === 'ready' ? '✓ Ready' : '⏳ Processing'}
        </Badge>
        <Button size="sm" variant="outline" className="gap-2" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <span className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Opening...
            </span>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING}
      className="flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4"
      >
        <Activity className="h-6 w-6 opacity-40" />
      </motion.div>
      <p className="text-sm">{label}</p>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PatientDashboard() {
  const router = useRouter()
  const [userUid, setUserUid] = useState<string | null>(null)
  const [patientProfile, setPatientProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [patientData, setPatientData] = useState<{ appointments: any[]; callbacks: any[]; chats: any[]; waitlist: any[]; reports: any[] }>({
    appointments: [],
    callbacks: [],
    chats: [],
    waitlist: [],
    reports: [],
  })
  const [activeTab, setActiveTabRaw] = useState<'chat' | 'appointments' | 'callbacks' | 'reports'>('chat')

  // Refresh patient data whenever the user switches tabs
  const setActiveTab = (tab: 'chat' | 'appointments' | 'callbacks' | 'reports') => {
    setActiveTabRaw(tab)
    if (userUid) fetchPatientData(userUid)
  }

  const fetchPatientData = async (uid: string) => {
    try {
      const res = await fetch(`/api/patient/data?uid=${encodeURIComponent(uid)}`)
      if (res.ok) {
        const data = await res.json()
        setPatientData({
          appointments: data.appointments || [],
          callbacks: data.callbacks || [],
          chats: data.chats || [],
          waitlist: data.waitlist || [],
          reports: data.reports || [],
        })
        if (data.patient) {
          setPatientProfile(data.patient)
        }
      }
    } catch (err) {
      console.error('Failed to fetch patient records', err)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.uid) {
        const uid = firebaseUser.uid
        setUserUid(uid)
        await fetchPatientData(uid)
        setLoading(false)
      } else {
        router.push('/patient/login')
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/')
  }

  const TABS = [
    { key: 'chat',         label: 'AI Assistant',  icon: MessageSquare },
    { key: 'appointments', label: 'Appointments',  icon: Calendar },
    { key: 'reports',      label: 'Reports',       icon: FileText },
    { key: 'callbacks',    label: 'Callbacks',     icon: PhoneCall },
  ] as const

  return (
    <PatientProvider initialPatient={patientProfile}>
      <AnimatePresence>{loading && <LoadingScreen />}</AnimatePresence>

      {!loading && userUid && patientProfile && (
        <motion.div
          className="h-screen flex flex-col bg-background overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <PortalMesh />

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
            className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-xl z-40"
          >
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 group">
                <motion.div
                  whileHover={{ rotate: 8, scale: 1.08 }}
                  transition={SPRING}
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/25"
                >
                  <Stethoscope className="h-4 w-4 text-white" />
                </motion.div>
                <span className="font-semibold text-foreground hidden sm:inline-block group-hover:text-primary transition-colors">
                  MediCare Portal
                </span>
              </Link>

              <div className="flex items-center gap-3">
                {/* Profile Pill — links to My Profile page */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING, delay: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <Link
                    href="/patient/profile"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <User className="h-3 w-3" />
                    <span className="font-medium">{patientProfile?.name}</span>
                  </Link>
                </motion.div>

                <ThemeToggle />

                <motion.button
                  whileHover={{ scale: 1.04, backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-destructive rounded-xl border border-destructive/20 hover:border-destructive/40 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline-block">Sign Out</span>
                </motion.button>
              </div>
            </div>
          </motion.header>

          {/* ── Main ───────────────────────────────────────────────────────── */}
          <main className="flex-1 overflow-hidden container mx-auto p-4 flex flex-col gap-4">

            {/* ── Tab Bar ─────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: 0.18 }}
              className="shrink-0 max-w-2xl mx-auto w-full"
            >
              <div className="relative flex items-center bg-muted border border-border rounded-2xl p-1 gap-1 overflow-x-auto no-scrollbar">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-sm font-medium z-10 transition-colors min-w-0"
                  >
                    {activeTab === key && (
                      <motion.div
                        layoutId="portal-tab-bubble"
                        className="absolute inset-0 rounded-xl bg-primary shadow-lg shadow-primary/30"
                        transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
                      />
                    )}
                    <motion.div
                      className="relative flex items-center gap-1.5"
                      animate={{
                        scale: activeTab === key ? 1.04 : 1,
                        color: activeTab === key
                          ? 'hsl(var(--primary-foreground))'
                          : 'hsl(var(--foreground) / 0.75)',
                      }}
                      transition={SPRING}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline-block whitespace-nowrap text-xs md:text-sm">{label}</span>
                    </motion.div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* ── Tab Content ─────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden">

              {/* Chat — ALWAYS MOUNTED to preserve state; hidden via CSS when not active */}
              <div
                className="absolute inset-0 border border-border/60 rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm shadow-sm transition-opacity duration-200"
                style={{
                  opacity: activeTab === 'chat' ? 1 : 0,
                  pointerEvents: activeTab === 'chat' ? 'auto' : 'none',
                  zIndex: activeTab === 'chat' ? 10 : 0,
                }}
              >
                <ChatInterface initialMessages={patientData.chats} />
              </div>

              <AnimatePresence mode="wait">

                {/* Appointments */}
                {activeTab === 'appointments' && (
                  <motion.div
                    key="appointments"
                    initial={{ opacity: 0, y: 14, scale: 0.98, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, scale: 0.98, filter: 'blur(4px)' }}
                    transition={SPRING}
                    className="absolute inset-0 overflow-auto pb-4 pr-0.5"
                  >
                    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
                      {/* Appointments section */}
                      <motion.div variants={fadeUp}>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="h-4 w-4 text-primary" />
                          <h2 className="font-semibold text-foreground">My Appointments</h2>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {patientData.appointments.length} records
                          </span>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-4">
                          {patientData.appointments.length === 0 ? (
                            <EmptyState label="No appointments found." />
                          ) : (
                            patientData.appointments.map((apt, i) => (
                              <AppointmentCard key={apt.id} apt={apt} index={i} onPaymentSuccess={() => userUid && fetchPatientData(userUid)} />
                            ))
                          )}
                        </div>
                      </motion.div>

                      {/* Waitlist section */}
                      {patientData.waitlist && patientData.waitlist.length > 0 && (
                        <motion.div variants={fadeUp}>
                          <div className="flex items-center gap-2 mb-3">
                            <ListOrdered className="h-4 w-4 text-amber-500" />
                            <h2 className="font-semibold text-foreground">My Waitlists</h2>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {patientData.waitlist.length} entries
                            </span>
                          </div>
                          <div className="space-y-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 backdrop-blur-sm p-4">
                            {patientData.waitlist.map((entry: any, i: number) => (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ ...SPRING, delay: i * 0.07 }}
                                whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(245,158,11,0.1)' }}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-amber-400/30 rounded-xl bg-background gap-3 cursor-default"
                              >
                                <div>
                                  <p className="font-semibold text-foreground">Dr. {entry.doctorName}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-amber-400/50 text-amber-700 dark:text-amber-400">
                                      <Calendar className="h-3 w-3" /> {entry.date}
                                    </span>
                                    <span className="text-xs px-2.5 py-1 rounded-full border border-amber-400/50 text-amber-700 dark:text-amber-400">
                                      {entry.time}
                                    </span>
                                  </div>
                                </div>
                                <Badge className="bg-amber-500 hover:bg-amber-500 text-white gap-1 shrink-0">
                                  <ListOrdered className="h-3 w-3" />
                                  #{entry.position} in queue
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}

                {/* Callbacks */}
                {activeTab === 'callbacks' && (
                  <motion.div
                    key="callbacks"
                    initial={{ opacity: 0, y: 14, scale: 0.98, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, scale: 0.98, filter: 'blur(4px)' }}
                    transition={SPRING}
                    className="absolute inset-0 overflow-auto pb-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <PhoneCall className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold text-foreground">My Callback Requests</h2>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {patientData.callbacks.length} requests
                      </span>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-4">
                      {patientData.callbacks.length === 0 ? (
                        <EmptyState label="No callback requests found." />
                      ) : (
                        patientData.callbacks.map((cb, i) => (
                          <CallbackCard key={cb.id} cb={cb} index={i} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Reports */}
                {activeTab === 'reports' && (
                  <motion.div
                    key="reports"
                    initial={{ opacity: 0, y: 14, scale: 0.98, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, scale: 0.98, filter: 'blur(4px)' }}
                    transition={SPRING}
                    className="absolute inset-0 overflow-auto pb-4 pr-0.5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold text-foreground">My Lab Reports</h2>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {patientData.reports.length} records
                      </span>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-4">
                      {patientData.reports.length === 0 ? (
                        <EmptyState label="No reports available yet." />
                      ) : (
                        patientData.reports.map((report, i) => (
                          <ReportCard key={report.id} report={report} index={i} uid={userUid || ''} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </main>
        </motion.div>
      )}
    </PatientProvider>
  )
}
