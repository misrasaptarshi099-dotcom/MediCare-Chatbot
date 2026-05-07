'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Shield, Calendar, MapPin, Stethoscope, Clock,
  ChevronRight, Zap, Bot, Activity, ArrowRight, Star
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

// ── Spring config ────────────────────────────────────────────────────────────
const SPRING = { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 } as const
const SPRING_SLOW = { type: 'spring', stiffness: 120, damping: 20 } as const

// ── Stagger helpers ──────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } }
}
const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...SPRING } }
}
const fadeIn = {
  hidden: { opacity: 0, scale: 0.96, filter: 'blur(4px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { ...SPRING } }
}

// ── Cursor Glow ──────────────────────────────────────────────────────────────
function CursorGlow() {
  const x = useMotionValue(-400)
  const y = useMotionValue(-400)
  const springX = useSpring(x, { stiffness: 80, damping: 20 })
  const springY = useSpring(y, { stiffness: 80, damping: 20 })

  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY) }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [x, y])

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          left: springX,
          top: springY,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          willChange: 'transform',
        }}
      />
    </motion.div>
  )
}

// ── Animated Mesh Background ─────────────────────────────────────────────────
function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Gradient blobs */}
      <motion.div
        className="absolute -top-40 -left-40 w-[800px] h-[800px] rounded-full opacity-[0.06] dark:opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, #3b82f6 50%, transparent 70%)', filter: 'blur(80px)' }}
        animate={{ scale: [1, 1.08, 1], x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.05] dark:opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #8b5cf6 0%, #06b6d4 50%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ scale: [1, 1.06, 1], x: [0, -20, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full opacity-[0.04] dark:opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #10b981 0%, #3b82f6 50%, transparent 70%)', filter: 'blur(70px)' }}
        animate={{ scale: [1, 1.1, 1], x: [0, 15, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
    </div>
  )
}

// ── Animated counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started) setStarted(true)
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    let frame = 0
    const total = 60
    const timer = setInterval(() => {
      frame++
      setDisplayed(Math.round((frame / total) * value))
      if (frame >= total) clearInterval(timer)
    }, 20)
    return () => clearInterval(timer)
  }, [started, value])

  return <span ref={ref}>{displayed}{suffix}</span>
}

// ── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon, title, description, gradient, delay = 0
}: {
  icon: any; title: string; description: string; gradient: string; delay?: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      variants={fadeUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 overflow-hidden cursor-default"
    >
      {/* Hover glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: gradient }}
      />
      {/* Card content */}
      <div className="relative z-10">
        <motion.div
          animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? 6 : 0 }}
          transition={SPRING}
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: gradient }}
        >
          <Icon className="h-6 w-6 text-white" />
        </motion.div>
        <h3 className="font-semibold text-foreground mb-2 text-base">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <motion.div
          animate={{ x: hovered ? 4 : 0, opacity: hovered ? 1 : 0 }}
          transition={SPRING}
          className="flex items-center gap-1 mt-4 text-xs font-medium text-primary"
        >
          Learn more <ArrowRight className="h-3 w-3" />
        </motion.div>
      </div>
    </motion.div>
  )
}

// ── Scroll-reveal wrapper ─────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Typewriter badge ─────────────────────────────────────────────────────────
const WORDS = ['Instantly', 'Accurately', 'Intelligently', 'With AI']
function TypewriterBadge() {
  const [wordIdx, setWordIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setWordIdx(i => (i + 1) % WORDS.length), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary mb-8">
      <motion.div
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="w-1.5 h-1.5 rounded-full bg-primary"
      />
      Answered{' '}
      <AnimatePresence mode="wait">
        <motion.span
          key={wordIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="font-bold"
        >
          {WORDS[wordIdx]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { scrollYProgress } = useScroll()
  const navBg = useTransform(scrollYProgress, [0, 0.05], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)'])
  const navBgDark = useTransform(scrollYProgress, [0, 0.05], ['rgba(0,0,0,0)', 'rgba(10,10,10,0.85)'])
  const navBlur = useTransform(scrollYProgress, [0, 0.05], [0, 16])

  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.94])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <CursorGlow />
      <MeshBackground />

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <motion.header
        style={{ backdropFilter: `blur(${navBlur}px)` }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-transparent"
      >
        <motion.div
          style={{
            background: 'var(--nav-bg, transparent)',
            borderColor: useTransform(scrollYProgress, [0, 0.05], ['transparent', 'rgba(0,0,0,0.08)'])
          }}
          className="absolute inset-0"
        />
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="relative container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={SPRING}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/25"
            >
              <Stethoscope className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
            </motion.div>
            <div>
              <p className="font-semibold text-foreground leading-none">MediCare Hospital</p>
              <p className="text-[10px] text-muted-foreground leading-tight">AI-Powered Healthcare</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/patient">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-xl hover:bg-muted transition-colors"
              >
                Patient Portal
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 4px 20px rgba(59,130,246,0.35)' }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-xl shadow-md shadow-primary/20 transition-all"
              >
                Admin Login
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.section
        style={{ scale: heroScale, opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20"
      >
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={fadeIn} className="flex justify-center">
            <TypewriterBadge />
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6"
          >
            Your Health Questions,{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary via-violet-500 to-cyan-500 bg-clip-text text-transparent">
                Answered Instantly
              </span>
              <motion.span
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-primary via-violet-500 to-cyan-500"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: 'left' }}
              />
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Our AI-powered assistant is available 24/7 to help you find doctors,
            check availability, understand insurance coverage, and book appointments.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
            <Link href="/patient">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 8px 40px rgba(59,130,246,0.45)' }}
                whileTap={{ scale: 0.97 }}
                className="group flex items-center gap-2.5 px-7 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl shadow-lg shadow-primary/30 transition-all text-base"
              >
                <MessageSquare className="h-5 w-5" />
                Start Chat
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.span>
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.04, backgroundColor: 'hsl(var(--muted))' }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-7 py-3.5 border-2 border-border bg-background text-foreground font-medium rounded-2xl text-base"
              >
                <Shield className="h-5 w-5 text-muted-foreground" />
                Admin Dashboard
              </motion.button>
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            variants={fadeUp}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto"
          >
            {[
              { value: 50, suffix: '+', label: 'Doctors' },
              { value: 24, suffix: '/7', label: 'Available' },
              { value: 8, suffix: '+', label: 'Insurers' },
            ].map(({ value, suffix, label }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-foreground tracking-tight">
                  <AnimatedNumber value={value} suffix={suffix} />
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ delay: 2, duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50"
        >
          <div className="w-5 h-8 rounded-full border-2 border-current flex items-start justify-center pt-1.5">
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 h-1.5 rounded-full bg-current"
            />
          </div>
        </motion.div>
      </motion.section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="container mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center mb-16">
              <motion.p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                What we offer
              </motion.p>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
                How Can We Help You?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Everything you need to manage your healthcare — in one place, powered by AI.
              </p>
            </div>
          </Reveal>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {[
              {
                icon: Stethoscope,
                title: 'Find Doctors',
                description: 'Browse specialists by department, check qualifications and consultation fees.',
                gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.04))',
              },
              {
                icon: Calendar,
                title: 'Book Appointments',
                description: 'Check real-time availability and book with your preferred doctors instantly.',
                gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.04))',
              },
              {
                icon: Shield,
                title: 'Insurance Coverage',
                description: 'Verify your insurance for procedures and treatments before you visit.',
                gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.04))',
              },
              {
                icon: MapPin,
                title: 'Hospital Info',
                description: 'Get directions, visiting hours, and department locations in seconds.',
                gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.04))',
              },
            ].map((card, i) => (
              <FeatureCard key={card.title} {...card} delay={i * 0.08} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── AI Highlight Banner ────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <Reveal>
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={SPRING_SLOW}
              className="relative rounded-3xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-violet-500/5 to-cyan-500/5 p-8 sm:p-12"
            >
              {/* Animated background lines */}
              <div className="absolute inset-0 opacity-[0.07]" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(99,102,241,0.5) 0, rgba(99,102,241,0.5) 1px, transparent 0, transparent 50%)',
                backgroundSize: '20px 20px',
              }} />

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-xl shadow-primary/30"
                >
                  <Bot className="h-10 w-10 text-white" />
                </motion.div>
                <div className="text-center sm:text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    Powered by Gemini AI
                  </h3>
                  <p className="text-muted-foreground max-w-xl">
                    Our AI assistant understands natural language, detects your language automatically,
                    and responds in kind — making healthcare accessible to everyone.
                  </p>
                </div>
                <div className="shrink-0 ml-auto">
                  <Link href="/patient">
                    <motion.button
                      whileHover={{ scale: 1.05, boxShadow: '0 8px 30px rgba(59,130,246,0.4)' }}
                      whileTap={{ scale: 0.96 }}
                      className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md"
                    >
                      Try Now <Zap className="h-4 w-4" />
                    </motion.button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── Quick Info Grid ────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid md:grid-cols-3 gap-5"
          >
            {/* Visiting Hours */}
            <motion.div variants={fadeUp} className="group rounded-2xl border border-border/60 bg-card/60 p-6 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
                </div>
                <h3 className="font-semibold text-foreground">Visiting Hours</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  { day: 'Weekdays', time: '10AM–12PM, 4PM–8PM' },
                  { day: 'Weekends', time: '10AM–8PM' },
                  { day: 'ICU', time: '5PM–5:30PM, 8PM–8:30PM' },
                ].map(({ day, time }) => (
                  <div key={day} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{day}</span>
                    <span className="font-medium text-foreground">{time}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Departments */}
            <motion.div variants={fadeUp} className="group rounded-2xl border border-border/60 bg-card/60 p-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Stethoscope className="h-4.5 w-4.5 text-violet-500" style={{ width: 18, height: 18 }} />
                </div>
                <h3 className="font-semibold text-foreground">Departments</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Orthopedics', 'Cardiology', 'Neurology', 'Pediatrics', 'Radiology'].map((dept, i) => (
                  <motion.span
                    key={dept}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07, ...SPRING }}
                    whileHover={{ scale: 1.06, y: -2 }}
                    className="px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium cursor-default"
                  >
                    {dept}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Insurance */}
            <motion.div variants={fadeUp} className="group rounded-2xl border border-border/60 bg-card/60 p-6 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-4.5 w-4.5 text-emerald-500" style={{ width: 18, height: 18 }} />
                </div>
                <h3 className="font-semibold text-foreground">Insurance Partners</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['ICICI Lombard', 'Star Health', 'HDFC Ergo', 'Max Bupa', 'Bajaj', 'New India', 'Reliance', 'Tata AIG'].map((ins, i) => (
                  <motion.span
                    key={ins}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, ...SPRING }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-medium cursor-default"
                  >
                    {ins}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────────────── */}
      <section className="py-28 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <Reveal>
            <motion.div
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6"
            >
              <Activity className="h-3.5 w-3.5" />
              Available 24/7
            </motion.div>
            <h2 className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight mb-6 leading-tight">
              Start your health journey{' '}
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                today
              </span>
            </h2>
            <p className="text-muted-foreground mb-10 text-lg">
              Ask any health question, book appointments, or check your insurance coverage —
              all in seconds, in any language.
            </p>
            <Link href="/patient">
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: '0 12px 50px rgba(59,130,246,0.45)' }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center gap-3 px-9 py-4 bg-primary text-primary-foreground text-lg font-semibold rounded-2xl shadow-lg shadow-primary/25 transition-all"
              >
                <MessageSquare className="h-5 w-5" />
                Get Started Free
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.span>
              </motion.button>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="border-t border-border/60 py-10 px-4"
      >
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Stethoscope className="h-3.5 w-3.5 text-white" />
            </div>
            <span>MediCare Hospital · Quality Healthcare Since 1990</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Emergency: +1-555-911-0000</span>
            <span className="hidden sm:inline">·</span>
            <span>Reception: +1-555-100-0000</span>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}
