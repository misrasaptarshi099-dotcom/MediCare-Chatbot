'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  UserX, Search, Trash2, MessageSquare, Calendar, PhoneCall, 
  Loader2, AlertTriangle, CheckCircle2, Users, Plus
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Patient = {
  uid: string
  email: string
  phone: string
  name: string
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
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Add Patient State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addContactType, setAddContactType] = useState<'email' | 'phone'>('phone')
  const [addContactValue, setAddContactValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState('')

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

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/patients')
      const data = await res.json()
      setPatients(data.patients || [])
      setFiltered(data.patients || [])
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

  const toggleOption = (key: keyof DeleteOptions) => {
    setDeleteOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Patient Management
          </h2>
          <p className="text-muted-foreground mt-1">View and delete patient data records</p>
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
                Choose which data to permanently delete for <span className="font-semibold text-foreground">{confirmTarget.email}</span>.
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

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmTarget(null)}
                  disabled={deleting !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  onClick={handleDelete}
                  disabled={deleting !== null}
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
