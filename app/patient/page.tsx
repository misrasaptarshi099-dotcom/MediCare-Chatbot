'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Stethoscope, LogOut, Calendar, MessageSquare, PhoneCall, ListOrdered,
  Sparkles, User, Activity
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChatInterface } from '@/components/chat-interface'
import { ThemeToggle } from '@/components/theme-toggle'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

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
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.05] dark:opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, #3b82f6 50%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ scale: [1, 1.08, 1], x: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.04] dark:opacity-[0.03]"
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
function AppointmentCard({ apt, index }: { apt: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: index * 0.07 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/60 rounded-xl bg-card/70 gap-4 cursor-default"
    >
      <div>
        <p className="font-semibold text-foreground">{apt.service}</p>
        <p className="text-sm text-muted-foreground mt-0.5">with {apt.doctorName}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border/60 bg-background text-foreground/70">
            <Calendar className="h-3 w-3" /> {apt.date}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-background text-foreground/70">
            {apt.time}
          </span>
        </div>
      </div>
      <Badge
        variant={apt.status === 'scheduled' ? 'default' : apt.status === 'completed' ? 'secondary' : 'destructive'}
        className="w-fit text-xs"
      >
        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
      </Badge>
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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [patientData, setPatientData] = useState<{ appointments: any[]; callbacks: any[]; chats: any[]; waitlist: any[] }>({
    appointments: [],
    callbacks: [],
    chats: [],
    waitlist: [],
  })
  const [activeTab, setActiveTab] = useState<'chat' | 'appointments' | 'callbacks'>('chat')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.email) {
        const email = firebaseUser.email
        setUserEmail(email)
        fetchPatientData(email)
        setLoading(false)
      } else {
        const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('patient-email') : null
        if (storedEmail) {
          setUserEmail(storedEmail)
          fetchPatientData(storedEmail)
          setLoading(false)
        } else {
          router.push('/patient/login')
          setLoading(false)
        }
      }
    })
    return () => unsubscribe()
  }, [router])

  const fetchPatientData = async (email: string) => {
    try {
      const res = await fetch(`/api/patient/data?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setPatientData(data)
      }
    } catch (err) {
      console.error('Failed to fetch patient records', err)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    if (typeof window !== 'undefined') localStorage.removeItem('patient-email')
    router.push('/')
  }

  const TABS = [
    { key: 'chat',         label: 'AI Assistant',  icon: MessageSquare },
    { key: 'appointments', label: 'Appointments',  icon: Calendar },
    { key: 'callbacks',    label: 'Callbacks',     icon: PhoneCall },
  ] as const

  return (
    <>
      <AnimatePresence>{loading && <LoadingScreen />}</AnimatePresence>

      {!loading && userEmail && (
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
                {/* Email pill */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING, delay: 0.2 }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border/60 text-xs text-muted-foreground"
                >
                  <User className="h-3 w-3" />
                  {userEmail}
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
              className="shrink-0 max-w-md mx-auto w-full"
            >
              <div className="relative flex items-center bg-muted border border-border rounded-2xl p-1 gap-1">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className="relative flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-medium z-10 transition-colors"
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
                      <span className="hidden sm:inline-block">{label}</span>
                    </motion.div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* ── Tab Content ─────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">

                {/* Chat */}
                {activeTab === 'chat' && (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 14, scale: 0.98, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -14, scale: 0.98, filter: 'blur(4px)' }}
                    transition={SPRING}
                    className="absolute inset-0 border border-border/60 rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm shadow-sm"
                  >
                    <ChatInterface initialEmail={userEmail} initialMessages={patientData.chats} />
                  </motion.div>
                )}

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
                              <AppointmentCard key={apt.id} apt={apt} index={i} />
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

              </AnimatePresence>
            </div>
          </main>
        </motion.div>
      )}
    </>
  )
}
