'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Stethoscope, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export default function PatientLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code.')

      setStep('otp')
      setMessage(`A 6-digit code was sent to ${email}. Check your inbox!`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp || otp.length < 6) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed.')

      // Sign in to Firebase client with the custom token from server
      await signInWithCustomToken(auth, data.customToken)

      // Persist email so dashboard can identify the user
      localStorage.setItem('patient-email', data.email)

      router.push('/patient')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">MediCare</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {/* Icon */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              {step === 'email'
                ? <Mail className="h-8 w-8 text-primary" />
                : <ShieldCheck className="h-8 w-8 text-primary" />
              }
            </div>
            <h1 className="text-2xl font-bold text-foreground">Patient Portal</h1>
            <p className="text-sm text-muted-foreground text-center">
              {step === 'email'
                ? 'Enter your email to receive a secure 6-digit login code'
                : `Enter the code we sent to ${email}`}
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}
              {message && step === 'otp' && (
                <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-lg text-sm font-medium">
                  {message}
                </div>
              )}

              {step === 'email' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || !email} size="lg">
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending Code...</>
                    ) : (
                      <><Mail className="mr-2 h-4 w-4" />Send Login Code</>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">6-Digit Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading}
                      maxLength={6}
                      className="text-center text-3xl tracking-[0.5em] font-mono h-16"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || otp.length < 6} size="lg">
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                    ) : (
                      <><ShieldCheck className="mr-2 h-4 w-4" />Verify & Sign In</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    className="w-full text-sm text-muted-foreground"
                    onClick={() => { setStep('email'); setOtp(''); setError(null); setMessage(null) }}
                    disabled={loading}
                  >
                    ← Try a different email
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Protected by Firebase Authentication
          </p>
        </div>
      </main>
    </div>
  )
}
