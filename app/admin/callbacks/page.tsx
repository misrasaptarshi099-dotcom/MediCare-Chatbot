'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Phone, Clock, CheckCircle2, Loader2 } from 'lucide-react'

interface CallbackTicket {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  querySummary: string
  department: string
  status: 'pending' | 'resolved' | 'in-progress'
  createdAt: string
  resolvedAt?: string
}

export default function CallbacksPage() {
  const [tickets, setTickets] = useState<CallbackTicket[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved'>('all')

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    const res = await fetch('/api/escalation?type=tickets')
    const data = await res.json()
    setTickets(data || [])
  }

  const updateStatus = async (ticketId: string, status: 'pending' | 'in-progress' | 'resolved') => {
    await fetch('/api/escalation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, status })
    })
    fetchTickets()
  }

  const filteredTickets = tickets.filter(t => 
    filter === 'all' ? true : t.status === filter
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
      case 'in-progress':
        return <Badge className="gap-1 bg-chart-5"><Loader2 className="h-3 w-3" /> In Progress</Badge>
      case 'resolved':
        return <Badge className="gap-1 bg-accent"><CheckCircle2 className="h-3 w-3" /> Resolved</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Callback Tickets</h1>
        <p className="text-muted-foreground">Manage patient callback requests</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {(['all', 'pending', 'in-progress', 'resolved'] as const).map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
            className="capitalize"
          >
            {status.replace('-', ' ')}
          </Button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">No callback tickets</p>
            <p className="text-sm text-muted-foreground">No pending callback requests</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.patientName}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {ticket.patientPhone}
                        </div>
                        {ticket.patientEmail && (
                          <p className="text-xs text-muted-foreground">{ticket.patientEmail}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ticket.department}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate text-sm">{ticket.querySummary}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {ticket.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(ticket.id, 'in-progress')}
                        >
                          Start
                        </Button>
                      )}
                      {ticket.status === 'in-progress' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(ticket.id, 'resolved')}
                        >
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
