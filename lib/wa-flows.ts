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
  getAppointments,
  getAllAppointments,
  addAppointment,
  getPatientByIdentifier,
  getPatientReportsByUid,
  addCallbackTicket,
  type Appointment,
  type Department,
  type Doctor,
} from './db'
import { buildHospitalContext } from './db'

// ── Incoming Message Types ────────────────────────────────────────────────────

export interface IncomingMessage {
  from: string      // E.164 phone number (no whatsapp: prefix)
  messageId: string
  type: 'text' | 'interactive'
  text?: string
  buttonReplyId?: string
  listReplyId?: string
}

/**
 * Route an incoming WhatsApp message to the appropriate conversation handler based on the sender's session state.
 *
 * This function ensures a session exists (auto-linking a patient by phone if needed), applies global reset commands
 * (e.g., "menu", "hi", "start"), and dispatches the extracted user input to the handler for the current `WaSession.step`.
 *
 * @param msg - The incoming WhatsApp payload containing the sender, message id, and user input (text, button, or list reply)
 */

export async function handleWhatsAppMessage(msg: IncomingMessage): Promise<void> {
  const { from } = msg
  const input = extractUserInput(msg)

  // Fetch or create session
  let session = await getWaSession(from)
  if (!session) {
    // Auto-link patient from existing database if phone number matches
    const patient = await getPatientByIdentifier(from)
    await resetWaSession(from, patient?.uid, patient?.name)
    session = (await getWaSession(from))!
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
    default:
      await resetWaSession(from, session.patientUid, session.patientName)
      return sendMainMenu(from, session.patientName)
  }
}

/**
 * Extracts the user's chosen input from an IncomingMessage.
 *
 * @param msg - The incoming WhatsApp payload; preference is given to `buttonReplyId`, then `listReplyId`, then trimmed `text`.
 * @returns The selected reply identifier or trimmed text, or an empty string if no input is present.
 */

function extractUserInput(msg: IncomingMessage): string {
  if (msg.buttonReplyId) return msg.buttonReplyId
  if (msg.listReplyId) return msg.listReplyId
  return msg.text?.trim() || ''
}

/**
 * Truncates a string to a maximum length and appends a trailing ellipsis when truncation occurs.
 *
 * @param str - The input string to truncate
 * @param max - The maximum allowed length of the returned string
 * @returns The original `str` if its length is less than or equal to `max`; otherwise a truncated string no longer than `max` characters that ends with `…`
 */
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

/**
 * Sends the main menu list to a WhatsApp recipient, greeting the user and presenting service options.
 *
 * @param to - Destination phone number in E.164 format
 * @param patientName - Optional patient name inserted into the greeting
 */

async function sendMainMenu(to: string, patientName?: string): Promise<void> {
  const greeting = patientName ? `Hello ${patientName}! 👋` : 'Hello! 👋'

  const sections: ListSection[] = [
    {
      title: 'Our Services',
      rows: [
        { id: 'menu_book', title: '🗓️ Book Appointment', description: 'Schedule a visit with a doctor' },
        { id: 'menu_appointments', title: '📋 My Appointments', description: 'View your upcoming appointments' },
        { id: 'menu_reports', title: '🧪 My Lab Reports', description: 'View & download your reports' },
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

/**
 * Routes a user's main-menu selection to the appropriate conversation flow or re-displays the main menu.
 *
 * @param from - The sender's E.164 phone number
 * @param input - The selected menu action identifier (e.g. `menu_book`, `menu_reports`, `menu_ai`)
 * @param session - The current WhatsApp session for the sender
 */

async function handleMainMenuChoice(from: string, input: string, session: WaSession): Promise<void> {
  switch (input) {
    case 'menu_book':
      return startBookingFlow(from, session)
    case 'menu_appointments':
      return startViewAppointments(from, session)
    case 'menu_reports':
      return startViewReports(from, session)
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
/**
 * Initiates the booking flow by presenting the user a list of available departments.
 *
 * If no departments exist, notifies the user and returns them to the main menu. Otherwise,
 * saves the available department IDs in the session and sends a department picker list.
 *
 * @param from - The sender's E.164 phone number to send messages to
 * @param session - Current WhatsApp session for the user
 */

async function startBookingFlow(from: string, session: WaSession): Promise<void> {
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
      rows: departments.map(d => ({
        id: `dept_${d.id}`,
        title: truncate(d.name, 24),
        description: truncate(d.description || d.location || '', 72),
      })),
    },
  ]

  await sendListMessage(
    from,
    '🗓️ *Book an Appointment*\n\nPlease select a department:',
    'Select Department',
    sections,
  )
}

/**
 * Handle a department selection during the booking flow and present available doctors.
 *
 * Validates the department selected by `input`, finds doctors for that department, updates the user's session to the `BOOK_DOCTOR` step with the selected department and doctor list, and sends a doctor selection list to the user. If the selection is invalid or no doctors are available, notifies the user and restarts the booking flow.
 *
 * @param from - The user's E.164 phone number to send messages to
 * @param input - Raw selection string in the form `"dept_<departmentId>"` (e.g., `"dept_cardiology"`)
 * @param session - The current `WaSession` for the user; used to persist selection and next step
 */
async function handleBookDept(from: string, input: string, session: WaSession): Promise<void> {
  // input is like "dept_cardiology"
  const deptId = input.replace('dept_', '')
  const departments = await getDepartments()
  const dept = departments.find(d => d.id === deptId)

  if (!dept) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return startBookingFlow(from, session)
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

/**
 * Advance the booking flow by recording the chosen doctor and prompting the user to pick a date.
 *
 * Stores the selected doctor's id, name, and fee in the session and sets the step to `BOOK_DATE`,
 * then sends a button message offering the next three calendar dates.
 *
 * @param from - The user's phone number (E.164) to send messages to
 * @param input - The interactive selection id expected in the form `doc_<doctorId>`
 * @param session - Current WhatsApp session; used to read existing session data (e.g., selected department name)
 */
async function handleBookDoctor(from: string, input: string, session: WaSession): Promise<void> {
  const doctorId = input.replace('doc_', '')
  const allDoctors = await getDoctors()
  const doctor = allDoctors.find(d => d.id === doctorId)

  if (!doctor) {
    await sendTextMessage(from, '❌ Invalid selection. Please choose from the list.')
    return
  }

  await setWaSession(from, {
    step: 'BOOK_DATE',
    data: {
      ...session.data,
      selectedDoctorId: doctor.id,
      selectedDoctorName: doctor.name,
      selectedDoctorFee: doctor.consultationFee,
    },
  })

  // Offer next 3 days
  const today = new Date()
  const buttons = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    buttons.push({ id: `date_${dateStr}`, title: truncate(label, 20) })
  }

  await sendButtonMessage(
    from,
    `📅 *Select a Date*\n\nDoctor: ${doctor.name}\nDepartment: ${session.data.selectedDeptName}\nFee: ₹${doctor.consultationFee}`,
    buttons,
  )
}

/**
 * Process a user-selected booking date, compute available time slots, update the session, and prompt the user to choose a slot.
 *
 * Validates the incoming `input` (expected as `date_YYYY-MM-DD`), verifies the selected doctor, filters out already booked times for that date, stores the resulting slot list in the session with step `BOOK_SLOT`, and sends a WhatsApp list of available slots. If the date is invalid or the doctor is missing it sends an error and returns the user to an appropriate earlier step.
 *
 * @param from - The patient's phone number (E.164) to send messages to
 * @param input - The raw user input identifier (expected to be `date_YYYY-MM-DD`)
 * @param session - The current `WaSession` for the user (used to read/write booking state and stored selections)
 */
async function handleBookDate(from: string, input: string, session: WaSession): Promise<void> {
  const selectedDate = input.replace('date_', '')

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    await sendTextMessage(from, '❌ Invalid date. Please select from the options provided.')
    return
  }

  // Get available slots for the selected doctor on the selected date
  const doctor = (await getDoctors()).find(d => d.id === session.data.selectedDoctorId)
  if (!doctor) {
    await sendTextMessage(from, '❌ Something went wrong. Let\'s start over.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const allSlots = doctor.availability[dayOfWeek] || []

  // Filter out already booked slots
  const appointments = await getAllAppointments()
  const bookedTimes = new Set(
    appointments
      .filter(a => a.doctorId === doctor.id && a.date === selectedDate && a.status === 'scheduled')
      .map(a => a.time)
  )
  const availableSlots = allSlots.filter(slot => {
    // Normalize the slot to HH:mm for comparison
    const normalized = normalizeToHHMM(slot)
    return !bookedTimes.has(normalized) && !bookedTimes.has(slot)
  })

  if (availableSlots.length === 0) {
    await sendTextMessage(from, `😔 Sorry, Dr. ${doctor.name} has no available slots on ${selectedDate}. Please try another date.`)
    // Re-show the date picker
    return handleBookDoctor(from, `doc_${doctor.id}`, session)
  }

  const slotList = availableSlots
  await setWaSession(from, {
    step: 'BOOK_SLOT',
    data: { ...session.data, selectedDate, slotList },
  })

  // WhatsApp lists can hold up to 10 items
  const rows = availableSlots.slice(0, 10).map((slot, i) => ({
    id: `slot_${i}`,
    title: truncate(slot, 24),
  }))

  const sections: ListSection[] = [{ title: 'Available Slots', rows }]

  await sendListMessage(
    from,
    `🕐 *Available Time Slots*\n\nDoctor: ${doctor.name}\nDate: ${selectedDate}`,
    'Select a Time',
    sections,
  )
}

/**
 * Normalize a time string into 24-hour `HH:mm` format when possible.
 *
 * @param value - Input time, e.g. `HH:mm` or `h:mm AM/PM` (whitespace is ignored)
 * @returns The time in `HH:mm` 24-hour format if the input can be parsed, otherwise the trimmed input
 */
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

/**
 * Handles a slot selection from the user, stores the chosen time in session, advances the flow to the booking confirmation step, and prompts the user to confirm or cancel.
 *
 * @param input - User selection string in the form `slot_{index}` where `{index}` is the zero-based index into `session.data.slotList`
 */
async function handleBookSlot(from: string, input: string, session: WaSession): Promise<void> {
  // input is like "slot_0", "slot_1" etc.
  const slotIndex = parseInt(input.replace('slot_', ''), 10)
  const availableSlots = session.data.slotList || []

  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= availableSlots.length) {
    await sendTextMessage(from, '❌ Invalid slot selection. Please choose from the list.')
    return
  }

  const selectedTime = availableSlots[slotIndex]
  await setWaSession(from, {
    step: 'BOOK_CONFIRM',
    data: { ...session.data, selectedTime },
  })

  await sendButtonMessage(
    from,
    `✅ *Confirm Your Booking*\n\n` +
    `👨‍⚕️ Doctor: ${session.data.selectedDoctorName}\n` +
    `🏥 Department: ${session.data.selectedDeptName}\n` +
    `📅 Date: ${session.data.selectedDate}\n` +
    `🕐 Time: ${selectedTime}\n` +
    `💰 Fee: ₹${session.data.selectedDoctorFee}`,
    [
      { id: 'confirm_yes', title: '✅ Confirm' },
      { id: 'confirm_no', title: '❌ Cancel' },
    ],
  )
}

/**
 * Finalize a pending booking: cancel, prompt, or confirm and persist the appointment.
 *
 * If the user cancels, the session is reset and the main menu is sent. If the user confirms,
 * a new appointment record is created and persisted, a confirmation message with a booking reference
 * is sent, then the session is reset and the main menu is shown. If the input is neither confirm nor
 * cancel, the user is asked to tap Confirm or Cancel.
 *
 * @param from - The sender's phone number (E.164)
 * @param input - The user's confirmation input (`confirm_yes` or `confirm_no`)
 * @param session - Current WhatsApp session containing selected booking details
 */
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

  // Create the appointment
  const normalizedTime = normalizeToHHMM(session.data.selectedTime || '')
  const newAppointment: Appointment = {
    id: `apt-${Date.now()}`,
    patientName: session.patientName || 'WhatsApp Patient',
    patientPhone: from,
    patientEmail: '',
    patientUid: session.patientUid || undefined,
    doctorId: session.data.selectedDoctorId || '',
    doctorName: session.data.selectedDoctorName || '',
    date: session.data.selectedDate || '',
    time: normalizedTime,
    service: session.data.selectedService || 'General Consultation',
    status: 'scheduled',
    paymentStatus: 'unpaid',
    amount: session.data.selectedDoctorFee || 0,
    createdAt: new Date().toISOString(),
  }

  try {
    await addAppointment(newAppointment)
    await sendTextMessage(
      from,
      `🎉 *Appointment Confirmed!*\n\n` +
      `👨‍⚕️ Doctor: ${newAppointment.doctorName}\n` +
      `📅 Date: ${newAppointment.date}\n` +
      `🕐 Time: ${session.data.selectedTime}\n` +
      `💰 Fee: ₹${newAppointment.amount}\n\n` +
      `Your booking reference: *${newAppointment.id}*\n\n` +
      `Please arrive 15 minutes early. Thank you for choosing MediCare! 🏥`
    )
  } catch (error) {
    console.error('WhatsApp booking error:', error)
    await sendTextMessage(from, '❌ Sorry, something went wrong while booking. Please try again or call us directly.')
  }

  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VIEW APPOINTMENTS
/**
 * Sends the caller their upcoming scheduled appointments or informs them there are none, then resets the session and returns to the main menu.
 *
 * @param from - The caller's E.164 phone number (destination for outgoing messages)
 * @param session - The current WhatsApp session containing patient linkage and session state used to filter appointments and update/reset the session
 */

async function startViewAppointments(from: string, session: WaSession): Promise<void> {
  if (!session.patientUid && !from) {
    await sendTextMessage(from, '❌ We couldn\'t find your profile. Please book through our website first or contact us directly.')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  const allApts = await getAllAppointments()
  const myApts = allApts.filter(a =>
    a.status === 'scheduled' &&
    (a.patientUid === session.patientUid || a.patientPhone === from)
  )

  if (myApts.length === 0) {
    await sendTextMessage(from, '📋 You don\'t have any upcoming appointments.\n\nWould you like to book one?')
    await resetWaSession(from, session.patientUid, session.patientName)
    return sendMainMenu(from, session.patientName)
  }

  let text = '📋 *Your Upcoming Appointments*\n\n'
  myApts.forEach((a, i) => {
    text += `*${i + 1}.* 👨‍⚕️ ${a.doctorName}\n`
    text += `   📅 ${a.date} at ${a.time}\n`
    text += `   🏥 ${a.service}\n`
    text += `   📝 Ref: ${a.id}\n\n`
  })

  await sendTextMessage(from, text)
  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}

/**
 * Resets the user's WhatsApp session and sends the main menu.
 *
 * @param from - The sender's phone number in E.164 format
 * @param session - The current WaSession used to preserve patient linkage when resetting
 */
async function handleViewAppointments(from: string, _input: string, session: WaSession): Promise<void> {
  // This step exists for potential future sub-actions (cancel, reschedule)
  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LAB REPORTS
/**
 * Initiates the lab reports viewing flow for the given WhatsApp session.
 *
 * If the session is not linked to a patient, informs the user and returns to the main menu.
 * If the patient has no reports, informs the user and returns to the main menu.
 * Otherwise, stores a `reportList` in the session, sets the session step to `REPORT_SELECT`, and sends a selectable list (up to 10) of the patient's lab reports.
 *
 * @param from - Destination phone number (E.164) to send messages to
 * @param session - Current WhatsApp session object used to determine patient linkage and to persist `REPORT_SELECT` state and `reportList`
 */

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

/**
 * Initiates the lab reports viewing flow for the given WhatsApp session.
 *
 * @param from - The sender's E.164 phone number used to identify the patient and send replies
 * @param _input - Ignored; present to match the router signature
 * @param session - The current WhatsApp session containing patient linkage and session data
 */
async function handleViewReports(from: string, _input: string, session: WaSession): Promise<void> {
  return startViewReports(from, session)
}

/**
 * Handles a user's lab report selection, sends the report file if available, then resets the session and returns to the main menu.
 *
 * Validates the selected report index, fetches the report record, attempts to deliver the report as a document, notifies the user of success or failure, and always resets the WhatsApp session before presenting the main menu.
 *
 * @param from - The sender's phone number in E.164 format
 * @param input - The raw interactive input identifier (e.g., `report_0`)
 * @param session - The current WhatsApp session containing `data.reportList` and patient metadata
 */
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
    await sendDocumentMessage(
      from,
      report.fileUrl,
      report.fileName || `${report.testName}.pdf`,
      `🧪 ${report.testName}\n📅 ${new Date(report.createdAt).toLocaleDateString('en-IN')}`,
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
/**
 * Sends the user's message to the AI doctor model using hospital context and delivers the model's plain-text reply to the user on WhatsApp.
 *
 * If the AI request fails, sends a concise fallback error message instructing the user to try again or return to the main menu.
 *
 * @param from - The recipient phone number in E.164 format
 * @param input - The user's chat message to send to the AI model
 * @param session - Current WhatsApp session data (used for session continuity)
 */

async function handleAiChat(from: string, input: string, session: WaSession): Promise<void> {
  try {
    // Build hospital context and send to Gemini
    const hospitalContext = await buildHospitalContext()

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
      systemInstruction: [
        'You are MediCare AI, a helpful hospital assistant on WhatsApp.',
        'Answer patient questions using ONLY the hospital data below.',
        'Be concise — WhatsApp messages should be short and readable.',
        'Use emojis sparingly for a friendly tone.',
        'If you cannot answer, suggest the patient contact the hospital directly.',
        'Do NOT use markdown formatting (no **, no ##). Use plain text only.',
        'Do NOT return JSON. Return a plain text response.',
        '',
        hospitalContext,
      ].join('\n'),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    })

    const result = await model.generateContent(input)
    const aiResponse = result.response.text()

    await sendTextMessage(from, aiResponse)
  } catch (error) {
    console.error('WhatsApp AI Chat error:', error)
    await sendTextMessage(from, '❌ Sorry, I\'m having trouble processing your question right now. Please try again or type "menu" to go back.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CALLBACK REQUEST
/**
 * Prompts the user to choose a department for a callback and advances the session to the callback-department step.
 *
 * @param from - Recipient phone number in E.164 format
 * @param session - Current WhatsApp session object; existing session data is preserved when advancing the step
 */

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

/**
 * Handle a department selection for a callback request and prompt the user to describe their query.
 *
 * @param from - The user's phone number in E.164 format
 * @param input - The raw selection payload (expected to start with `cb_dept_` followed by the department id)
 * @param session - The current WhatsApp session; will be updated to record the chosen department and advance the step to request the query description
 */
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

/**
 * Creates a callback ticket from the user's input, informs the user of success or failure, then resets the session and returns to the main menu.
 *
 * @param from - The sender's E.164 phone number
 * @param input - The user's free-text summary of their callback request
 * @param session - The current WhatsApp session containing patient and flow state (used to attach patient and department context)
 */
async function handleCallbackQuery(from: string, input: string, session: WaSession): Promise<void> {
  try {
    await addCallbackTicket({
      id: `cb-${Date.now()}`,
      patientName: session.patientName || 'WhatsApp Patient',
      patientPhone: from,
      patientEmail: '',
      patientUid: session.patientUid || undefined,
      querySummary: input,
      department: session.data.callbackDept || 'General',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    await sendTextMessage(
      from,
      `✅ *Callback Request Submitted!*\n\n` +
      `📋 Department: ${session.data.callbackDept}\n` +
      `📝 Query: ${input}\n\n` +
      `A MediCare staff member will call you shortly on this number. Thank you! 🙏`
    )
  } catch (error) {
    console.error('Callback ticket error:', error)
    await sendTextMessage(from, '❌ Sorry, we couldn\'t submit your callback request. Please try calling us directly.')
  }

  await resetWaSession(from, session.patientUid, session.patientName)
  return sendMainMenu(from, session.patientName)
}
