'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, AlertCircle, Mail, ShieldAlert, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'

type Step = 'email' | 'otp'

export default function AdminLoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [isPatientError, setIsPatientError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsPatientError(false)
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.ok) {
        setAdminName(data.adminName || 'Administrator')
        setStep('otp')
      } else {
        setIsPatientError(data.isPatientEmail === true)
        setError(data.error || 'Failed to send OTP.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    setError('')
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter all 6 digits.'); return }

    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/admin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        // Store user in session storage (existing mechanism)
        sessionStorage.setItem('hospital_user', JSON.stringify(data.user))
        setSuccess(true)
        setTimeout(() => router.push('/admin'), 800)
      } else {
        setError(data.error || 'Invalid code. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Building2 className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Admin Panel</CardTitle>
          <CardDescription>
            {step === 'email'
              ? 'Enter your admin email to receive a verification code'
              : `We sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Error Banner */}
          {error && (
            <div className={`flex items-start gap-3 rounded-lg p-4 mb-5 text-sm ${
              isPatientError
                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-destructive/10 border border-destructive/20 text-destructive'
            }`}>
              {isPatientError
                ? <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              }
              <span>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 p-4 mb-5 text-green-800 dark:text-green-300 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Verified! Redirecting to admin panel…
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="admin@hospital.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); setIsPatientError(false) }}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isLoading || !email}>
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending Code…</> : 'Send Verification Code'}
              </Button>
            </form>
          )}

          {step === 'otp' && !success && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Signed in as <span className="font-medium text-foreground">{adminName}</span>
                </p>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-11 h-14 text-center text-xl font-bold border-2 rounded-lg bg-background focus:border-destructive focus:outline-none transition-colors"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button type="submit" className="w-full bg-destructive hover:bg-destructive/90 gap-2" disabled={isLoading || otp.join('').length !== 6}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Verify & Sign In'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => { setStep('email'); setOtp(['','','','','','']); setError('') }}
                >
                  <ArrowLeft className="h-4 w-4" /> Use a different email
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Didn&apos;t get the code?{' '}
                  <button
                    type="button"
                    className="text-destructive underline underline-offset-2"
                    onClick={() => { setOtp(['','','','','','']); handleSendOtp({ preventDefault: () => {} } as React.FormEvent) }}
                  >
                    Resend
                  </button>
                </p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
