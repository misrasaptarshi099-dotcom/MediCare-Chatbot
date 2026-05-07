import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildHospitalContext,
  getAllAppointments,
  addUnansweredQuery,
  getChatSession,
  saveChatSession,
  type Appointment,
  type UnansweredQuery,
  type ChatMessage as DbChatMessage,
} from '@/lib/db'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedAIResponse {
  message: string
  intent: string
  needsEscalation: boolean
  escalationReason?: string
  structuredResults?: Array<{
    type: string
    data: Record<string, unknown>
    message: string
  }>
}

// ── Helper: get booked slots for today ───────────────────────────────────────
async function getBookedSlotsContext(): Promise<string> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const appointments = await getAllAppointments()
    const todayBooked = appointments
      .filter(a => a.date === today && a.status === 'scheduled')
      .map(a => `  • ${a.doctorName} at ${a.time} (booked)`)
    return todayBooked.length
      ? `\n=== ALREADY BOOKED TODAY ===\n${todayBooked.join('\n')}`
      : ''
  } catch {
    return ''
  }
}

// ── Helper: log unanswered queries ───────────────────────────────────────────
async function logUnansweredQuery(query: string, reason: string) {
  try {
    await addUnansweredQuery({
      id: `q-${Date.now()}`,
      query,
      reason,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // silently ignore log failures
  }
}

// ── Helper: call Gemini with retry on 429 / RESOURCE_EXHAUSTED ────────────────
async function callGeminiWithRetry(
  query: string,
  systemPrompt: string,
  geminiHistory: { role: string; parts: { text: string }[] }[],
  maxRetries = 3
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2500,
      responseMimeType: 'application/json',
    },
  })

  let lastError: unknown = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const chat = model.startChat({ history: geminiHistory })
      const result = await chat.sendMessage(query)
      return result.response.text()
    } catch (err: unknown) {
      lastError = err
      const msg = err instanceof Error ? err.message : ''
      const isQuotaError = msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
      if (isQuotaError && attempt < maxRetries - 1) {
        // Exponential backoff: 2s, 4s, 8s …
        const delayMs = Math.pow(2, attempt + 1) * 1000
        console.warn(`Gemini quota hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      throw err  // non-quota error or last attempt → propagate
    }
  }
  throw lastError
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  let userEmail: string | undefined
  let userQuery: string | undefined

  try {
    const body = await request.json()
    const { query, conversationHistory = [] } = body as {
      query: string
      conversationHistory?: ChatMessage[]
    }
    userQuery = query
    userEmail = body.email

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      )
    }

    // Build live hospital context from Firestore
    const [hospitalContext, bookedContext] = await Promise.all([
      buildHospitalContext(),
      getBookedSlotsContext(),
    ])

    // --- Fetch patient's own appointments if email is provided ---
    let patientAppointmentsContext = ''
    if (body.email) {
      try {
        const appointments = await getAllAppointments()
        const patientApts = appointments.filter(
          a => a.patientEmail?.toLowerCase() === body.email?.toLowerCase() && a.status === 'scheduled'
        )
        if (patientApts.length > 0) {
          const lines = patientApts.map(a =>
            `  id:${a.id} | ${a.doctorName} | ${a.date} at ${a.time} | ${a.service} | status:${a.status}`
          ).join('\n')
          patientAppointmentsContext = `\n\n=== THIS PATIENT'S UPCOMING APPOINTMENTS ===\n${lines}\n(Use these IDs when the patient wants to cancel or reschedule)`
        }
      } catch {}
    }

    const systemPrompt = `You are MediCare AI, a helpful hospital assistant chatbot.
You help patients with doctor availability, appointment information, insurance coverage, department locations, visiting hours, and general hospital queries.
You can also help patients cancel or reschedule their own appointments.

Use ONLY the data below to answer questions — do not invent doctors, departments, or prices.
Be conversational, empathetic, and concise. Format slot times clearly (e.g. "9:00 AM").
If you cannot answer from the data provided, set needsEscalation to true.

${hospitalContext}${bookedContext}${patientAppointmentsContext}

IMPORTANT RULES:
- For billing/account-specific questions: always escalate.
- For questions about doctors/departments/insurance NOT in the data: escalate.
- When listing available slots, exclude any marked as already booked.
- LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply in that SAME language. If the user writes in Hindi, reply in Hindi. If in Tamil, reply in Tamil. If in English, reply in English. Mirror the user's language exactly in the "message" field. Keep structured data fields (doctor names, times, dates) in their original form.
- CRITICAL: When the user wants to BOOK an appointment with any doctor, you MUST ALWAYS include a structuredResult with type "doctor_availability" containing the full doctor object and their availableSlots for today (or the requested date). This is mandatory — the "Book Appointment" button is ONLY rendered by the UI when this structuredResult is present. Never just tell them to click a button without emitting this result.
- If the user wants to CANCEL an appointment: find their appointment from THIS PATIENT'S UPCOMING APPOINTMENTS and return a manage_appointment structuredResult with action "cancel".
- If the user wants to RESCHEDULE: return a manage_appointment structuredResult with action "reschedule" and include available slots for them to pick from.
- If the patient has no appointments, tell them so kindly.

You MUST respond ONLY with valid JSON — no markdown, no backticks, no extra text whatsoever.
Use this exact schema:
{
  "message": "Your friendly response to the user",
  "intent": "one of: check_availability | check_insurance | visiting_hours | find_location | billing_query | department_info | cancel_appointment | reschedule_appointment | general | unknown",
  "needsEscalation": false,
  "escalationReason": "only include this field if needsEscalation is true",
  "structuredResults": [
    {
      "type": "doctor_availability | insurance_coverage | visiting_hours | location | department_info | manage_appointment",
      "data": {
        "doctor": {
           "id": "string",
           "name": "string",
           "specialty": "string",
           "department": "string",
           "roomNumber": "string",
           "consultationFee": 0
        },
        "availableSlots": ["9:00 AM"],
        "date": "2023-11-01",
        "procedure": "human-readable procedure name e.g. Knee Consultation",
        "allInsurers": [
          {
            "name": "ICICI Lombard",
            "covered": true,
            "coveragePercentage": 80,
            "networkType": "Preferred"
          }
        ],
        "appointment": {
          "id": "apt-xxx",
          "doctorName": "string",
          "date": "2023-11-01",
          "time": "09:00",
          "service": "string",
          "status": "scheduled"
        },
        "action": "cancel or reschedule"
      },
      "message": "short human-readable summary"
    }
  ]
}

INSURANCE RULE: When intent is check_insurance, ALWAYS return a structuredResult of type "insurance_coverage" with "allInsurers" populated — include EVERY insurer from the insurance data showing whether each one covers the procedure (covered: true/false), their coverage percentage, and network type. Never return just a single insurer — always return the full list.`

    // Convert conversation history: 'assistant' → 'model' for Gemini API
    const geminiHistory = conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // Call Gemini with automatic retry on quota errors
    const raw = await callGeminiWithRetry(query, systemPrompt, geminiHistory)

    let parsed: ParsedAIResponse
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean) as ParsedAIResponse
    } catch {
      parsed = {
        message: "I'm sorry, I had trouble processing that. Please try again.",
        intent: 'unknown',
        needsEscalation: true,
        escalationReason: 'JSON parse error from AI',
      }
    }

    // Log escalated queries for admin review
    if (parsed.needsEscalation) {
      await logUnansweredQuery(query, parsed.escalationReason ?? 'Escalated by AI')
    }

    // Persist chat history if an email is provided
    if (body.email) {
      try {
        const existing = await getChatSession(body.email)
        const existingMessages = existing?.messages ?? []

        const timestamp = Date.now()
        const userMsg: DbChatMessage = { id: `u-${timestamp}`, type: 'user', content: query, timestamp }
        const aiMsg: DbChatMessage = { id: `a-${timestamp}`, type: 'assistant', content: parsed.message, timestamp }

        existingMessages.push(userMsg, aiMsg)
        await saveChatSession(body.email, existingMessages, new Date().toISOString())
      } catch (err) {
        console.error('Failed to save chat history:', err)
      }
    }

    return NextResponse.json({
      success: !parsed.needsEscalation,
      message: parsed.message,
      intent: parsed.intent,
      results: parsed.structuredResults ?? [],
      totalResults: (parsed.structuredResults ?? []).length,
      needsEscalation: parsed.needsEscalation,
      escalationReason: parsed.escalationReason,
      suggestedAction: parsed.needsEscalation ? 'create_callback' : undefined,
    })

  } catch (error: unknown) {
    console.error('Chat API error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    // ── ALWAYS save the user's message, even when the AI call fails ──────
    if (userEmail && userQuery) {
      try {
        const existing = await getChatSession(userEmail)
        const existingMessages = existing?.messages ?? []

        const timestamp = Date.now()
        const userMsg: DbChatMessage = { id: `u-${timestamp}`, type: 'user', content: userQuery, timestamp }

        // Determine a human-friendly error reply to persist
        let errorReply = "I'm sorry, something went wrong. Please try again."
        if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
          errorReply = "I'm temporarily overloaded. Please try again in a moment."
        }
        const aiMsg: DbChatMessage = { id: `a-${timestamp}`, type: 'assistant', content: errorReply, timestamp }

        existingMessages.push(userMsg, aiMsg)
        await saveChatSession(userEmail, existingMessages, new Date().toISOString())
      } catch (saveErr) {
        console.error('Failed to save chat history on error path:', saveErr)
      }
    }

    if (message.includes('API_KEY_INVALID') || message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local' },
        { status: 401 }
      )
    }
    if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Gemini quota reached. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 })
  }
}
