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
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { sanitizeHtml } from '@/lib/sanitize'

export async function POST(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const ip = getClientIp(request)

    // Rate limit: 3 escalation actions per day per IP
    const check = checkRateLimit(rateLimitKey('escalation-day', ip), 3, 24 * 60 * 60 * 1000)
    if (!check.allowed) {
      return NextResponse.json(
        { error: 'Too many escalation requests today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { action, ...data } = body

    if (action === 'log_unanswered') {
      const query = typeof data.query === 'string' ? sanitizeHtml(data.query.slice(0, 500)) : ''
      const reason = typeof data.reason === 'string' ? sanitizeHtml(data.reason.slice(0, 500)) : ''

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
      const patientName = typeof data.patientName === 'string' ? sanitizeHtml(data.patientName.slice(0, 100)) : ''
      const patientPhone = typeof data.patientPhone === 'string' ? data.patientPhone.slice(0, 20) : ''
      const patientEmail = typeof data.patientEmail === 'string' ? data.patientEmail.slice(0, 254) : ''
      const querySummary = typeof data.querySummary === 'string' ? sanitizeHtml(data.querySummary.slice(0, 500)) : ''
      const department = typeof data.department === 'string' ? sanitizeHtml(data.department.slice(0, 100)) : 'General'

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
