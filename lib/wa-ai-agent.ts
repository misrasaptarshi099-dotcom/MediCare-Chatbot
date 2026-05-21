import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, FunctionCall } from '@google/generative-ai'
import {
  getDoctors,
  getAllAppointments,
  addAppointment,
  getPatientReportsByUid,
  getPatientByIdentifier,
  updateAppointmentStatus,
  getChatSession,
  appendChatMessages,
  addCallbackTicket,
  type ChatMessage as DbChatMessage
} from './db'
import { WaSession, setWaSession } from './wa-session'
import { sendTextMessage } from './whatsapp'
import { startBookingFlow, handleBookDept, handleBookDoctor, handleBookDate } from './wa-flows'

export async function processAiMessage(from: string, input: string, session: WaSession, hospitalContext: string): Promise<void> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

  // ── Define Tools ──
  const searchDoctorsFunc: FunctionDeclaration = {
    name: 'search_doctors',
    description: 'Find doctors by department or specialty. Returns a list of matching doctors.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        department: { type: SchemaType.STRING, description: 'Department name (e.g., Cardiology, Pathology)' },
      }
    }
  }

  const checkAvailabilityFunc: FunctionDeclaration = {
    name: 'check_availability',
    description: 'Check a doctor\'s available time slots for a specific date.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        doctorId: { type: SchemaType.STRING, description: 'The ID of the doctor' },
        date: { type: SchemaType.STRING, description: 'Date in YYYY-MM-DD format' }
      },
      required: ['doctorId', 'date']
    }
  }

  const bookAppointmentFunc: FunctionDeclaration = {
    name: 'book_appointment',
    description: 'Book a confirmed appointment or join waitlist for a specific doctor, date, and time. Waitlists are handled automatically if the slot is full.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        doctorId: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        time: { type: SchemaType.STRING, description: 'HH:mm format (e.g. 14:30)' },
        service: { type: SchemaType.STRING, description: 'The type of service, e.g. "General Consultation", "Blood Tests (CBC)", "X-Ray". Default is "General Consultation".' },
        amount: { type: SchemaType.NUMBER, description: "The total cost of the services booked in INR. Default is the doctor's consultation fee." }
      },
      required: ['doctorId', 'date', 'time', 'service']
    }
  }

  const cancelAppointmentFunc: FunctionDeclaration = {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        appointmentId: { type: SchemaType.STRING }
      },
      required: ['appointmentId']
    }
  }

  const routeToInteractiveFlowFunc: FunctionDeclaration = {
    name: 'route_to_interactive_flow',
    description: 'Transitions the user to the interactive button/list booking flow in WhatsApp. Use this if the user wants to browse options manually instead of conversational booking.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        departmentId: { type: SchemaType.STRING, description: 'Optional department ID to skip directly to doctor selection' },
        doctorId: { type: SchemaType.STRING, description: 'Optional doctor ID to skip directly to date selection' }
      }
    }
  }

  const requestCallbackFunc: FunctionDeclaration = {
    name: 'request_callback',
    description: 'Creates a support ticket for a hospital representative to call the user back regarding a specific query or issue.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        querySummary: { type: SchemaType.STRING, description: 'A short summary of what the user needs help with' },
        department: { type: SchemaType.STRING, description: 'The department the user needs to speak to (or "General")' }
      },
      required: ['querySummary']
    }
  }

  let patientAppointmentsContext = ''
  let patientReportsContext = ''
  if (session.patientUid) {
    try {
      const [appointments, reports] = await Promise.all([
        getAllAppointments(),
        getPatientReportsByUid(session.patientUid)
      ])
      const patientApts = appointments.filter(
        a => a.patientUid === session.patientUid && a.status === 'scheduled'
      )
      if (patientApts.length > 0) {
        const lines = patientApts.map(a =>
          `  - ID: ${a.id} | Dr. ${a.doctorName} | ${a.date} at ${a.time} | ${a.service} | Booking Status: ${a.status} | Payment Status: ${a.paymentStatus} | Fee: ₹${a.amount} | Payment Link: https://medi-care-chatbot.vercel.app/pay?aptId=${a.id}`
        ).join('\n')
        patientAppointmentsContext = `\n\n=== THIS PATIENT'S UPCOMING APPOINTMENTS ===\n${lines}\n(Use these IDs when the patient wants to cancel or reschedule. If an appointment is unpaid, provide them with the Payment Link so they can pay.)`
      }
      if (reports.length > 0) {
        const lines = reports.map(r => 
          `  - ${r.testName} | Date: ${(r as any).createdAt ? new Date((r as any).createdAt).toLocaleDateString() : 'N/A'}`
        ).join('\n')
        patientReportsContext = `\n\n=== THIS PATIENT'S LAB REPORTS ===\n${lines}\n(NEVER share internal file URLs or storage links. To download reports, tell the user to type "menu" and select "My Lab Reports", or visit the patient portal at https://medi-care-chatbot.vercel.app)`
      }
    } catch {}
  }

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite',
    systemInstruction: [
      'You are MediCare AI, an advanced hospital agent on WhatsApp.',
      'You can have free-rein to converse, answer questions, and book appointments using your tools.',
      'Always confirm details (Doctor, Date, Time) before calling book_appointment.',
      'CRITICAL: You MUST actually call the book_appointment tool to make a booking. NEVER hallucinate or invent appointment IDs or payment links yourself.',
      'Only after the tool returns the real appointment ID and payment link should you state the total amount to be paid and provide the real link to the user.',
      'If the user wants to see menus or buttons, you can call route_to_interactive_flow.',
      'Keep responses concise for WhatsApp. Use plain text and emojis. NO MARKDOWN (no **, ##).',
      'SECURITY: NEVER share internal URLs (storage.googleapis.com, firebasestorage.app), patient UIDs, or any backend identifiers with the user. Only share public-facing links (medi-care-chatbot.vercel.app).',
      `Current Date: ${new Date().toISOString().split('T')[0]}`,
      '---',
      hospitalContext,
      patientAppointmentsContext,
      patientReportsContext
    ].join('\n'),
    tools: [{
      functionDeclarations: [
        searchDoctorsFunc,
        checkAvailabilityFunc,
        bookAppointmentFunc,
        cancelAppointmentFunc,
        routeToInteractiveFlowFunc,
        requestCallbackFunc
      ]
    }],
    generationConfig: { temperature: 0.2 }
  })

  // Fetch existing chat history from the same collection the website uses
  let existingMessages: DbChatMessage[] = []
  let geminiHistory: any[] = []
  
  if (session.patientUid) {
    try {
      const existing = await getChatSession(session.patientUid)
      existingMessages = existing?.messages ?? []
      geminiHistory = existingMessages.map(m => ({
        role: m.type === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
    } catch (e) {
      console.error('Failed to load chat history:', e)
    }
  }

  const chat = model.startChat({ history: geminiHistory })
  const result = await chat.sendMessage(input)
  
  let currentResult = result
  let responseText = ''

  while (true) {
    try {
      responseText = currentResult.response.text()
    } catch (e) {
      // result.response.text() throws if it contains only function calls
    }

    const functionCalls = currentResult.response.functionCalls()
    if (!functionCalls || functionCalls.length === 0) {
      break
    }

    const functionResponses: any[] = []

    for (const call of functionCalls) {
      let functionResponse: any = {}

      try {
        if (call.name === 'search_doctors') {
          const { department } = call.args as any
          const allDocs = await getDoctors()
          const matches = department 
            ? allDocs.filter(d => d.department.toLowerCase().includes(department.toLowerCase()))
            : allDocs
          functionResponse = { doctors: matches.map(d => ({ id: d.id, name: d.name, specialty: d.specialty, fee: d.consultationFee })) }
        } 
        else if (call.name === 'check_availability') {
          const { doctorId, date } = call.args as any
          const doc = (await getDoctors()).find(d => d.id === doctorId || d.name.toLowerCase().includes(String(doctorId).toLowerCase()))
          
          if (!doc) {
            functionResponse = { error: 'Doctor not found. Ensure you are using a valid Doctor ID.' }
          } else {
            const [year, month, day] = date.split('-').map(Number)
            const dateObj = new Date(Date.UTC(year, month - 1, day))
            const formattedDate = dateObj.toISOString().split('T')[0]
            
            if (formattedDate !== date) {
              functionResponse = { error: 'Invalid date. Please provide a valid calendar date in YYYY-MM-DD format.' }
            } else {
              const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase()
              const allSlots = doc.availability[dayOfWeek] || []
              
              const appointments = await getAllAppointments()
              const bookedTimes = new Set(appointments.filter(a => a.doctorId === doc.id && a.date === date && a.status === 'scheduled').map(a => a.time))
              
              const slots = allSlots.map(time => {
                const isBooked = bookedTimes.has(time)
                return { time, status: isBooked ? 'waitlist' : 'available' }
              })
              functionResponse = { date, doctorId: doc.id, doctorName: doc.name, slots }
            }
          }
        }
        else if (call.name === 'book_appointment') {
          const { doctorId, date, time, service } = call.args as any
          const doc = (await getDoctors()).find(d => d.id === doctorId || d.name.toLowerCase().includes(String(doctorId).toLowerCase()))
          
          if (!doc) {
            functionResponse = { error: 'Doctor not found. Ensure you are using a valid Doctor ID.' }
          } else {
            // Validate Date
            const [year, month, day] = date.split('-').map(Number)
            const dateObj = new Date(Date.UTC(year, month - 1, day))
            if (dateObj.toISOString().split('T')[0] !== date) {
              functionResponse = { error: 'Invalid date. Please provide a valid calendar date in YYYY-MM-DD format.' }
              continue
            }

            // Derive server-side pricing
            let finalAmount = doc.consultationFee
            if (doctorId.startsWith('LAB-')) {
              const { getServices } = await import('./db')
              const allServices = await getServices()
              const matchedService = allServices.find(s => s.id === doctorId.replace('LAB-', '') || s.name.toLowerCase() === (service || '').toLowerCase())
              if (matchedService) finalAmount = matchedService.basePrice
            }
            if (typeof finalAmount !== 'number' || isNaN(finalAmount)) {
              finalAmount = 500 // safe fallback
            }

            const newId = `apt-${Date.now()}`
            const normalizedPhone = from.startsWith('+') ? from : `+${from}`

            const { addAppointmentTransactional } = await import('./db')
            const { status: finalStatus } = await addAppointmentTransactional({
              id: newId,
              patientName: session.patientName || 'WhatsApp Patient',
              patientPhone: normalizedPhone,
              patientEmail: '',
              patientUid: session.patientUid,
              doctorId: doc.id,
              doctorName: doc.name,
              date,
              time,
              service: service || 'General Consultation',
              status: 'scheduled',
              amount: finalAmount,
              paymentStatus: 'unpaid',
              createdAt: new Date().toISOString()
            })
            
            functionResponse = { 
              success: true, 
              appointmentId: newId, 
              status: finalStatus,
              paymentLink: `https://medi-care-chatbot.vercel.app/pay?aptId=${newId}`,
              amountToBePaid: finalAmount
            }
          }
        }
        else if (call.name === 'cancel_appointment') {
          const { appointmentId } = call.args as any
          await updateAppointmentStatus(appointmentId, 'cancelled')
          functionResponse = { success: true }
        }
        else if (call.name === 'route_to_interactive_flow') {
          const { departmentId, doctorId } = call.args as any
          if (doctorId) {
            await handleBookDoctor(from, `doc_${doctorId}`, session)
          } else if (departmentId) {
            await handleBookDept(from, `dept_${departmentId}`, session)
          } else {
            await startBookingFlow(from, session)
          }
          // Early return because the interactive flow functions handle sending the message
          return
        }
        else if (call.name === 'request_callback') {
          const { querySummary, department } = call.args as any
          const newId = `cb-${Date.now()}`
          await addCallbackTicket({
            id: newId,
            patientName: session.patientName || 'WhatsApp User',
            patientPhone: from.startsWith('+') ? from : `+${from}`,
            patientEmail: '',
            patientUid: session.patientUid,
            querySummary,
            department: department || 'General',
            status: 'pending',
            createdAt: new Date().toISOString()
          })
          functionResponse = { success: true, ticketId: newId, message: 'Callback requested successfully.' }
        }
      } catch (e: any) {
        console.error(`Agent Tool Error (${call.name}):`, e)
        functionResponse = { error: 'I encountered an error while processing that request.' }
      }

      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: functionResponse
        }
      })
    }

    // Send all function responses back to Gemini to get the next turn
    currentResult = await chat.sendMessage(functionResponses)
  }

  if (responseText) {
    const finalMsg = responseText.slice(0, 4096)
    await sendTextMessage(from, finalMsg)
    
    // Save conversation to DB so website and WhatsApp share the same history
    if (session.patientUid) {
      try {
        const timestamp = Date.now()
        const newMsgs: DbChatMessage[] = [
          { id: `wa-u-${timestamp}`, type: 'user', content: input, timestamp },
          { id: `wa-a-${timestamp}`, type: 'assistant', content: finalMsg, timestamp }
        ]
        await appendChatMessages(session.patientUid, newMsgs, new Date().toISOString())
      } catch (e) {
        console.error('Failed to save chat history:', e)
      }
    }
  }
}
