/**
 * WhatsApp Conversation Flows — State Machine
 *
 * Routes incoming messages/button clicks to the correct handler
 * based on the patient's current session step. Each handler:
 *   1. Reads the session from Firestore
 *   2. Processes the user's reply
 *   3. Sends the next interactive message via WhatsApp
 *   4. Updates the session step
 */

import {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendDocumentMessage,
  type ListSection,
} from './whatsapp'
import {
  getWaSession,
  setWaSession,
  resetWaSession,
  type WaSession,
} from './wa-session'
import {
  getDepartments,
  getDoctors,
  getAllAppointments,
  addAppointment,
  addAppointmentTransactional,
  getPatientByIdentifier,
  createOrUpdatePatient,
  getPatientReportsByUid,
  addCallbackTicket,
  buildHospitalContext,
  type Appointment,
} from './db'

// ── Incoming Message Types ────────────────────────────────────────────────────

export interface IncomingMessage {
  from: string      // E.164 phone number (no whatsapp: prefix)
  messageId: string
  type: 'text' | 'interactive'
  text?: string
  buttonReplyId?: string
  listReplyId?: string
}

// ── Main Router ───────────────────────────────────────────────────────────────

export async function handleWhatsAppMessage(msg: IncomingMessage): Promise<void> {
  const { from } = msg
  const input = extractUserInput(msg)

  // Fetch or create session
  let session = await getWaSession(from)
  if (!session) {
    // Auto-link patient from existing database if phone number matches
    let patient = await getPatientByIdentifier(from)
    
    // ── Auto-Registration (Lazy Onboarding) ──
    if (!patient) {
      // Generate a unique ID for the new WhatsApp patient
      const newUid = `wa-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
      
      patient = await createOrUpdatePatient({
        uid: newUid,
        name: '', // Empty so we know they need to provide one
        phone: from.startsWith('+') ? from : `+${from}`,
        authProviders: ['phone']
      })
    }

    if (!patient.name || patient.name === 'WhatsApp User') {
      await resetWaSession(from, patient.uid, '')
      await setWaSession(from, { step: 'ASK_NAME' })
      await sendTextMessage(from, 'Welcome to *MediCare Hospital* 🏥\nTo get started, please tell me your full name.')
      return
    } else {
      await resetWaSession(from, patient.uid, patient.name)
      session = (await getWaSession(from))!
    }
  }

  // Handle ASK_NAME state explicitly to prevent global resets from bypassing it
  if (session.step === 'ASK_NAME') {
    return handleAskName(from, input, session)
  }

  // Global reset commands
  const resetWords = ['menu', 'hi', 'hello', 'start', 'exit', '0', 'home']
  if (resetWords.includes(input.toLowerCase())) {
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  // Route to the correct handler based on current step
  switch (session.step) {
    case 'MAIN_MENU':
      return handleMainMenuChoice(from, input, session)
    case 'BOOK_DEPT':
      return handleBookDept(from, input, session)
    case 'BOOK_DOCTOR':
      return handleBookDoctor(from, input, session)
    case 'BOOK_DATE':
      return handleBookDate(from, input, session)
    case 'BOOK_SLOT':
      return handleBookSlot(from, input, session)
    case 'BOOK_CONFIRM':
      return handleBookConfirm(from, input, session)
    case 'VIEW_APPOINTMENTS':
      return handleViewAppointments(from, input, session)
    case 'VIEW_REPORTS':
      return handleViewReports(from, input, session)
    case 'REPORT_SELECT':
      return handleReportSelect(from, input, session)
    case 'AI_CHAT':
      return handleAiChat(from, input, session)
    case 'CALLBACK_DEPT':
      return handleCallbackDept(from, input, session)
    case 'CALLBACK_QUERY':
      return handleCallbackQuery(from, input, session)
    case 'BOOK_CUSTOM_DATE':
      return handleBookCustomDate(from, input, session)
    case 'ASK_EMAIL':
      return handleAskEmail(from, input, session)
    case 'VERIFY_EMAIL_OTP':
      return handleVerifyEmailOtp(from, input, session)
    default:
      await resetWaSession(from, session.patientUid, session.patientName)
      return sendMainMenu(from, session.patientName)
  }
}

// ── Onboarding ────────────────────────────────────────────────────────────────

async function handleAskName(from: string, input: string, session: WaSession): Promise<void> {
  const name = input.trim()
  if (name.length < 2) {
    await sendTextMessage(from, 'Please enter a valid full name.')
    return
  }

  if (session.patientUid) {
    await createOrUpdatePatient({ uid: session.patientUid, name })
  }

  await resetWaSession(from, session.patientUid, name)
  await sendMainMenu(from, name)
}

async function handleBookCustomDate(from: string, input: string, session: WaSession): Promise<void> {
  const selectedDate = input.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    await sendTextMessage(from, '❌ Invalid format. Please use YYYY-MM-DD (e.g., 2024-08-15).')
    return
  }
  // Proceed exactly as handleBookDate with the newly parsed date
  return handleBookDate(from, `date_${selectedDate}`, session)
}

async function handleAskEmail(from: string, input: string, session: WaSession): Promise<void> {
  const email = input.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await sendTextMessage(from, '❌ Invalid email format. Please try again.')
    return
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  // Store OTP in session temporarily
  await setWaSession(from, { 
    step: 'VERIFY_EMAIL_OTP', 
    data: { ...session.data, callbackDept: otp, selectedService: email } // Hacking existing fields to store otp and email
  })

  // Send OTP to email
  const { sendEmail } = await import('./reminder-email')
  await sendEmail(
    email,
    'Verify your Email - MediCare Hospital',
    `Your WhatsApp verification code is: ${otp}`,
    `<h3>Email Verification</h3><p>Your verification code for MediCare Hospital WhatsApp bot is: <strong>${otp}</strong></p>`
  ).catch(e => console.error('Failed to send OTP email', e))

  await sendTextMessage(from, `✉️ Verification code sent to *${email}*.\n\nPlease type the 6-digit code here to verify:`)
}

async function handleVerifyEmailOtp(from: string, input: string, session: WaSession): Promise<void> {
  const code = input.trim()
  const expectedOtp = session.data.callbackDept
  const emailToLink = session.data.selectedService

  if (code !== expectedOtp) {
    await sendTextMessage(from, '❌ Incorrect verification code. Please try again or type "menu" to cancel.')
    return
  }

  // Update patient record
  if (session.patientUid) {
    await createOrUpdatePatient({ uid: session.patientUid, email: emailToLink })
  }

  await sendTextMessage(from, `✅ *Email Linked Successfully!*\n\nYour reports and receipts will now also be available at ${emailToLink}.`)
  await resetWaSession(from, session.patientUid, session.patientName)
  await sendMainMenu(from, session.patientName)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractUserInput(msg: IncomingMessage): string {
  if (msg.buttonReplyId) return msg.buttonReplyId
  if (msg.listReplyId) return msg.listReplyId
  return msg.text?.trim() || ''
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── Main Menu ─────────────────────────────────────────────────────────────────

async function sendMainMenu(to: string, patientName?: string): Promise<void> {
  const greeting = patientName ? `Hello ${patientName}! 👋` : 'Hello! 👋'

  const sections: ListSection[] = [
    {
      title: 'Our Services',
      rows: [
        { id: 'menu_book', title: '🗓️ Book Appointment', description: 'Schedule a visit with a doctor' },
        { id: 'menu_appointments', title: '📋 My Appointments', description: 'View your upcoming appointments' },
        { id: 'menu_reports', title: '🧪 My Lab Reports', description: 'View & download your reports' },
        { id: 'menu_email', title: '📧 Link Email', description: 'Get reports & receipts via email' },
        { id: 'menu_ai', title: '💬 AI Doctor Chat', description: 'Ask health questions to our AI' },
        { id: 'menu_callback', title: '📞 Request Callback', description: 'Get a call from our staff' },
      ],
    },
  ]

  await sendListMessage(
    to,
    `${greeting}\n\nWelcome to *MediCare Hospital* 🏥\nHow can we help you today?`,
    'View Options',
    sections,
    undefined,
    'Reply "menu" anytime to return here',
  )
}

// ── Main Menu Choice Router ───────────────────────────────────────────────────

async function handleMainMenuChoice(from: string, input: string, session: WaSession): Promise<void> {
  switch (input) {
    case 'menu_book':
      return startBookingFlow(from, session)
    case 'menu_appointments':
      return startViewAppointments(from, session)
    case 'menu_reports':
      return startViewReports(from, session)
    case 'menu_email':
      await setWaSession(from, { step: 'ASK_EMAIL' })
      await sendTextMessage(from, '📧 *Link Email Address*\n\nPlease type your email address (e.g., patient@example.com):')
      return
    case 'menu_ai':
      await setWaSession(from, { step: 'AI_CHAT' })
      return sendTextMessage(from,
        '💬 *MediCare AI Doctor Chat*\n\n' +
        'Ask me any health question or hospital query. I\'m powered by Google Gemini AI and know everything about MediCare Hospital.\n\n' +
        '_Type "menu" to return to the main menu._'
      )
    case 'menu_callback':
      return startCallbackFlow(from, session)
    default:
      // If they type free text at the main menu, show the menu again
      return sendMainMenu(from, session.patientName)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOKING FLOW
// ═══════════════════════════════════════════════════════════════════════════════

export async function startBookingFlow(from: string, session: WaSession): Promise<void> {
  const departments = await getDepartments()

  if (departments.length === 0) {
    await sendTextMessage(from, 'Sorry, no departments are available at the moment. Please try again later.')
    return sendMainMenu(from, session.patientName)
  }

  // Store dept IDs for mapping the reply back
  const deptList = departments.map(d => d.id)
  await setWaSession(from, { step: 'BOOK_DEPT', data: { ...session.data, deptList } })

  const sections: ListSection[] = [
    {
      title: 'Departments',
      rows: departments.map(d => {
        const desc = d.description || d.location || ''
        return {
          id: `dept_${d.id}`,
          title: truncate(d.name, 24),
          ...(desc ? { description: truncate(desc, 72) } : {}),
        }
      }),
    },
  ]

  await sendListMessage(
    from,
    '🗓️ *Book an Appointment*\n\nPlease select a department:',
    'Select Department',
    sections,
  )
}

export async function handleBookDept(from: string, input: string, session: WaSession): Promise<void> {
  // input is like "dept_cardiology"
  const deptId = input.replace('dept_', '')
  const departments = await getDepartments()
  const dept = departments.find(d => d.id === deptId)

  if (!dept) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return startBookingFlow(from, session)
  }

  // Check if it's a lab department (Pathology or Radiology)
  const isLab = ['pathology', 'radiology'].includes(dept.name.toLowerCase())

  if (isLab) {
    const { getServices } = await import('./db')
    const allServices = await getServices()
    const deptServices = allServices.filter(s => s.departmentId === deptId || s.department === dept.name)

    if (deptServices.length === 0) {
      await sendTextMessage(from, `Sorry, no tests are currently available in ${dept.name}. Please try another department.`)
      return startBookingFlow(from, session)
    }

    await setWaSession(from, {
      step: 'BOOK_DOCTOR', // Reusing the same state to avoid too many new states
      data: {
        ...session.data,
        selectedDeptId: deptId,
        selectedDeptName: dept.name,
        // Using doctorList to store service IDs for simplicity
        doctorList: deptServices.map(s => s.id),
      },
    })

    const sections: ListSection[] = [
      {
        title: dept.name,
        rows: deptServices.map(s => ({
          id: `srv_${s.id}`,
          title: truncate(s.name, 24),
          description: truncate(`Fee: ₹${s.basePrice} | ${s.duration} mins`, 72),
        })).slice(0, 10),
      },
    ]

    await sendListMessage(
      from,
      `🔬 *Book a Lab Test*\n\nDepartment: ${dept.name}\nPlease select a test:`,
      'Select Test',
      sections,
    )
    return
  }

  // Find doctors in this department
  const allDoctors = await getDoctors()
  const deptDoctors = allDoctors.filter(d => d.departmentId === deptId || d.department === dept.name)

  if (deptDoctors.length === 0) {
    await sendTextMessage(from, `Sorry, no doctors are currently available in ${dept.name}. Please try another department.`)
    return startBookingFlow(from, session)
  }

  const doctorList = deptDoctors.map(d => d.id)
  await setWaSession(from, {
    step: 'BOOK_DOCTOR',
    data: {
      ...session.data,
      selectedDeptId: deptId,
      selectedDeptName: dept.name,
      doctorList,
    },
  })

  const sections: ListSection[] = [
    {
      title: dept.name,
      rows: deptDoctors.map(d => ({
        id: `doc_${d.id}`,
        title: truncate(d.name, 24),
        description: truncate(`${d.specialty} | ₹${d.consultationFee}`, 72),
      })),
    },
  ]

  await sendListMessage(
    from,
    `👨‍⚕️ *Doctors in ${dept.name}*\n\nChoose a doctor:`,
    'Select Doctor',
    sections,
  )
}

export async function handleBookDoctor(from: string, input: string, session: WaSession): Promise<void> {
  const isService = input.startsWith('srv_')
  
  if (isService) {
    const serviceId = input.replace('srv_', '')
    const { getServices } = await import('./db')
    const service = (await getServices()).find(s => s.id === serviceId)
    
    if (!service) {
      await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
      return session.data.selectedDeptId
        ? handleBookDept(from, `dept_${session.data.selectedDeptId}`, session)
        : startBookingFlow(from, session)
    }

    await setWaSession(from, {
      step: 'BOOK_DATE',
      data: {
        ...session.data,
        selectedDoctorId: `LAB-${service.id}`,
        selectedDoctorName: `Lab: ${service.name}`,
        selectedDoctorFee: service.basePrice,
        selectedService: service.name,
      },
    })

    // Offer next 7 days + Custom Date
    const today = new Date()
    const rows = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      rows.push({ id: `date_${dateStr}`, title: truncate(label, 24) })
    }
    rows.push({ id: 'date_custom', title: '📅 Custom Date' })

    await sendListMessage(
      from,
      `📅 *Select a Date*\n\nTest: ${service.name}\nDepartment: ${session.data.selectedDeptName}\nFee: ₹${service.basePrice}`,
      'Choose Date',
      [{ title: 'Available Dates', rows }]
    )
    return
  }

  const doctorId = input.replace('doc_', '')
  const allDoctors = await getDoctors()
  const doctor = allDoctors.find(d => d.id === doctorId)

  if (!doctor) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    // Re-show the department's doctor list so the user isn't stuck
    return session.data.selectedDeptId
      ? handleBookDept(from, `dept_${session.data.selectedDeptId}`, session)
      : startBookingFlow(from, session)
  }

  await setWaSession(from, {
    step: 'BOOK_DATE',
    data: {
      ...session.data,
      selectedDoctorId: doctor.id,
      selectedDoctorName: doctor.name,
      selectedDoctorFee: doctor.consultationFee,
      selectedService: 'General Consultation',
    },
  })

  // Offer next 7 days + Custom Date
  const today = new Date()
  const rows = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    rows.push({ id: `date_${dateStr}`, title: truncate(label, 24) })
  }
  rows.push({ id: 'date_custom', title: '📅 Custom Date' })

  await sendListMessage(
    from,
    `📅 *Select a Date*\n\nDoctor: ${doctor.name}\nDepartment: ${session.data.selectedDeptName}\nFee: ₹${doctor.consultationFee}`,
    'Choose Date',
    [{ title: 'Available Dates', rows }]
  )
}

export async function handleBookDate(from: string, input: string, session: WaSession): Promise<void> {
  const selectedDate = input.replace('date_', '')

  if (selectedDate === 'custom') {
    await setWaSession(from, { step: 'BOOK_CUSTOM_DATE', data: { ...session.data } })
    await sendTextMessage(from, 'Please type the date you want to book in *YYYY-MM-DD* format (e.g., 2024-08-15):')
    return
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    await sendTextMessage(from, '❌ Invalid date. Please select from the options provided.')
    return
  }

  // Get available slots for the selected doctor on the selected date
  let doctor: any = null
  if (session.data.selectedDoctorId?.startsWith('LAB-')) {
    doctor = {
      id: session.data.selectedDoctorId,
      name: session.data.selectedDoctorName || 'Lab Technician',
      availability: {
        monday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
        tuesday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
        wednesday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
        thursday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
        friday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
        saturday: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'],
        sunday: []
      }
    }
  } else {
    doctor = (await getDoctors()).find(d => d.id === session.data.selectedDoctorId)
  }

  if (!doctor) {
    await sendTextMessage(from, '❌ Something went wrong. Let\'s start over.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  // Parse date parts directly to avoid timezone shift on non-UTC servers
  const [year, month, day] = selectedDate.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toLowerCase()
  const allSlots = doctor.availability[dayOfWeek] || []

  // Filter out already booked slots
  const appointments = await getAllAppointments()
  const bookedTimes = new Set(
    appointments
      .filter(a => a.doctorId === doctor.id && a.date === selectedDate && a.status === 'scheduled')
      .map(a => a.time)
  )
  // Map slots to available/waitlist
  const slotList = allSlots.map((slot: string) => {
    const normalized = normalizeToHHMM(slot)
    const isBooked = bookedTimes.has(normalized) || bookedTimes.has(slot)
    return { time: slot, isWaitlist: isBooked }
  })

  if (slotList.length === 0) {
    await sendTextMessage(from, `😔 Sorry, Dr. ${doctor.name} has no slots configured on this day of the week. Please try another date.`)
    // Re-show the date picker
    return session.data.selectedDoctorId?.startsWith('LAB-') 
      ? startBookingFlow(from, session)
      : handleBookDoctor(from, `doc_${doctor.id}`, session)
  }

  // Save the full slot info as JSON string array to match current structure
  await setWaSession(from, {
    step: 'BOOK_SLOT',
    data: { ...session.data, selectedDate, slotList: slotList.map((s: any) => JSON.stringify(s)) },
  })

  // WhatsApp lists can hold up to 10 items
  const rows = slotList.slice(0, 10).map((slot: any, i: number) => ({
    id: `slot_${i}`,
    title: truncate(slot.time, 24),
    description: slot.isWaitlist ? '⚠️ Full - Join Waitlist' : '✅ Available',
  }))

  const sections: ListSection[] = [{ title: 'Time Slots', rows }]

  await sendListMessage(
    from,
    `🕐 *Available Time Slots*\n\nDoctor: ${doctor.name}\nDate: ${selectedDate}`,
    'Select a Time',
    sections,
  )
}

function normalizeToHHMM(value: string): string {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed

  const timeParts = trimmed.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!timeParts) return trimmed

  let hours = parseInt(timeParts[1], 10)
  const minutes = timeParts[2]
  const ampm = timeParts[3].toUpperCase()
  if (ampm === 'PM' && hours < 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${minutes}`
}

async function handleBookSlot(from: string, input: string, session: WaSession): Promise<void> {
  // input is like "slot_0", "slot_1" etc.
  const slotIndex = parseInt(input.replace('slot_', ''), 10)
  const availableSlots = session.data.slotList || []

  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= availableSlots.length) {
    await sendTextMessage(from, '❌ Invalid slot selection. Please choose from the list.')
    // Re-show the date picker so the user can pick a valid slot
    return session.data.selectedDoctorId
      ? handleBookDoctor(from, `doc_${session.data.selectedDoctorId}`, session)
      : startBookingFlow(from, session)
  }

  const slotDataStr = availableSlots[slotIndex]
  if (!slotDataStr) {
    await sendTextMessage(from, '❌ Invalid slot selection. Please choose from the list.')
    return session.data.selectedDoctorId
      ? handleBookDoctor(from, `doc_${session.data.selectedDoctorId}`, session)
      : startBookingFlow(from, session)
  }

  let slotData: { time: string, isWaitlist: boolean }
  try {
    slotData = JSON.parse(slotDataStr)
  } catch (e) {
    // Fallback for any old session data
    slotData = { time: slotDataStr, isWaitlist: false }
  }

  await setWaSession(from, {
    step: 'BOOK_CONFIRM',
    data: { ...session.data, selectedTime: slotDataStr }, // store full JSON string to know if waitlist in next step
  })

  if (slotData.isWaitlist) {
    await sendButtonMessage(
      from,
      `⚠️ *Waitlist Confirmation*\n\n` +
      `This slot is currently full. Would you like to join the waitlist?\n\n` +
      `👨‍⚕️ Doctor: ${session.data.selectedDoctorName}\n` +
      `🏥 Department: ${session.data.selectedDeptName}\n` +
      `📅 Date: ${session.data.selectedDate}\n` +
      `🕐 Time: ${slotData.time}`,
      [
        { id: 'confirm_yes', title: '✅ Join Waitlist' },
        { id: 'confirm_no', title: '❌ Cancel' },
      ],
    )
  } else {
    await sendButtonMessage(
      from,
      `✅ *Confirm Your Booking*\n\n` +
      `👨‍⚕️ Doctor: ${session.data.selectedDoctorName}\n` +
      `🏥 Department: ${session.data.selectedDeptName}\n` +
      `📅 Date: ${session.data.selectedDate}\n` +
      `🕐 Time: ${slotData.time}\n` +
      `💰 Fee: ₹${session.data.selectedDoctorFee}`,
      [
        { id: 'confirm_yes', title: '✅ Confirm' },
        { id: 'confirm_no', title: '❌ Cancel' },
      ],
    )
  }
}

async function handleBookConfirm(from: string, input: string, session: WaSession): Promise<void> {
  if (input === 'confirm_no') {
    await sendTextMessage(from, '❌ Booking cancelled.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  if (input !== 'confirm_yes') {
    await sendTextMessage(from, 'Please tap ✅ Confirm or ❌ Cancel.')
    return
  }

  let slotData: { time: string, isWaitlist: boolean }
  try {
    slotData = JSON.parse(session.data.selectedTime || '{}')
  } catch (e) {
    slotData = { time: session.data.selectedTime || '', isWaitlist: false }
  }

  // Create the appointment
  const normalizedTime = normalizeToHHMM(slotData.time)
  const newAppointmentId = `apt-${Date.now()}`
  const newAppointment: Appointment = {
    id: newAppointmentId,
    patientName: session.patientName || 'WhatsApp Patient',
    patientPhone: from,
    patientEmail: '',
    ...(session.patientUid ? { patientUid: session.patientUid } : {}),
    doctorId: session.data.selectedDoctorId || '',
    doctorName: session.data.selectedDoctorName || '',
    date: session.data.selectedDate || '',
    time: normalizedTime,
    service: session.data.selectedService || 'General Consultation',
    status: slotData.isWaitlist ? 'waitlist' : 'scheduled', // <-- New waitlist status
    paymentStatus: 'unpaid',
    amount: session.data.selectedDoctorFee || 0,
    createdAt: new Date().toISOString(),
  }

  try {
    // Attempt to book atomically
    const { status: finalStatus } = await addAppointmentTransactional(newAppointment)
    
    if (finalStatus === 'waitlist' && !slotData.isWaitlist) {
      slotData.isWaitlist = true
    }
    
    // Cancel the old appointment if this is a reschedule
    if (session.data.reschedulingAptId) {
      const { updateAppointmentStatus } = await import('./db')
      await updateAppointmentStatus(session.data.reschedulingAptId, 'cancelled')
    }
    
    if (slotData.isWaitlist) {
      // Find position in waitlist
      const allApts = await getAllAppointments()
      const position = allApts.filter(a => a.doctorId === newAppointment.doctorId && a.date === newAppointment.date && a.time === newAppointment.time && a.status === 'waitlist').length
      
      await sendTextMessage(
        from,
        `⏳ *Added to Waitlist*\n\n` +
        `👨‍⚕️ Doctor: ${newAppointment.doctorName}\n` +
        `📅 Date: ${newAppointment.date}\n` +
        `🕐 Time: ${slotData.time}\n\n` +
        `You are #*${position}* in the waitlist. We will notify you if the slot opens up!`
      )
    } else {
      const paymentLink = `https://medi-care-chatbot.vercel.app/pay?aptId=${newAppointment.id}`
      await sendTextMessage(
        from,
        `🎉 *Appointment Confirmed!*\n\n` +
        `👨‍⚕️ Doctor: ${newAppointment.doctorName}\n` +
        `📅 Date: ${newAppointment.date}\n` +
        `🕐 Time: ${slotData.time}\n` +
        `💰 Fee: ₹${newAppointment.amount}\n\n` +
        `Your booking reference: *${newAppointment.id}*\n\n` +
        `Please arrive 15 minutes early. Thank you for choosing MediCare! 🏥\n\n` +
        `*Payment Options:*\n` +
        `You can pay at the hospital, or pay securely online now:\n${paymentLink}`
      )
    }
  } catch (error) {
    console.error('WhatsApp booking error:', error)
    await sendTextMessage(from, '❌ Sorry, something went wrong while booking. Please try again or call us directly.')
  }

  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIEW APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════════

async function startViewAppointments(from: string, session: WaSession): Promise<void> {
  const allApts = await getAllAppointments()
  const myApts = allApts.filter(a =>
    (a.status === 'scheduled' || a.status === 'waitlist') &&
    (a.patientUid === session.patientUid || a.patientPhone === from)
  )

  if (myApts.length === 0) {
    await sendTextMessage(from, '📋 You don\'t have any upcoming appointments.\n\nWould you like to book one?')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  // Save the list of appointments to session
  await setWaSession(from, {
    step: 'VIEW_APPOINTMENTS',
    data: { ...session.data, appointmentList: myApts.map(a => a.id) }
  })

  const rows = myApts.slice(0, 10).map((a, i) => ({
    id: `apt_${i}`,
    title: truncate(`${a.date} | ${a.time}`, 24),
    description: truncate(`${a.status === 'waitlist' ? '⏳ ' : ''}${a.doctorName} - ${a.service}`, 72),
  }))

  await sendListMessage(
    from,
    '📋 *Your Upcoming Appointments*\n\nSelect an appointment to manage or cancel:',
    'Manage Appointments',
    [{ title: 'Upcoming', rows }]
  )
}

async function handleViewAppointments(from: string, input: string, session: WaSession): Promise<void> {
  const isCancel = input.startsWith('cancel_')
  const isPay = input.startsWith('pay_')
  const isReschedule = input.startsWith('reschedule_')
  
  if (isCancel || isPay || isReschedule) {
    const aptId = input.replace('cancel_', '').replace('pay_', '').replace('reschedule_', '')
    const { getAppointment, updateAppointmentStatus } = await import('./db')
    const apt = await getAppointment(aptId)

    const normalizedFrom = from.startsWith('+') ? from : `+${from}`
    const aptPhone = apt?.patientPhone?.startsWith('+') ? apt.patientPhone : `+${apt?.patientPhone}`
    
    if (!apt || (apt.patientUid !== session.patientUid && aptPhone !== normalizedFrom)) {
      await sendTextMessage(from, '❌ Access denied or appointment not found.')
      await resetWaSession(from, session.patientUid, session.patientName)
      return sendMainMenu(from, session.patientName)
    }

    if (isCancel) {
      await updateAppointmentStatus(aptId, 'cancelled')
      await sendTextMessage(from, `❌ Appointment ${aptId} has been cancelled successfully.`)
    } else if (isReschedule) {
      await sendTextMessage(from, `🔄 Let's pick a new date and time. Your current appointment will be cancelled only after you confirm the new one.`)
      if (apt.doctorId) {
        // Store old appointment id in session for deferring cancellation
        await setWaSession(from, {
          ...session,
          data: { ...session.data, reschedulingAptId: aptId }
        })
        return handleBookDoctor(from, `doc_${apt.doctorId}`, session)
      } else {
        return startBookingFlow(from, session)
      }
    } else if (isPay) {
      await sendTextMessage(from, `💳 *Payment Link:*\nhttps://medi-care-chatbot.vercel.app/pay?aptId=${aptId}`)
    }

    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const aptIndex = parseInt(input.replace('apt_', ''), 10)
  const appointmentList = session.data.appointmentList || []

  if (isNaN(aptIndex) || aptIndex < 0 || aptIndex >= appointmentList.length) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return
  }

  const aptId = appointmentList[aptIndex]
  const { getAppointment } = await import('./db')
  const apt = await getAppointment(aptId)

  if (!apt) {
    await sendTextMessage(from, '❌ Appointment not found.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const statusEmoji = apt.status === 'scheduled' ? '✅ Scheduled' : apt.status === 'waitlist' ? '⏳ Waitlisted' : apt.status
  const payStatus = apt.paymentStatus === 'paid' ? '✅ Paid' : '❌ Unpaid'

  let text = `📋 *Appointment Details*\n\n` +
             `👨‍⚕️ Doctor: ${apt.doctorName}\n` +
             `📅 Date: ${apt.date}\n` +
             `🕐 Time: ${apt.time}\n` +
             `🏥 Service: ${apt.service}\n` +
             `📌 Status: ${statusEmoji}\n` +
             `💰 Fee: ₹${apt.amount} (${payStatus})\n` +
             `📝 Ref: ${apt.id}\n\n` +
             `What would you like to do?`

  const rows = [
    { id: `reschedule_${apt.id}`, title: '🔄 Reschedule' },
    { id: `cancel_${apt.id}`, title: '❌ Cancel Appointment' }
  ]
  if (apt.paymentStatus !== 'paid') {
    rows.push({ id: `pay_${apt.id}`, title: '💳 Pay Now' })
  }

  await sendListMessage(
    from,
    text,
    'Actions',
    [{ title: 'Manage', rows }]
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LAB REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

async function startViewReports(from: string, session: WaSession): Promise<void> {
  if (!session.patientUid) {
    await sendTextMessage(from, '❌ We couldn\'t find your patient profile linked to this number. Please contact the hospital to link your phone number.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const reports = await getPatientReportsByUid(session.patientUid)

  if (reports.length === 0) {
    await sendTextMessage(from, '🧪 You don\'t have any lab reports yet.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const reportList = reports.map(r => r.id)
  await setWaSession(from, {
    step: 'REPORT_SELECT',
    data: { ...session.data, reportList },
  })

  const sections: ListSection[] = [
    {
      title: 'Your Reports',
      rows: reports.slice(0, 10).map((r, i) => ({
        id: `report_${i}`,
        title: truncate(r.testName, 24),
        description: truncate(`${r.reportType === 'blood_test' ? '🩸' : '📷'} ${new Date(r.createdAt).toLocaleDateString('en-IN')}`, 72),
      })),
    },
  ]

  await sendListMessage(
    from,
    '🧪 *Your Lab Reports*\n\nSelect a report to download:',
    'View Reports',
    sections,
  )
}

async function handleViewReports(from: string, _input: string, session: WaSession): Promise<void> {
  return startViewReports(from, session)
}

async function handleReportSelect(from: string, input: string, session: WaSession): Promise<void> {
  const reportIndex = parseInt(input.replace('report_', ''), 10)
  const reportList = session.data.reportList || []

  if (isNaN(reportIndex) || reportIndex < 0 || reportIndex >= reportList.length) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return
  }

  const reportId = reportList[reportIndex]

  // Fetch the report to get the file URL
  const { getLabReport } = await import('./db')
  const report = await getLabReport(reportId)

  if (!report || !report.fileUrl) {
    await sendTextMessage(from, '❌ Sorry, this report is not available for download.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  try {
    const caption = `🧪 *${report.testName}*\n📅 ${new Date(report.createdAt).toLocaleDateString('en-IN')}` +
      (report.doctorNotes ? `\n\n👨‍⚕️ *Doctor's Notes:*\n_${report.doctorNotes}_` : '')

    await sendDocumentMessage(
      from,
      report.fileUrl,
      report.fileName || `${report.testName}.pdf`,
      caption,
    )
    await sendTextMessage(from, '✅ Your report has been sent above! ☝️')
  } catch (error) {
    console.error('Error sending report:', error)
    await sendTextMessage(from, '❌ Sorry, we couldn\'t send the report. Please try downloading it from our website.')
  }

  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AI DOCTOR CHAT
// ═══════════════════════════════════════════════════════════════════════════════

async function handleAiChat(from: string, input: string, session: WaSession): Promise<void> {
  // Strip any attempts to override system instructions
  const sanitizedInput = input
    .replace(/system\s*:/gi, '')
    .replace(/ignore\s+(previous|all|above)\s+instructions/gi, '')
    .replace(/you\s+are\s+now/gi, '')
    .slice(0, 2000)

  if (sanitizedInput.trim().length === 0) {
    await sendTextMessage(from, '❌ Please type a valid question.')
    return
  }

  try {
    const hospitalContext = await buildHospitalContext()
    const { processAiMessage } = await import('./wa-ai-agent')
    await processAiMessage(from, sanitizedInput, session, hospitalContext)
  } catch (error) {
    console.error('WhatsApp AI Agent error:', error)
    await sendTextMessage(from, '❌ Sorry, I\'m having trouble processing your question right now. Please try again or type "menu" to go back.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CALLBACK REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

async function startCallbackFlow(from: string, session: WaSession): Promise<void> {
  const departments = await getDepartments()

  const sections: ListSection[] = [
    {
      title: 'Departments',
      rows: departments.map(d => ({
        id: `cb_dept_${d.id}`,
        title: truncate(d.name, 24),
        description: truncate(d.description || '', 72),
      })),
    },
  ]

  await setWaSession(from, { step: 'CALLBACK_DEPT', data: { ...session.data } })

  await sendListMessage(
    from,
    '📞 *Request a Callback*\n\nWhich department should call you?',
    'Select Department',
    sections,
  )
}

async function handleCallbackDept(from: string, input: string, session: WaSession): Promise<void> {
  const deptId = input.replace('cb_dept_', '')
  const departments = await getDepartments()
  const dept = departments.find(d => d.id === deptId)

  if (!dept) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return startCallbackFlow(from, session)
  }

  await setWaSession(from, {
    step: 'CALLBACK_QUERY',
    data: { ...session.data, callbackDept: dept.name },
  })

  await sendTextMessage(
    from,
    `📝 You selected *${dept.name}*.\n\nPlease type a brief description of your query so our team knows how to help you:`,
  )
}

async function handleCallbackQuery(from: string, input: string, session: WaSession): Promise<void> {
  // ── INPUT SANITIZATION: Prevent stored XSS in admin dashboard ────────────
  const sanitizedQuery = input
    .replace(/[<>]/g, '')          // Strip HTML tags
    .replace(/javascript:/gi, '')  // Strip JS protocol
    .slice(0, 500)                 // Reasonable length limit
    .trim()

  if (sanitizedQuery.length === 0) {
    await sendTextMessage(from, '❌ Please describe your query briefly.')
    return
  }

  try {
    await addCallbackTicket({
      id: `cb-${Date.now()}`,
      patientName: session.patientName || 'WhatsApp Patient',
      patientPhone: from,
      patientEmail: '',
      ...(session.patientUid ? { patientUid: session.patientUid } : {}),
      querySummary: sanitizedQuery,
      department: session.data.callbackDept || 'General',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    await sendTextMessage(
      from,
      `✅ *Callback Request Submitted!*\n\n` +
      `📋 Department: ${session.data.callbackDept}\n` +
      `📝 Query: ${sanitizedQuery}\n\n` +
      `A MediCare staff member will call you shortly on this number. Thank you! 🙏`
    )
  } catch (error) {
    console.error('Callback ticket error:', error)
    await sendTextMessage(from, '❌ Sorry, we couldn\'t submit your callback request. Please try calling us directly.')
  }

  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}
