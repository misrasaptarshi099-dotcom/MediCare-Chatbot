'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  UserX, Search, Trash2, MessageSquare, Calendar, PhoneCall, 
  Loader2, AlertTriangle, CheckCircle2, Users
} from 'lucide-react'

type Patient = {
  email: string
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

  useEffect(() => {
    fetchPatients()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(patients.filter(p => p.email.includes(q) || p.name.toLowerCase().includes(q)))
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

    setDeleting(confirmTarget.email)
    setResultMessage(null)
    try {
      const res = await fetch('/api/admin/patients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: confirmTarget.email, ...deleteOptions }),
      })
      const data = await res.json()
      if (res.ok) {
        setResultMessage({ type: 'success', text: `✓ Deleted data for ${confirmTarget.email}: ${data.results.join(', ')}` })
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

  const toggleOption = (key: keyof DeleteOptions) => {
    setDeleteOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Patient Management
          </h1>
          <p className="text-muted-foreground mt-1">View and delete patient data records</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPatients} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Result Message */}
      {resultMessage && (
        <div className={`flex items-start gap-2 p-4 rounded-lg border text-sm font-medium ${
          resultMessage.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          {resultMessage.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          }
          {resultMessage.text}
          <button onClick={() => setResultMessage(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or name..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Patient List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {search ? `No patients found matching "${search}"` : 'No patient records found.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(patient => (
            <Card key={patient.email} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{patient.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{patient.email}</p>
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
