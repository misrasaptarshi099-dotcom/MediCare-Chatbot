import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildHospitalContext,
  getAllAppointments,
  addUnansweredQuery,
  getChatSession,
  appendChatMessages,
  getInsurancePartners,
  getDoctors,
  type Appointment,
  type UnansweredQuery,
  type ChatMessage as DbChatMessage,
} from '@/lib/db'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { validateInput, sanitizeHtml } from '@/lib/sanitize'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite'

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

// ── Helper: detect "list all coverage by department" intent ────────────────────
function isAllDepartmentCoverageQuery(query: string): boolean {
  const q = query.toLowerCase()
  const hasListAll = /list all|show all|all coverage|all insurance|all department/.test(q)
  const hasDept = /department|specialty|all of them|each department|per department|by department/.test(q)
  const hasCoverage = /cover|insurance|insur/.test(q)
  // "list one department then all the insurance … another department" type queries
  const isExplicitMulti = /one department.*another|department.*then.*department|each|per/.test(q)
  return (hasListAll && (hasDept || hasCoverage)) || isExplicitMulti
}

// ── Department → procedure slug mapping ───────────────────────────────────────
// Maps department/specialty keywords to the procedure slugs used in insurance data.
const DEPT_PROCEDURE_MAP: Record<string, string[]> = {
  orthoped:   ['knee-consultation', 'knee-surgery'],
  cardio:     ['heart-checkup', 'heart-surgery'],
  neuro:      ['neuro-consultation', 'neuro-surgery'],
  pathol:     ['blood-test'],
  radiol:     ['x-ray', 'mri-scan', 'ct-scan', 'ultrasound'],
  pediat:     ['pediatric-checkup'],
  blood:      ['blood-test'],
  'x-ray':    ['x-ray', 'mri-scan', 'ct-scan', 'ultrasound'],
}

function getProcedureSlugsForDept(specialty: string): string[] {
  const s = specialty.toLowerCase()
  for (const [key, slugs] of Object.entries(DEPT_PROCEDURE_MAP)) {
    if (s.includes(key)) return slugs
  }
  return [] // unknown specialty — will result in "not covered" unless insurer covers something
}

// ── Helper: build all-department coverage results from DB ─────────────────────
async function buildAllDepartmentCoverageResults() {
  const [insurers, doctors] = await Promise.all([getInsurancePartners(), getDoctors()])

  // Build unique departments with their specialty and display label
  const deptMap = new Map<string, { label: string; slugs: string[] }>()
  for (const doc of doctors) {
    if (!deptMap.has(doc.department)) {
      const slugs = getProcedureSlugsForDept(doc.specialty || doc.department)
      deptMap.set(doc.department, { label: doc.specialty || doc.department, slugs })
    }
  }
  // Ensure diagnostic departments are included
  if (!deptMap.has('Blood Testing')) {
    deptMap.set('Blood Testing', { label: 'Blood Testing', slugs: ['blood-test'] })
  }
  if (!deptMap.has('X-Ray & Imaging')) {
    deptMap.set('X-Ray & Imaging', { label: 'X-Ray & Imaging', slugs: ['x-ray', 'mri-scan', 'ct-scan', 'ultrasound'] })
  }

  const structuredResults = []
  for (const [department, { label, slugs }] of deptMap.entries()) {
    const allInsurers = insurers.map(ins => {
      // An insurer covers this department if ANY of the department's procedure slugs
      // appear in the insurer's proceduresCovered list.
      const covered = slugs.length > 0 && ins.proceduresCovered.some(p => slugs.includes(p))
      return {
        name: ins.name,
        covered,
        coveragePercentage: covered ? ins.coveragePercentage : 0,
        networkType: ins.networkType,
      }
    })

    structuredResults.push({
      type: 'insurance_coverage',
      data: {
        procedure: `${department} — ${label}`,
        allInsurers,
      },
      message: `Insurance coverage for ${department}`,
    })
  }

  return structuredResults
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
      maxOutputTokens: 4096,
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
        const delayMs = Math.pow(2, attempt + 1) * 1000
        console.warn(`Gemini quota hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      throw err
    }
  }
  throw lastError
}

// ── Build system prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(hospitalContext: string, bookedContext: string, patientAppointmentsContext: string): string {
  return [
    'You are MediCare AI, a helpful hospital assistant chatbot.',
    'You help patients with doctor availability, appointment information, insurance coverage, department locations, visiting hours, and general hospital queries.',
    'You can also help patients cancel or reschedule their own appointments.',
    '',
    'Use ONLY the data below to answer questions — do not invent doctors, departments, or prices.',
    'Be conversational, empathetic, and concise. Format slot times clearly (e.g. "9:00 AM").',
    'If you cannot answer from the data provided, set needsEscalation to true.',
    '',
    hospitalContext + bookedContext + patientAppointmentsContext,
    '',
    '=== CONVERSATION CONTEXT RULES (READ CAREFULLY) ===',
    'You have access to the full conversation history. Use it aggressively to resolve ambiguity:',
    '- If the user says "it", "this", "that", or "the same" — resolve the pronoun from recent messages.',
    '  Example: if they just asked about a Knee Consultation, "it" means Knee Consultation.',
    '- If the user says "this doctor" or "the doctor" — use the doctor most recently discussed.',
    '- If the user says "this department" or "that specialty" — use the department/specialty most recently mentioned.',
    '- If a query is vague, make a reasonable inference from context rather than asking for clarification repeatedly.',
    '- If the user has already been asked for clarification and asks something similar again, make your best inference and answer — do NOT ask again.',
    '',
    '=== INSURANCE RULES ===',
    '- ANY question about insurance, coverage, or whether a procedure/treatment is covered triggers intent "check_insurance".',
    '- ALWAYS return a structuredResult with type "insurance_coverage".',
    '- Populate "allInsurers" with EVERY insurer from the INSURANCE PARTNERS data — never omit any.',
    '- Each insurer must have: name, covered (true/false based on whether the procedure is in their proceduresCovered list), coveragePercentage, networkType.',
    '- Infer the "procedure" from conversation context:',
    '  - If the user last asked about Dr. Mehta (Orthopedic) → procedure = "Orthopedic Surgery"',
    '  - If the user says "this department" → use whatever department was last discussed',
    '  - If no specific procedure can be inferred → use "General Services" and mark all as covered',
    '- NEVER ask for clarification before returning the insurance card. Always make your best inference.',
    '- "List all coverages", "show all insurance", "what is covered" → return insurance_coverage with ALL insurers.',
    '- Questions about a specific insurer (e.g. "does Tata AIG cover it?") → still return ALL insurers in allInsurers, but mention the specific insurer in your message.',
    '',
    '=== BOOKING, CANCELLATION & RESCHEDULING RULES ===',
    '- When the user wants to BOOK a doctor appointment: ALWAYS include a structuredResult with type "doctor_availability" containing the full doctor object and availabilityByDay. This is mandatory — the Book Appointment button ONLY renders when this is present.',
    '- IMPORTANT: If the user wants to BOOK a lab test, blood test, CBC, MRI, X-Ray, or diagnostic service, DO NOT return "doctor_availability". Return a "diagnostics_info" structuredResult instead.',
    '- CANCEL: return manage_appointment with action "cancel". RESCHEDULE: return manage_appointment with action "reschedule".',
    '- If the patient has no appointments, tell them kindly.',
    '',
    '=== GENERAL RULES ===',
    '- For billing/account-specific questions: always escalate.',
    '- When listing available slots, exclude any already booked.',
    '- LANGUAGE RULE: Detect the user\'s language and reply in the SAME language. Mirror it exactly in the "message" field. Keep structured data (doctor names, times, dates) in their original form.',
    '- NEVER respond with a generic error or "I had trouble processing that" when the data is available. Always attempt to answer from context and data.',
    '',
    'You MUST respond ONLY with valid JSON — no markdown, no backticks, no extra text whatsoever.',
    'Use this exact schema:',
    '{',
    '  "message": "Your friendly response to the user",',
    '  "intent": "one of: check_availability | check_insurance | visiting_hours | find_location | billing_query | department_info | cancel_appointment | reschedule_appointment | general | unknown",',
    '  "needsEscalation": false,',
    '  "escalationReason": "only include this field if needsEscalation is true",',
    '  "structuredResults": [',
    '    {',
    '      "type": "doctor_availability | insurance_coverage | visiting_hours | location | department_info | manage_appointment | diagnostics_info",',
    '      "data": {',
    '        "doctor": { "id": "string", "name": "string", "specialty": "string", "department": "string", "roomNumber": "string", "consultationFee": 0 },',
    '        "availableSlots": ["9:00 AM"],',
    '        "availabilityByDay": [{ "day": "Monday", "slots": ["9:00 AM", "10:00 AM"] }],',
    '        "date": "2023-11-01",',
    '        "procedure": "human-readable procedure name e.g. Knee Consultation",',
    '        "allInsurers": [{ "name": "ICICI Lombard", "covered": true, "coveragePercentage": 80, "networkType": "Preferred" }],',
    '        "appointment": { "id": "apt-xxx", "doctorName": "string", "date": "2023-11-01", "time": "09:00", "service": "string", "status": "scheduled" },',
    '        "action": "cancel or reschedule",',
    '        "diagnosticType": "blood_test | xray",',
    '        "tests": [{ "name": "Complete Blood Count (CBC)", "duration": "30", "basePrice": 400 }]',
    '      },',
    '      "message": "short human-readable summary"',
    '    }',
    '  ]',
    '}',
    '',
    'DIAGNOSTICS RULE: When asked to book, check, or inquire about blood tests, lab tests, CBC, MRI, ultrasound, or x-rays, ALWAYS return a structuredResult of type "diagnostics_info" with "diagnosticType" set to either "blood_test" or "xray" and a "tests" array populated with the available tests from the SERVICES & PRICING data. NEVER list the tests in plain text.',
    'DOCTOR AVAILABILITY RULE: When asked about a doctor\'s availability, ALWAYS return a structuredResult of type "doctor_availability" with "availabilityByDay" populated with the days and slots. NEVER list the availability in plain text.',
  ].join('\n')
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
import { adminAuth } from '@/lib/firebase-admin'

export async function POST(request: Request) {
  let userUid: string | undefined
  let userQuery: string | undefined

  try {
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1]
      try {
        const decodedToken = await adminAuth.verifyIdToken(token)
        userUid = decodedToken.uid
      } catch (e) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    }

    const body = await request.json()
    const { query, conversationHistory = [] } = body as {
      query: string
      conversationHistory?: any[]
    }
    userQuery = query
    
    // If no verified userUid is present but body.uid is, block it to prevent impersonation
    if (!userUid && body.uid) {
       return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 })
    }

    if (userUid && body.uid && userUid !== body.uid) {
      return NextResponse.json({ error: 'Unauthorized: uid mismatch' }, { status: 401 })
    }

    const effectiveUid = userUid || body.uid

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // ── INPUT SANITIZATION ─────────────────────────────────────────────────
    const sanitizedQuery = sanitizeHtml(query.slice(0, 1000))
    if (!sanitizedQuery) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // ── RATE LIMITING ──────────────────────────────────────────────────────
    const rateLimitId = effectiveUid || getClientIp(request)

    // 5 messages per minute
    const minuteCheck = checkRateLimit(rateLimitKey('chat-min', rateLimitId), 5, 60 * 1000)
    if (!minuteCheck.allowed) {
      return NextResponse.json(
        { error: 'You are sending messages too quickly. Please wait a moment.' },
        { status: 429 }
      )
    }

    // 30 messages per day
    const dailyCheck = checkRateLimit(rateLimitKey('chat-day', rateLimitId), 30, 24 * 60 * 60 * 1000)
    if (!dailyCheck.allowed) {
      return NextResponse.json(
        { error: 'You have reached your daily message limit. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      )
    }

    // ── SHORT-CIRCUIT: All-department coverage query ───────────────────────────
    // This type of query reliably overflows the AI's token budget, so we handle
    // it directly from the database instead of sending it to Gemini.
    if (isAllDepartmentCoverageQuery(query)) {
      const allCoverageResults = await buildAllDepartmentCoverageResults()
      const responseMessage = `Here's a full breakdown of insurance coverage for each department at MediCare. Each card shows which insurers cover that department's services and at what percentage.`

      // Persist chat history
      if (effectiveUid) {
        try {
          const existing = await getChatSession(effectiveUid)
          const existingMessages = existing?.messages ?? []
          const timestamp = Date.now()
          const newMsgs: DbChatMessage[] = [
            { id: `u-${timestamp}`, type: 'user', content: sanitizedQuery, timestamp },
            { id: `a-${timestamp}`, type: 'assistant', content: responseMessage, timestamp }
          ]
          await appendChatMessages(effectiveUid, newMsgs, new Date().toISOString())
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: responseMessage,
        intent: 'check_insurance',
        results: allCoverageResults,
        totalResults: allCoverageResults.length,
        needsEscalation: false,
      })
    }

    // Build live hospital context from Firestore
    const [hospitalContext, bookedContext] = await Promise.all([
      buildHospitalContext(),
      getBookedSlotsContext(),
    ])

    // --- Fetch patient's own appointments if uid is provided ---
    let patientAppointmentsContext = ''
    if (effectiveUid) {
      try {
        const appointments = await getAllAppointments()
        const patientApts = appointments.filter(
          a => (a.patientUid === effectiveUid || (body.email && a.patientEmail?.toLowerCase() === body.email?.toLowerCase())) && a.status === 'scheduled'
        )
        if (patientApts.length > 0) {
          const lines = patientApts.map(a =>
            `  id:${a.id} | ${a.doctorName} | ${a.date} at ${a.time} | ${a.service} | status:${a.status}`
          ).join('\n')
          patientAppointmentsContext = `\n\n=== THIS PATIENT'S UPCOMING APPOINTMENTS ===\n${lines}\n(Use these IDs when the patient wants to cancel or reschedule)`
        }
      } catch {}
    }

    const systemPrompt = buildSystemPrompt(hospitalContext, bookedContext, patientAppointmentsContext)

    // Convert conversation history: 'assistant' → 'model' for Gemini API
    const geminiHistory = conversationHistory.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // Call Gemini with automatic retry on quota errors
    const raw = await callGeminiWithRetry(sanitizedQuery, systemPrompt, geminiHistory)

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
      await logUnansweredQuery(sanitizedQuery, parsed.escalationReason ?? 'Escalated by AI')
    }

    // Persist chat history if a UID is provided
    if (effectiveUid) {
      try {
        const existing = await getChatSession(effectiveUid)
        const existingMessages = existing?.messages ?? []

        const timestamp = Date.now()
        const userMsg: DbChatMessage = { id: `u-${timestamp}`, type: 'user', content: sanitizedQuery, timestamp }
        const aiMsg: DbChatMessage = { id: `a-${timestamp}`, type: 'assistant', content: parsed.message, timestamp }

        await appendChatMessages(effectiveUid, [userMsg, aiMsg], new Date().toISOString())
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
    if (userUid && userQuery) {
      try {
        const existing = await getChatSession(userUid)
        const existingMessages = existing?.messages ?? []

        const timestamp = Date.now()
        const userMsg: DbChatMessage = { id: `u-${timestamp}`, type: 'user', content: userQuery, timestamp }

        let errorReply = "I'm sorry, something went wrong. Please try again."
        if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
          errorReply = "I'm temporarily overloaded. Please try again in a moment."
        }
        const aiMsg: DbChatMessage = { id: `a-${timestamp}`, type: 'assistant', content: errorReply, timestamp }

        await appendChatMessages(userUid, [userMsg, aiMsg], new Date().toISOString())
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
