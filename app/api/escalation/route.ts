import { requireAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'
import {
  getUnansweredQueries,
  addUnansweredQuery,
  deleteUnansweredQuery,
  getCallbackTickets,
  addCallbackTicket,
  updateCallbackTicket,
  type UnansweredQuery,
  type CallbackTicket,
} from '@/lib/db'

export async function POST(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'log_unanswered') {
      const { query, reason } = data

      if (!query || !reason) {
        return NextResponse.json({ error: 'Query and reason are required' }, { status: 400 })
      }

      const newQuery: UnansweredQuery = {
        id: `uq-${Date.now()}`,
        query,
        reason,
        timestamp: new Date().toISOString()
      }

      await addUnansweredQuery(newQuery)

      return NextResponse.json({ success: true, logged: newQuery })
    }

    if (action === 'create_callback') {
      const { patientName, patientPhone, patientEmail, querySummary, department } = data

      if (!patientName || !patientPhone || !querySummary) {
        return NextResponse.json({ error: 'Patient details and query summary are required' }, { status: 400 })
      }

      const newTicket: CallbackTicket = {
        id: `ticket-${Date.now()}`,
        patientName,
        patientPhone,
        patientEmail: patientEmail || '',
        querySummary,
        department: department || 'General',
        status: 'pending',
        createdAt: new Date().toISOString()
      }

      await addCallbackTicket(newTicket)

      return NextResponse.json({ 
        success: true, 
        ticket: newTicket,
        message: 'Your callback request has been submitted. Our team will contact you soon.'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in escalation:', error)
    return NextResponse.json({ error: 'Failed to process escalation' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  try {
    if (type === 'queries') {
      const queries = await getUnansweredQueries()
      return NextResponse.json(queries)
    }

    if (type === 'tickets') {
      const tickets = await getCallbackTickets()
      return NextResponse.json(tickets)
    }

    // Return both
    const queries = await getUnansweredQueries()
    const tickets = await getCallbackTickets()

    return NextResponse.json({ queries, tickets })
  } catch (error) {
    console.error('Error fetching escalation data:', error)
    return NextResponse.json({ error: 'Failed to fetch escalation data' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json()
    const { ticketId, status } = body

    if (!ticketId || !status) {
      return NextResponse.json({ error: 'Ticket ID and status are required' }, { status: 400 })
    }

    const tickets = await getCallbackTickets()
    const ticket = tickets.find(t => t.id === ticketId)

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updates: Partial<CallbackTicket> = { status }
    if (status === 'resolved') {
      updates.resolvedAt = new Date().toISOString()
    }

    await updateCallbackTicket(ticketId, updates)

    return NextResponse.json({ success: true, ticket: { ...ticket, ...updates } })
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
