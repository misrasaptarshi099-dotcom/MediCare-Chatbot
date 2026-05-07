'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface AuroraProps {
  visible: boolean
  colorStops?: string[]
  /** Base opacity of the aurora blobs */
  opacity?: number
  className?: string
  blend?: 'screen' | 'multiply' | 'normal'
  /**
   * Voice intensity 0–1.
   * For STT: driven by Web Audio API microphone level.
   * For TTS: driven by a simulated speech-rhythm pulse.
   * Scales blob size and brightness in real time.
   */
  audioLevel?: number
}

export function AuroraBackground({
  visible,
  colorStops = ['#3b82f6', '#8b5cf6', '#06b6d4'],
  opacity = 0.75,
  className = 'fixed inset-0 pointer-events-none',
  blend = 'screen',
  audioLevel = 0,
}: AuroraProps) {
  const c0 = colorStops[0]
  const c1 = colorStops[1]
  const c2 = colorStops[2] ?? colorStops[0]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="aurora"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className={className}
          style={{ zIndex: 0, mixBlendMode: blend, pointerEvents: 'none' }}
          aria-hidden
        >
          {/* CSS keyframes for spatial drifting — independent of audio level */}
          <style>{`
            @keyframes aurora-a {
              0%,100% { border-radius: 60% 40% 70% 30%/50% 60% 40% 50%; transform: translate(0,0) scale(1) rotate(0deg); }
              33%      { border-radius: 45% 55% 60% 40%/65% 35% 65% 35%; transform: translate(6%, -10%) scale(1.07) rotate(40deg); }
              66%      { border-radius: 70% 30% 45% 55%/40% 65% 35% 60%; transform: translate(-5%, 9%)  scale(0.94) rotate(-25deg); }
            }
            @keyframes aurora-b {
              0%,100% { border-radius: 40% 60% 30% 70%/60% 40% 60% 40%; transform: translate(0,0) scale(1) rotate(0deg); }
              33%      { border-radius: 55% 45% 65% 35%/35% 65% 35% 65%; transform: translate(-9%, 7%)  scale(1.1)  rotate(-55deg); }
              66%      { border-radius: 30% 70% 50% 50%/50% 50% 70% 30%; transform: translate(11%, -5%) scale(1.12) rotate(28deg); }
            }
            @keyframes aurora-c {
              0%,100% { border-radius: 50% 50% 40% 60%/40% 60% 40% 60%; transform: translate(0,0) scale(1); }
              50%      { border-radius: 65% 35% 55% 45%/55% 45% 65% 35%; transform: translate(4%, 13%) scale(1.18); }
            }
            @keyframes aurora-d {
              0%,100% { transform: translate(0,0) scale(1); }
              40%      { transform: translate(-7%, -8%) scale(1.08); }
              80%      { transform: translate(5%, 7%)   scale(0.96); }
            }
          `}</style>

          {/* ── Blob 1 — top-left, primary colour ─────────────────────────── */}
          <motion.div
            style={{
              position: 'absolute',
              top: '-25%', left: '-20%',
              width: '85%', height: '85%',
              background: `radial-gradient(ellipse at 40% 40%, ${c0}ee 0%, ${c1}88 45%, transparent 72%)`,
              filter: 'blur(48px)',
              opacity,
              animation: 'aurora-a 13s ease-in-out infinite',
              willChange: 'transform',
            }}
            animate={{
              scale: [
                1 + audioLevel * 0.55,
                1 + audioLevel * 0.7,
                1 + audioLevel * 0.55,
              ],
            }}
            transition={{
              duration: Math.max(0.18, 0.9 - audioLevel * 0.65),
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* ── Blob 2 — bottom-right, secondary colour ────────────────────── */}
          <motion.div
            style={{
              position: 'absolute',
              top: '25%', right: '-22%',
              width: '75%', height: '72%',
              background: `radial-gradient(ellipse at 60% 60%, ${c1}dd 0%, ${c2}77 45%, transparent 72%)`,
              filter: 'blur(55px)',
              opacity: opacity * 0.9,
              animation: 'aurora-b 17s ease-in-out infinite',
              willChange: 'transform',
            }}
            animate={{
              scale: [
                1 + audioLevel * 0.45,
                1 + audioLevel * 0.62,
                1 + audioLevel * 0.45,
              ],
            }}
            transition={{
              duration: Math.max(0.22, 1.0 - audioLevel * 0.7),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.12,
            }}
          />

          {/* ── Blob 3 — bottom-centre, accent ──────────────────────────────── */}
          <motion.div
            style={{
              position: 'absolute',
              bottom: '-20%', left: '15%',
              width: '65%', height: '65%',
              background: `radial-gradient(ellipse at 50% 70%, ${c2}cc 0%, ${c0}66 45%, transparent 72%)`,
              filter: 'blur(62px)',
              opacity: opacity * 0.8,
              animation: 'aurora-c 21s ease-in-out infinite',
              willChange: 'transform',
            }}
            animate={{
              scale: [
                1 + audioLevel * 0.4,
                1 + audioLevel * 0.58,
                1 + audioLevel * 0.4,
              ],
            }}
            transition={{
              duration: Math.max(0.25, 1.1 - audioLevel * 0.72),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.08,
            }}
          />

          {/* ── Blob 4 — centre shimmer ──────────────────────────────────────── */}
          <motion.div
            style={{
              position: 'absolute',
              top: '10%', left: '35%',
              width: '50%', height: '50%',
              background: `radial-gradient(ellipse at 50% 50%, ${c0}bb 0%, ${c1}55 50%, transparent 72%)`,
              filter: 'blur(40px)',
              opacity: opacity * 0.65,
              animation: 'aurora-d 9s ease-in-out infinite',
              willChange: 'transform',
            }}
            animate={{
              scale: [
                0.85 + audioLevel * 0.7,
                0.85 + audioLevel * 0.9,
                0.85 + audioLevel * 0.7,
              ],
              opacity: [
                opacity * 0.5 + audioLevel * opacity * 0.5,
                opacity * 0.8 + audioLevel * opacity * 0.2,
                opacity * 0.5 + audioLevel * opacity * 0.5,
              ],
            }}
            transition={{
              duration: Math.max(0.15, 0.75 - audioLevel * 0.58),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.05,
            }}
          />

          {/* ── Live voice ring — scales directly with audioLevel ─────────── */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 50% 60%, ${c0}${Math.round(audioLevel * 200).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
              filter: 'blur(30px)',
            }}
            animate={{
              opacity: [audioLevel * 0.9, audioLevel * 1.1, audioLevel * 0.9],
              scale: [1, 1 + audioLevel * 0.12, 1],
            }}
            transition={{
              duration: Math.max(0.12, 0.6 - audioLevel * 0.45),
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Noise grain for texture */}
          <div
            style={{
              position: 'absolute', inset: 0,
              opacity: 0.035,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
              backgroundSize: '200px 200px',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
