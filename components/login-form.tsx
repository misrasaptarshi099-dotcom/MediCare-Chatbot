'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithPopup, GoogleAuthProvider, signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Phone, Mail, Loader2, ShieldCheck, ArrowLeft, User } from 'lucide-react'

export function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<'method' | 'email_input' | 'phone_input' | 'otp' | 'name'>('method')
  const [method, setMethod] = useState<'email' | 'phone' | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  // State for when we need to ask for name after verifying OTP/Google
  const [pendingVerification, setPendingVerification] = useState<{
    type: 'otp' | 'google',
    data: any
  } | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code.')

      setStep('otp')
      if (method === 'phone') {
        setMessage(`A 6-digit code was sent to ${identifier} (Check console for mock SMS)`)
      } else {
        setMessage(`A 6-digit code was sent to ${identifier}. Check your inbox!`)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!otp || otp.length < 6) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, name: name || undefined }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        if (data.requiresName) {
          // Store the successful OTP verification data so we can retry after getting name
          setPendingVerification({ type: 'otp', data: { identifier, otp } })
          setStep('name')
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Verification failed.')
      }

      // Success! Sign in to Firebase client with the custom token
      await signInWithCustomToken(auth, data.customToken)
      router.push('/patient')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      const res = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, name: name || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.requiresName) {
          setPendingVerification({ type: 'google', data: { idToken } })
          setStep('name')
          setLoading(false)
          return
        }
        throw new Error(data.error || 'Google sign-in failed.')
      }

      // If backend returned a custom token, the user was bridged to an existing account
      if (data.customToken) {
        await auth.signOut() // sign out the auto-created Google user
        await signInWithCustomToken(auth, data.customToken)
      }

      router.push('/patient')
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google sign-in')
      setLoading(false)
    }
  }

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !pendingVerification) return

    if (pendingVerification.type === 'otp') {
      await handleVerifyOtp()
    } else if (pendingVerification.type === 'google') {
      await handleGoogleSignIn()
    }
  }

  const resetToMethod = () => {
    setStep('method')
    setMethod(null)
    setIdentifier('')
    setOtp('')
    setError(null)
    setMessage(null)
    setPendingVerification(null)
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-primary/10">
      <CardHeader className="space-y-3 pb-6">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {step === 'method' && <ShieldCheck className="h-8 w-8 text-primary" />}
            {(step === 'email_input' || step === 'phone_input') && (
              method === 'email' ? <Mail className="h-8 w-8 text-primary" /> : <Phone className="h-8 w-8 text-primary" />
            )}
            {step === 'otp' && <ShieldCheck className="h-8 w-8 text-primary" />}
            {step === 'name' && <User className="h-8 w-8 text-primary" />}
          </div>
        </div>
        <CardTitle className="text-center text-2xl font-bold">
          {step === 'name' ? 'Welcome to MediCare!' : 'Patient Portal'}
        </CardTitle>
        <CardDescription className="text-center">
          {step === 'method' && 'Sign in to access your medical records'}
          {step === 'email_input' && 'Enter your email to receive a login code'}
          {step === 'phone_input' && 'Enter your phone number to receive a login code'}
          {step === 'otp' && `Enter the code we sent to ${identifier}`}
          {step === 'name' && 'What is your full name?'}
        </CardDescription>
      </CardHeader>

      <CardContent>
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

        {/* STEP: Choose Method */}
        {step === 'method' && (
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full h-12 justify-start px-6 gap-3 font-medium text-base hover:bg-primary/5 hover:border-primary/50 transition-colors"
              onClick={() => { setMethod('phone'); setStep('phone_input') }}
            >
              <Phone className="h-5 w-5 text-primary" />
              Continue with Phone
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full h-12 justify-start px-6 gap-3 font-medium text-base hover:bg-primary/5 hover:border-primary/50 transition-colors"
              onClick={() => { setMethod('email'); setStep('email_input') }}
            >
              <Mail className="h-5 w-5 text-primary" />
              Continue with Email
            </Button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted-foreground/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">or</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-12 justify-start px-6 gap-3 font-medium text-base hover:bg-primary/5 hover:border-primary/50 transition-colors"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </Button>
          </div>
        )}

        {/* STEP: Email / Phone Input */}
        {(step === 'email_input' || step === 'phone_input') && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">
                {method === 'email' ? 'Email address' : 'Phone number'}
              </Label>
              <Input
                id="identifier"
                type={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? 'name@example.com' : '+1 (555) 000-0000'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={loading || !identifier}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending Code...</>
              ) : (
                'Send Login Code'
              )}
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="w-full text-sm text-muted-foreground"
              onClick={resetToMethod}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to options
            </Button>
          </form>
        )}

        {/* STEP: OTP */}
        {step === 'otp' && (
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
            <Button type="submit" className="w-full h-12 text-base" disabled={loading || otp.length < 6}>
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
              onClick={() => { setStep(`${method}_input` as 'email_input' | 'phone_input'); setOtp(''); setError(null); setMessage(null) }}
              disabled={loading}
            >
              ← Try a different {method === 'email' ? 'email' : 'number'}
            </Button>
          </form>
        )}

        {/* STEP: Name (First time users) */}
        {step === 'name' && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                autoFocus
                className="h-12"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base" disabled={loading || !name.trim()}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Completing setup...</>
              ) : (
                'Continue to Dashboard →'
              )}
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="w-full text-sm text-muted-foreground"
              onClick={resetToMethod}
              disabled={loading}
            >
              Cancel
            </Button>
          </form>
        )}
      </CardContent>
      
      {step === 'method' && (
        <CardFooter className="flex justify-center border-t border-border/50 pt-4 pb-4">
          <p className="text-center text-xs text-muted-foreground max-w-[250px]">
            By signing in you agree to our Terms of Service & Privacy Policy
          </p>
        </CardFooter>
      )}
    </Card>
  )
}
