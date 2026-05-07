'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import {
  Calendar, Clock, User, Phone, Mail,
  ListOrdered, Trash2, RefreshCw, AlertCircle
} from 'lucide-react'

interface WaitlistEntry {
  id: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  patientName: string
  patientEmail: string
  patientPhone: string
  service: string
  createdAt: string
  position: number
}

const SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 } as const

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchWaitlist = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/waitlist')
      const data = await res.json()
      setEntries(data.waitlist || [])
    } catch {
      showToast('Failed to load waitlist', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWaitlist() }, [])

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the waitlist?`)) return
    setRemoving(id)
    try {
      const res = await fetch(`/api/admin/waitlist?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Entry removed.')
        fetchWaitlist()
      } else {
        showToast(data.error || 'Failed to remove.', 'error')
      }
    } finally {
      setRemoving(null)
    }
  }

  // Group by slot for visual clarity
  const grouped = entries.reduce<Record<string, WaitlistEntry[]>>((acc, e) => {
    const key = `${e.doctorName}|${e.date}|${e.time}`
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={SPRING}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-destructive text-destructive-foreground'
            }`}
          >
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListOrdered className="h-6 w-6 text-primary" />
            Waitlist
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Patients waiting for a slot to open up — automatically promoted on cancellation
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWaitlist} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary pill */}
      {entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/40 bg-amber-500/8 w-fit"
        >
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {entries.length} patient{entries.length !== 1 ? 's' : ''} waiting across{' '}
            {Object.keys(grouped).length} slot{Object.keys(grouped).length !== 1 ? 's' : ''}
          </span>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading waitlist…</p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4"
          >
            <ListOrdered className="h-7 w-7 opacity-40" />
          </motion.div>
          <p className="font-medium">No patients on waitlist</p>
          <p className="text-sm mt-1 opacity-70">All appointment slots are open or patients have been promoted.</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([slotKey, slotEntries]) => {
            const [doctorName, date, time] = slotKey.split('|')
            return (
              <motion.div
                key={slotKey}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING}
              >
                {/* Slot header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30">
                    <ListOrdered className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {slotEntries.length} waiting
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">{doctorName}</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {date}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {time}
                  </span>
                </div>

                <Card className="overflow-hidden border-border/60">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-12 text-center">Queue</TableHead>
                          <TableHead>Patient</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {slotEntries.map((entry, i) => (
                            <motion.tr
                              key={entry.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 12, height: 0 }}
                              transition={{ ...SPRING, delay: i * 0.06 }}
                              className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors"
                            >
                              <TableCell className="text-center">
                                <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                  entry.position === 1
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  #{entry.position}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{entry.patientName}</p>
                                    {entry.position === 1 && (
                                      <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-500 mt-0.5">
                                        Next in line
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {entry.patientPhone}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    {entry.patientEmail}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-foreground">{entry.service}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleString([], {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleRemove(entry.id, entry.patientName)}
                                  disabled={removing === entry.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                >
                                  {removing === entry.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                  Remove
                                </motion.button>
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
