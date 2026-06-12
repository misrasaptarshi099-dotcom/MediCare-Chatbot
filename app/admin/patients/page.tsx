'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  UserX, Search, Trash2, MessageSquare, Calendar, PhoneCall, 
  Loader2, AlertTriangle, CheckCircle2, Users, Plus, Mail, Phone,
  Shield, Link2, Unlink
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Patient = {
  uid: string
  email: string
  phone: string
  name: string
  authProviders: string[]
  appointmentCount: number
  callbackCount: number
  chatCount: number
}

type DeleteOptions = {
  deleteAppointments: boolean
  deleteChats: boolean
  deleteCallbacks: boolean
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [filtered, setFiltered] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Patient | null>(null)
  const [deleteOptions, setDeleteOptions] = useState<DeleteOptions>({
    deleteAppointments: true,
    deleteChats: true,
    deleteCallbacks: true,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Pagination State
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  // Add Patient State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addContactType, setAddContactType] = useState<'email' | 'phone'>('phone')
  const [addContactValue, setAddContactValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Identity Management State
  const [managingPatient, setManagingPatient] = useState<Patient | null>(null)
  const [linkProvider, setLinkProvider] = useState<'email' | 'phone'>('email')
  const [linkValue, setLinkValue] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState('')

  // Unlink Confirmation State
  const [unlinkConfirm, setUnlinkConfirm] = useState<{ patient: Patient; provider: string } | null>(null)
  const [unlinkConfirmText, setUnlinkConfirmText] = useState('')

  useEffect(() => {
    fetchPatients()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(patients.filter(p => 
      (p.email && p.email.includes(q)) || 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      p.uid.toLowerCase().includes(q)
    ))
  }, [search, patients])

  const fetchPatients = async (cursorOrEvent?: string | React.SyntheticEvent | Event) => {
    const cursor = typeof cursorOrEvent === 'string' ? cursorOrEvent : undefined;
    setLoading(true)
    try {
      const url = new URL('/api/admin/patients', window.location.origin)
      if (search) {
        url.searchParams.set('search', search)
      }
      if (cursor && !search) {
        url.searchParams.set('cursor', cursor)
      } else if (!search) {
        setCursorStack([])
      }
      
      const res = await fetch(url.toString())
      const data = await res.json()
      setPatients(data.patients || [])
      setFiltered(data.patients || [])
      setNextCursor(search ? null : (data.nextCursor || null))
    } catch {
      setPatients([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmTarget) return
    if (!deleteOptions.deleteAppointments && !deleteOptions.deleteChats && !deleteOptions.deleteCallbacks) {
      setResultMessage({ type: 'error', text: 'Please select at least one type of data to delete.' })
      return
    }

    // Safety: require typing patient name to confirm
    if (deleteConfirmName.toLowerCase() !== confirmTarget.name.toLowerCase()) {
      setResultMessage({ type: 'error', text: 'Patient name does not match. Please type the exact name to confirm.' })
      return
    }

    setDeleting(confirmTarget.uid)
    setResultMessage(null)
    try {
      const res = await fetch('/api/admin/patients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: confirmTarget.uid, ...deleteOptions }),
      })
      const data = await res.json()
      if (res.ok) {
        setResultMessage({ type: 'success', text: `✓ Deleted data for ${confirmTarget.name}: ${data.results.join(', ')}` })
        await fetchPatients()
      } else {
        setResultMessage({ type: 'error', text: data.error || 'Delete failed.' })
      }
    } catch {
      setResultMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setDeleting(null)
      setConfirmTarget(null)
      setDeleteConfirmName('')
    }
  }

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    setIsAdding(true)

    try {
      const res = await fetch('/api/admin/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: addName, 
          contactType: addContactType, 
          contactValue: addContactValue 
        })
      })

      const data = await res.json()
      if (res.ok) {
        setResultMessage({ type: 'success', text: `✓ Successfully added patient: ${addName}` })
        setIsAddOpen(false)
        setAddName('')
        setAddContactValue('')
        await fetchPatients()
      } else {
        setAddError(data.error || 'Failed to add patient.')
      }
    } catch {
      setAddError('Network error. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleLinkIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!managingPatient) return
    setIdentityError('')
    setIsLinking(true)

    try {
      const res = await fetch('/api/admin/patients/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: managingPatient.uid,
          action: 'link',
          provider: linkProvider,
          value: linkValue,
        })
      })

      const data = await res.json()
      if (res.ok) {
        setResultMessage({ type: 'success', text: `✓ Linked ${linkProvider} for ${managingPatient.name}` })
        setLinkValue('')
        setManagingPatient(null)
        await fetchPatients()
      } else {
        setIdentityError(data.error || 'Failed to link.')
      }
    } catch {
      setIdentityError('Network error.')
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlinkIdentity = async () => {
    if (!unlinkConfirm) return
    if (unlinkConfirmText.toLowerCase() !== unlinkConfirm.provider.toLowerCase()) return

    const { patient, provider } = unlinkConfirm
    setIsUnlinking(`${patient.uid}-${provider}`)
    setResultMessage(null)

    try {
      const res = await fetch('/api/admin/patients/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: patient.uid,
          action: 'unlink',
          provider,
        })
      })

      const data = await res.json()
      if (res.ok) {
        setResultMessage({ type: 'success', text: `✓ Unlinked ${provider} for ${patient.name}` })
        await fetchPatients()
      } else {
        setResultMessage({ type: 'error', text: data.error || 'Failed to unlink.' })
      }
    } catch {
      setResultMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setIsUnlinking(null)
      setUnlinkConfirm(null)
      setUnlinkConfirmText('')
    }
  }

  const toggleOption = (key: keyof DeleteOptions) => {
    setDeleteOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const providerBadge = (provider: string) => {
    const colors: Record<string, string> = {
      phone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      email: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      google: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    }
    const icons: Record<string, React.ReactNode> = {
      phone: <Phone className="h-3 w-3" />,
      email: <Mail className="h-3 w-3" />,
      google: <span className="text-[10px] font-bold">G</span>,
    }
    return (
      <Badge key={provider} variant="outline" className={`gap-1 text-xs ${colors[provider] || ''}`}>
        {icons[provider]}
        {provider}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Patient Management
          </h2>
          <p className="text-muted-foreground mt-1">View, manage login methods, and delete patient data records</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
                <DialogDescription>
                  Create a new patient record. They will be able to log in using OTP with the contact method you provide.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4 pt-4">
                {addError && <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">{addError}</div>}
                
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    placeholder="E.g. John Doe" 
                    value={addName} 
                    onChange={e => setAddName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contact Method</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant={addContactType === 'phone' ? 'default' : 'outline'} 
                      onClick={() => setAddContactType('phone')}
                      className="flex-1"
                    >
                      Phone Number
                    </Button>
                    <Button 
                      type="button"
                      variant={addContactType === 'email' ? 'default' : 'outline'} 
                      onClick={() => setAddContactType('email')}
                      className="flex-1"
                    >
                      Email Address
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{addContactType === 'phone' ? 'Phone Number' : 'Email Address'}</Label>
                  <Input 
                    type={addContactType === 'email' ? 'email' : 'tel'}
                    placeholder={addContactType === 'phone' ? '+91 9876543210' : 'john@example.com'} 
                    value={addContactValue} 
                    onChange={e => setAddContactValue(e.target.value)} 
                    required 
                  />
                  {addContactType === 'phone' && <p className="text-xs text-muted-foreground">Include country code (e.g., +91)</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isAdding}>
                  {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isAdding ? 'Adding Patient...' : 'Add Patient'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={fetchPatients} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, email, phone, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 max-w-md bg-card"
        />
      </div>

      {resultMessage && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
          resultMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
        }`}>
          {resultMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
          <div className="font-medium text-sm pt-0.5">{resultMessage.text}</div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <UserX className="h-12 w-12 mb-4 opacity-20" />
            <p>No patients found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((patient, idx) => (
            <Card key={patient.uid || idx} className="group overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4">
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{patient.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                        ID: {patient.uid}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      {patient.email && <span>{patient.email}</span>}
                      {patient.phone && <span>{patient.phone}</span>}
                      {(!patient.email && !patient.phone) && <span className="italic">No contact info</span>}
                    </div>

                    {/* Auth Providers */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Login:
                      </span>
                      {(patient.authProviders || []).map(p => (
                        <div key={p} className="flex items-center gap-1">
                          {providerBadge(p)}
                          {(patient.authProviders || []).length > 1 && (
                            <button
                              className="text-muted-foreground/50 hover:text-destructive transition-colors p-0.5"
                              onClick={() => {
                                setUnlinkConfirm({ patient, provider: p })
                                setUnlinkConfirmText('')
                              }}
                              disabled={isUnlinking === `${patient.uid}-${p}`}
                              title={`Unlink ${p}`}
                            >
                              {isUnlinking === `${patient.uid}-${p}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Unlink className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                        onClick={() => {
                          setManagingPatient(patient)
                          setIdentityError('')
                          setLinkValue('')
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Link
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Calendar className="h-3 w-3" />{patient.appointmentCount} Appointment{patient.appointmentCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <PhoneCall className="h-3 w-3" />{patient.callbackCount} Callback{patient.callbackCount !== 1 ? 's' : ''}
                      </Badge>
                      <Badge variant="outline" className="gap-1 text-xs">
                        <MessageSquare className="h-3 w-3" />{patient.chatCount} Chat msg{patient.chatCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => {
                      setConfirmTarget(patient)
                      setDeleteOptions({ deleteAppointments: true, deleteChats: true, deleteCallbacks: true })
                      setResultMessage(null)
                      setDeleteConfirmName('')
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {(!loading && (filtered.length > 0 || cursorStack.length > 0) && !search) && (
        <div className="flex items-center justify-between py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newStack = [...cursorStack]
              newStack.pop()
              const prevCursor = newStack[newStack.length - 1] || undefined
              setCursorStack(newStack)
              fetchPatients(prevCursor)
            }}
            disabled={cursorStack.length === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {cursorStack.length + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (nextCursor) {
                setCursorStack([...cursorStack, nextCursor])
                fetchPatients(nextCursor)
              }
            }}
            disabled={!nextCursor}
          >
            Next
          </Button>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {unlinkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-destructive/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Unlink className="h-5 w-5" />
                Confirm Unlink
              </CardTitle>
              <CardDescription>
                You are about to unlink <span className="font-semibold text-foreground">{unlinkConfirm.provider}</span> from patient <span className="font-semibold text-foreground">{unlinkConfirm.patient.name}</span>.
                This will remove their ability to sign in using this method.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">{unlinkConfirm.provider}</span> to confirm
                </Label>
                <Input
                  value={unlinkConfirmText}
                  onChange={(e) => setUnlinkConfirmText(e.target.value)}
                  placeholder={`Type ${unlinkConfirm.provider} here`}
                  disabled={isUnlinking !== null}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setUnlinkConfirm(null); setUnlinkConfirmText('') }}
                  disabled={isUnlinking !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={handleUnlinkIdentity}
                  disabled={unlinkConfirmText.toLowerCase() !== unlinkConfirm.provider.toLowerCase() || isUnlinking !== null}
                >
                  {isUnlinking ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Unlinking...</>
                  ) : (
                    <><Unlink className="h-4 w-4" /> Unlink</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Link Identity Modal */}
      {managingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Link Login Method
              </CardTitle>
              <CardDescription>
                Add a new login method for <span className="font-semibold text-foreground">{managingPatient.name}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLinkIdentity} className="space-y-4">
                {identityError && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
                    {identityError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Provider</Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant={linkProvider === 'phone' ? 'default' : 'outline'} 
                      onClick={() => setLinkProvider('phone')}
                      className="flex-1 gap-2"
                    >
                      <Phone className="h-4 w-4" /> Phone
                    </Button>
                    <Button 
                      type="button"
                      variant={linkProvider === 'email' ? 'default' : 'outline'} 
                      onClick={() => setLinkProvider('email')}
                      className="flex-1 gap-2"
                    >
                      <Mail className="h-4 w-4" /> Email
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{linkProvider === 'phone' ? 'Phone Number' : 'Email Address'}</Label>
                  <Input
                    type={linkProvider === 'email' ? 'email' : 'tel'}
                    placeholder={linkProvider === 'phone' ? '+91 9876543210' : 'john@example.com'}
                    value={linkValue}
                    onChange={e => setLinkValue(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    type="button"
                    onClick={() => setManagingPatient(null)}
                    disabled={isLinking}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 gap-2" disabled={isLinking || !linkValue}>
                    {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {isLinking ? 'Linking...' : 'Link'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-destructive/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </CardTitle>
              <CardDescription>
                Choose which data to permanently delete for <span className="font-semibold text-foreground">{confirmTarget.name}</span>.
                This action <strong>cannot be undone</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Checkbox options */}
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                {([
                  { key: 'deleteAppointments', label: 'Appointments', icon: Calendar, count: confirmTarget.appointmentCount },
                  { key: 'deleteChats', label: 'Chat History', icon: MessageSquare, count: confirmTarget.chatCount },
                  { key: 'deleteCallbacks', label: 'Callback Tickets', icon: PhoneCall, count: confirmTarget.callbackCount },
                ] as const).map(({ key, label, icon: Icon, count }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={deleteOptions[key]}
                      onChange={() => toggleOption(key)}
                      className="w-4 h-4 rounded accent-destructive"
                    />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground group-hover:text-foreground/80">{label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{count}</Badge>
                  </label>
                ))}
              </div>

              {/* Type patient name to confirm */}
              <div className="space-y-2">
                <Label className="text-sm">
                  Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">{confirmTarget.name}</span> to confirm
                </Label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder="Type patient name here"
                  disabled={deleting !== null}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setConfirmTarget(null); setDeleteConfirmName('') }}
                  disabled={deleting !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={handleDelete}
                  disabled={deleting !== null || deleteConfirmName.toLowerCase() !== confirmTarget.name.toLowerCase()}
                >
                  {deleting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><UserX className="h-4 w-4" /> Confirm Delete</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
