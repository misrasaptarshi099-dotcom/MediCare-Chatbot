'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Mail, Phone, Shield, LogOut, ArrowLeft, Trash2,
  Loader2, AlertTriangle, CheckCircle2, Link2, Unlink, Fingerprint
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountLinkDialog } from '@/components/account-link-dialog'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { Stethoscope } from 'lucide-react'

const SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 } as const

interface PatientProfile {
  uid: string
  name: string
  email?: string
  phone?: string
  authProviders: string[]
  createdAt: string
}

interface Identity {
  provider: string
  value: string
  patientUid: string
  linkedAt: string
}

export default function PatientProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userUid, setUserUid] = useState<string | null>(null)
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Unlink confirmation state
  const [unlinkConfirm, setUnlinkConfirm] = useState<string | null>(null)
  const [unlinkConfirmText, setUnlinkConfirmText] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid)
        fetchProfile(user.uid)
      } else {
        router.push('/patient/login')
      }
    })
    return () => unsub()
  }, [router])

  const fetchProfile = async (uid: string) => {
    setLoading(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const res = await fetch('/api/patient/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(data.patient)
        setIdentities(data.identities || [])
      }
    } catch (e) {
      console.error('Failed to fetch profile:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async () => {
    if (!unlinkConfirm) return
    if (unlinkConfirmText.toLowerCase() !== unlinkConfirm.toLowerCase()) return

    const provider = unlinkConfirm
    setUnlinking(provider)
    setError(null)
    setSuccess(null)

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return

      const res = await fetch('/api/patient/profile/unlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to unlink')
        return
      }

      setSuccess(`${provider} has been unlinked from your account`)
      setProfile(data.patient)
      setIdentities(data.identities || [])
    } catch (e) {
      setError('Network error. Please try again.')
    } finally {
      setUnlinking(null)
      setUnlinkConfirm(null)
      setUnlinkConfirmText('')
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    setDeleting(true)
    setError(null)

    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setDeleting(false)
        return
      }

      const res = await fetch('/api/patient/profile/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmText: 'DELETE' }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete account')
        setDeleting(false)
        return
      }

      // Sign out and redirect
      await signOut(auth)
      router.push('/patient/login')
    } catch (e) {
      setError('Network error. Please try again.')
      setDeleting(false)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/patient/login')
  }

  const providerIcon = (p: string) => {
    switch (p) {
      case 'phone': return <Phone className="h-4 w-4" />
      case 'email': return <Mail className="h-4 w-4" />
      case 'google': return (
        <svg className="h-4 w-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
      )
      default: return <Fingerprint className="h-4 w-4" />
    }
  }

  const providerLabel = (p: string) => {
    switch (p) {
      case 'phone': return 'Phone Number'
      case 'email': return 'Email Address'
      case 'google': return 'Google Account'
      default: return p
    }
  }

  const getIdentityValue = (provider: string): string | undefined => {
    const identity = identities.find(i => i.provider === provider)
    if (identity) return identity.value
    if (provider === 'phone') return profile?.phone
    if (provider === 'email') return profile?.email
    if (provider === 'google') return 'Connected'
    return undefined
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const linkedProviders = profile?.authProviders || []
  const allProviders: ('phone' | 'email' | 'google')[] = ['phone', 'email', 'google']
  const unlinkedProviders = allProviders.filter(p => !linkedProviders.includes(p))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/patient" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive border-destructive/20 hover:border-destructive/40"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and login methods</p>
        </motion.div>

        {/* Feedback messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl flex items-start gap-3 border bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{error}</div>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl flex items-start gap-3 border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{success}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
        >
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Account Info
              </CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/50 gap-1 sm:gap-0">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">{profile?.name || 'Unknown'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-2 border-b border-border/50 gap-1 sm:gap-2">
                <span className="text-sm text-muted-foreground">Patient ID</span>
                <span className="text-xs font-mono bg-muted px-2 py-1 rounded-md border break-all max-w-full sm:max-w-[70%] text-left sm:text-right">{profile?.uid}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-1 sm:gap-0">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { 
                    day: 'numeric', month: 'short', year: 'numeric' 
                  }) : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Connected Login Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Connected Login Methods
              </CardTitle>
              <CardDescription>Ways you can sign in to your account</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
              {linkedProviders.map((provider) => (
                <div key={provider} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border bg-muted/20 gap-3 sm:gap-2 group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      {providerIcon(provider)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{providerLabel(provider)}</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {getIdentityValue(provider) || 'Linked'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/40">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                      Connected
                    </Badge>
                    {linkedProviders.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setUnlinkConfirm(provider)
                          setUnlinkConfirmText('')
                          setError(null)
                        }}
                        disabled={unlinking === provider}
                      >
                        {unlinking === provider ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlink className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 px-2 shrink-0">Only method</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Link new methods */}
              {unlinkedProviders.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Add login method</p>
                  <div className="flex flex-wrap gap-2">
                    {unlinkedProviders.filter(p => p !== 'google').map((provider) => (
                      <AccountLinkDialog
                        key={provider}
                        providerToLink={provider}
                        onSuccess={() => userUid && fetchProfile(userUid)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.15 }}
        >
          <Card className="border-destructive/30">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Unlink Confirmation Modal */}
      <AnimatePresence>
        {unlinkConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={SPRING}
            >
              <Card className="w-full max-w-md border-destructive/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Unlink className="h-5 w-5" />
                    Unlink {providerLabel(unlinkConfirm)}?
                  </CardTitle>
                  <CardDescription>
                    This will remove <span className="font-semibold text-foreground">{providerLabel(unlinkConfirm)}</span> as a login method.
                    You will no longer be able to sign in using this method.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">{unlinkConfirm}</span> to confirm
                    </label>
                    <Input
                      value={unlinkConfirmText}
                      onChange={(e) => setUnlinkConfirmText(e.target.value)}
                      placeholder={`Type ${unlinkConfirm} here`}
                      disabled={unlinking !== null}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setUnlinkConfirm(null); setUnlinkConfirmText('') }}
                      disabled={unlinking !== null}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={handleUnlink}
                      disabled={unlinkConfirmText.toLowerCase() !== unlinkConfirm.toLowerCase() || unlinking !== null}
                    >
                      {unlinking ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Unlinking...</>
                      ) : (
                        <><Unlink className="h-4 w-4" /> Unlink</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={SPRING}
            >
              <Card className="w-full max-w-md border-destructive/50 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Delete Account
                  </CardTitle>
                  <CardDescription>
                    This will permanently delete your account and all your data including appointments, chat history, lab reports, and callback tickets.
                    <strong className="block mt-2">This cannot be undone.</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">DELETE</span> to confirm
                    </label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE here"
                      className="font-mono"
                      disabled={deleting}
                    />
                  </div>

                  {error && (
                    <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowDeleteModal(false)
                        setDeleteConfirmText('')
                        setError(null)
                      }}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE' || deleting}
                    >
                      {deleting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
                      ) : (
                        <><Trash2 className="h-4 w-4" /> Delete Forever</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
