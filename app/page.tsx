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
const SPRING = { type: 'spring', stiffness: 200, damping: 25, mass: 0.9 } as const
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
        className="absolute w-[min(800px,100vw)] h-[min(800px,100vw)] rounded-full"
        style={{
          left: springX,
          top: springY,
          translateX: '-50%',
          translateY: '-50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 60%)',
          willChange: 'transform',
        }}
      />
    </motion.div>
  )
}

// ── Animated Mesh Background ─────────────────────────────────────────────────
function MeshBackground() {
  return null
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
      className="group relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-6 overflow-hidden cursor-default transition-colors hover:border-border/80"
    >
      {/* Card content */}
      <div className="relative z-10">
        <motion.div
          animate={{ scale: hovered ? 1.05 : 1 }}
          transition={SPRING}
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-primary/10 text-primary"
        >
          <Icon className="h-5 w-5" />
        </motion.div>
        <h3 className="font-semibold text-foreground mb-2 text-base">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
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
function TypewriterBadge() {
  return null
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
        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="relative rounded-full border border-border/50 bg-background/70 backdrop-blur-md shadow-lg px-6 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Stethoscope className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <p className="font-bold text-foreground leading-none tracking-tight text-lg">MediCare</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/patient">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Patient Portal
              </motion.button>
            </Link>
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-full shadow-md transition-all"
              >
                Admin
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
          <motion.h1
            variants={fadeUp}
            className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight leading-[1.05] mb-8"
          >
            Health Questions,{' '}
            <span className="text-primary">
              Answered Instantly
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Our AI-powered assistant is available 24/7 to help you find doctors,
            check availability, understand insurance coverage, and book appointments.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
            <Link href="/patient">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2.5 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full shadow-lg shadow-primary/25 transition-all text-base"
              >
                <MessageSquare className="h-5 w-5" />
                Start Chatting
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
              <span className="text-primary">
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
