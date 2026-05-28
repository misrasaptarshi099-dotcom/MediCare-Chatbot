import { db } from './firestore'
import { FieldValue } from 'firebase-admin/firestore'// ── Interfaces ────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string
  name: string
  specialty: string
  department: string
  departmentId: string
  consultationFee: number
  roomNumber: string
  availability: Record<string, string[]>
}

function normalizeAvailability(availability: Record<string, string[]>) {
  return Object.entries(availability).reduce<Record<string, string[]>>((acc, [day, slots]) => {
    acc[day.toLowerCase()] = slots
    return acc
  }, {})
}

export interface Department {
  id: string
  name: string
  description: string
  location: string
  phone: string
}

export interface DepartmentsData {
  departments: Department[]
  visitingHours: {
    general: {
      weekdays: string
      weekends: string
    }
    icu: {
      allowed: string
      maxVisitors: number
      notes: string
    }
  }
}

export interface Insurance {
  id: string
  name: string
  proceduresCovered: string[]
  coveragePercentage: number
  networkType: string
  contactNumber: string
}

export interface Service {
  id: string
  name: string
  department: string
  departmentId: string
  description: string
  duration: number
  basePrice: number
}

export interface Appointment {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  patientUid?: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  service: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'waitlist'
  paymentStatus?: 'paid' | 'unpaid' | 'refunded'
  amount?: number
  createdAt: string
  updatedAt?: string
}

export interface UnansweredQuery {
  id: string
  query: string
  reason: string
  timestamp: string
}

export interface CallbackTicket {
  id: string
  patientName: string
  patientPhone: string
  patientEmail: string
  patientUid?: string
  querySummary: string
  department: string
  status: 'pending' | 'resolved' | 'in-progress'
  createdAt: string
  resolvedAt?: string
}

export interface User {
  id: string
  username: string
  email?: string
  password: string
  role: string
  name: string
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatSession {
  uid: string
  messages: ChatMessage[]
  lastUpdated: string
}

export interface WaitlistEntry {
  id: string
  doctorId: string
  doctorName: string
  date: string
  time: string
  patientName: string
  patientEmail: string
  patientPhone: string
  patientUid?: string
  service: string
  createdAt: string
}

export interface SentReminder {
  appointmentId: string
  sentAt: string
}

export interface OtpEntry {
  identifier: string
  code: string
  expiresAt: number
  purpose?: string
}

export interface LabReport {
  id: string
  patientName: string
  patientEmail: string
  patientPhone: string
  patientUid?: string
  reportType: 'blood_test' | 'xray'
  testName: string
  fileUrl: string
  storagePath?: string
  fileName: string
  notes?: string
  doctorNotes?: string
  status: 'pending' | 'ready' | 'sent'
  appointmentId?: string
  createdAt: string
  sentAt?: string
}

export interface Patient {
  uid: string
  name: string
  email?: string
  phone?: string
  authProviders: ('email' | 'phone' | 'google')[]
  createdAt: string
  updatedAt: string
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export async function getDoctors(): Promise<Doctor[]> {
  const snap = await db.collection('doctors').get()
  return snap.docs.map(d => {
    const doctor = { id: d.id, ...d.data() } as Doctor
    return {
      ...doctor,
      availability: normalizeAvailability(doctor.availability ?? {}),
    }
  })
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const doc = await db.collection('doctors').doc(id).get()
  if (!doc.exists) return null
  const doctor = { id: doc.id, ...doc.data() } as Doctor
  return {
    ...doctor,
    availability: normalizeAvailability(doctor.availability ?? {}),
  }
}

export async function addDoctor(doctor: Doctor): Promise<void> {
  await db.collection('doctors').doc(doctor.id).set(doctor)
}

export async function updateDoctor(id: string, data: Partial<Doctor>): Promise<void> {
  await db.collection('doctors').doc(id).update(data)
}

export async function deleteDoctor(id: string): Promise<void> {
  await db.collection('doctors').doc(id).delete()
}

// ── Appointments ──────────────────────────────────────────────────────────────

export async function getAppointments(filters?: {
  doctorId?: string
  date?: string
  status?: string
  patientEmail?: string
}): Promise<Appointment[]> {
  let query: FirebaseFirestore.Query = db.collection('appointments')

  if (filters?.doctorId) query = query.where('doctorId', '==', filters.doctorId)
  if (filters?.date) query = query.where('date', '==', filters.date)
  if (filters?.status) query = query.where('status', '==', filters.status)
  if (filters?.patientEmail) query = query.where('patientEmail', '==', filters.patientEmail.toLowerCase())

  const snap = await query.get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAllAppointments(): Promise<Appointment[]> {
  const snap = await db.collection('appointments').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAppointmentsByPatientUid(patientUid: string): Promise<Appointment[]> {
  const snap = await db.collection('appointments').where('patientUid', '==', patientUid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment))
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const doc = await db.collection('appointments').doc(id).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Appointment
}

export async function updateAppointmentStatus(id: string, status: Appointment['status']): Promise<void> {
  await db.collection('appointments').doc(id).update({ status, updatedAt: new Date().toISOString() })
}

export async function addAppointment(appointment: Appointment): Promise<void> {
  await db.collection('appointments').doc(appointment.id).set(appointment)
}

export async function addAppointmentTransactional(newAppointment: Appointment): Promise<{ status: Appointment['status'] }> {
  return await db.runTransaction(async (t) => {
    const existingSnap = await t.get(
      db.collection('appointments')
        .where('doctorId', '==', newAppointment.doctorId)
        .where('date', '==', newAppointment.date)
        .where('time', '==', newAppointment.time)
        .where('status', '==', 'scheduled')
    )
    
    let finalStatus = newAppointment.status
    if (!existingSnap.empty && finalStatus === 'scheduled') {
      finalStatus = 'waitlist'
    }
    
    const docRef = db.collection('appointments').doc(newAppointment.id)
    const appointmentToSave = { ...newAppointment, status: finalStatus }
    t.set(docRef, appointmentToSave)
    
    return { status: finalStatus }
  })
}

export async function updateAppointment(id: string, data: Partial<Appointment>): Promise<void> {
  await db.collection('appointments').doc(id).update(data)
}

// ── Departments ───────────────────────────────────────────────────────────────

export async function getDepartments(): Promise<Department[]> {
  const snap = await db.collection('departments').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Department))
}

export async function getVisitingHours(): Promise<DepartmentsData['visitingHours'] | null> {
  const doc = await db.collection('config').doc('visitingHours').get()
  return doc.exists ? (doc.data() as DepartmentsData['visitingHours']) : null
}

export async function updateDepartment(id: string, data: Partial<Department>): Promise<void> {
  await db.collection('departments').doc(id).update(data)
}

export async function addDepartment(dept: Department): Promise<void> {
  await db.collection('departments').doc(dept.id).set(dept)
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function getServices(): Promise<Service[]> {
  const snap = await db.collection('services').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))
}

// ── Insurance ─────────────────────────────────────────────────────────────────

export async function getInsurancePartners(): Promise<Insurance[]> {
  const snap = await db.collection('insurancePartners').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Insurance))
}

export async function addInsurance(insurance: Insurance): Promise<void> {
  await db.collection('insurancePartners').doc(insurance.id).set(insurance)
}

export async function updateInsurance(id: string, data: Partial<Insurance>): Promise<void> {
  await db.collection('insurancePartners').doc(id).update(data)
}

export async function deleteInsurance(id: string): Promise<void> {
  await db.collection('insurancePartners').doc(id).delete()
}

// ── Admin Users ───────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<User[]> {
  const snap = await db.collection('adminUsers').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User))
}

export async function getAdminUser(id: string): Promise<User | null> {
  const doc = await db.collection('adminUsers').doc(id).get()
  return doc.exists ? ({ id: doc.id, ...doc.data() } as User) : null
}

// ── OTPs ──────────────────────────────────────────────────────────────────────

export async function saveOtp(identifier: string, code: string, expiresAt: number, purpose: string = 'patient'): Promise<void> {
  const docId = `${identifier.toLowerCase()}_${purpose}`
  await db.collection('otps').doc(docId).set({ identifier: identifier.toLowerCase(), code, expiresAt, purpose })
}

export async function getOtp(identifier: string, purpose: string = 'patient'): Promise<OtpEntry | null> {
  const docId = `${identifier.toLowerCase()}_${purpose}`
  const doc = await db.collection('otps').doc(docId).get()
  return doc.exists ? (doc.data() as OtpEntry) : null
}

export async function deleteOtp(identifier: string, purpose: string = 'patient'): Promise<void> {
  const docId = `${identifier.toLowerCase()}_${purpose}`
  await db.collection('otps').doc(docId).delete()
}

// ── Chat Sessions ─────────────────────────────────────────────────────────────

export async function getChatSession(uid: string): Promise<ChatSession | null> {
  const doc = await db.collection('chatSessions').doc(uid).get()
  if (!doc.exists) return null

  const data = doc.data() as ChatSession
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - THREE_MONTHS_MS
  data.messages = data.messages.filter(m => m.timestamp >= cutoff)
  
  return data
}

export async function saveChatSession(uid: string, messages: ChatMessage[], lastUpdated: string): Promise<void> {
  await db.collection('chatSessions').doc(uid).set({
    uid,
    messages,
    lastUpdated,
  })
}

export async function appendChatMessages(uid: string, newMessages: ChatMessage[], lastUpdated: string): Promise<void> {
  const docRef = db.collection('chatSessions').doc(uid)
  await db.runTransaction(async (t) => {
    const doc = await t.get(docRef)
    const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - THREE_MONTHS_MS
    
    let existingMessages: ChatMessage[] = []
    if (doc.exists) {
      existingMessages = (doc.data() as ChatSession).messages || []
    }
    
    const combined = [...existingMessages, ...newMessages]
    const pruned = combined.filter(m => m.timestamp >= cutoff)
    const finalMessages = pruned.slice(-1000) // cap to 1000 messages
    
    t.set(docRef, {
      uid,
      messages: finalMessages,
      lastUpdated,
    }, { merge: true })
  })
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  const snap = await db.collection('chatSessions').get()
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - THREE_MONTHS_MS
  
  return snap.docs.map(d => {
    const data = d.data() as ChatSession
    data.messages = data.messages.filter(m => m.timestamp >= cutoff)
    return data
  })
}

// ── Waitlist ──────────────────────────────────────────────────────────────────

export async function getWaitlist(filters?: {
  doctorId?: string
  date?: string
}): Promise<WaitlistEntry[]> {
  let query: FirebaseFirestore.Query = db.collection('waitlist')
  if (filters?.doctorId) query = query.where('doctorId', '==', filters.doctorId)
  if (filters?.date) query = query.where('date', '==', filters.date)
  const snap = await query.get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistEntry))
}

export async function addWaitlistEntry(entry: WaitlistEntry): Promise<void> {
  await db.collection('waitlist').doc(entry.id).set(entry)
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  await db.collection('waitlist').doc(id).delete()
}

// ── Unanswered Queries (Logs) ─────────────────────────────────────────────────

export async function getUnansweredQueries(): Promise<UnansweredQuery[]> {
  const snap = await db.collection('unansweredQueries').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UnansweredQuery))
}

export async function addUnansweredQuery(query: UnansweredQuery): Promise<void> {
  await db.collection('unansweredQueries').doc(query.id).set(query)
}

export async function deleteUnansweredQuery(id: string): Promise<void> {
  await db.collection('unansweredQueries').doc(id).delete()
}

// ── Callback Tickets (Logs) ───────────────────────────────────────────────────

export async function getCallbackTickets(): Promise<CallbackTicket[]> {
  const snap = await db.collection('callbackTickets').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CallbackTicket))
}

export async function getCallbackTicketsByPatientUid(patientUid: string): Promise<CallbackTicket[]> {
  const snap = await db.collection('callbackTickets').where('patientUid', '==', patientUid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CallbackTicket))
}

export async function addCallbackTicket(ticket: CallbackTicket): Promise<void> {
  await db.collection('callbackTickets').doc(ticket.id).set(ticket)
}

export async function updateCallbackTicket(id: string, data: Partial<CallbackTicket>): Promise<void> {
  await db.collection('callbackTickets').doc(id).update(data)
}

// ── Sent Reminders ────────────────────────────────────────────────────────────

export async function getSentReminders(): Promise<SentReminder[]> {
  const snap = await db.collection('sentReminders').get()
  return snap.docs.map(d => d.data() as SentReminder)
}

export async function markReminderSent(appointmentId: string): Promise<void> {
  await db.collection('sentReminders').doc(appointmentId).set({
    appointmentId,
    sentAt: new Date().toISOString(),
  })
}

// ── Build Hospital Context (for AI prompt) ────────────────────────────────────

export async function buildHospitalContext(): Promise<string> {
  const [doctors, departments, visitingHours, insurancePartners, services] = await Promise.all([
    getDoctors(),
    getDepartments(),
    getVisitingHours(),
    getInsurancePartners(),
    getServices(),
  ])

  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dateStr = today.toISOString().split('T')[0]

  const doctorLines = doctors.map(d => {
    const todaySlots = d.availability[dayName] ?? []
    const weekSummary = Object.entries(d.availability)
      .filter(([, slots]) => slots.length > 0)
      .map(([day, slots]) => `${day}: ${slots.join(', ')}`)
      .join(' | ')
    return `- ${d.name} (id: ${d.id}) | ${d.specialty} | ${d.department} | Room ${d.roomNumber} | Fee ₹${d.consultationFee} | Today (${dayName}) slots: [${todaySlots.join(', ') || 'none'}] | Full week: ${weekSummary}`
  }).join('\n')

  const deptLines = departments.map(d =>
    `- ${d.name}: ${d.description} | Location: ${d.location} | Phone: ${d.phone}`
  ).join('\n')

  const visitLines = visitingHours
    ? `General – Weekdays: ${visitingHours.general.weekdays}, Weekends: ${visitingHours.general.weekends}\nICU – ${visitingHours.icu.allowed}, max ${visitingHours.icu.maxVisitors} visitors. ${visitingHours.icu.notes}`
    : 'Visiting hours not configured.'

  const insLines = insurancePartners.map(i =>
    `- ${i.name} (${i.networkType}): covers [${i.proceduresCovered.join(', ')}] at ${i.coveragePercentage}% | Contact: ${i.contactNumber}`
  ).join('\n')

  const svcLines = services.map(s =>
    `- ${s.name} (id: ${s.id}) | ${s.department} | Duration: ${s.duration} min | Base price: ₹${s.basePrice}`
  ).join('\n')

  return `
TODAY: ${dayName}, ${dateStr}

=== DOCTORS & AVAILABILITY ===
${doctorLines}

=== DEPARTMENTS ===
${deptLines}

=== VISITING HOURS ===
${visitLines}

=== INSURANCE PARTNERS ===
${insLines}

=== SERVICES & PRICING ===
${svcLines}
`.trim()
}

// ── Lab Reports ───────────────────────────────────────────────────────────────

export async function getLabReports(): Promise<LabReport[]> {
  const snap = await db.collection('labReports').get()
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LabReport))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function getLabReport(id: string): Promise<LabReport | null> {
  const doc = await db.collection('labReports').doc(id).get()
  return doc.exists ? ({ id: doc.id, ...doc.data() } as LabReport) : null
}

export async function getPatientReports(email: string): Promise<LabReport[]> {
  const normalizedEmail = email.toLowerCase().trim()
  const snap = await db.collection('labReports').where('patientEmail', '==', normalizedEmail).get()
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LabReport))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function addLabReport(report: LabReport): Promise<void> {
  await db.collection('labReports').doc(report.id).set(report)
}

export async function updateLabReport(id: string, updates: Partial<LabReport>): Promise<void> {
  await db.collection('labReports').doc(id).update(updates)
}

export async function deleteLabReport(id: string): Promise<void> {
  await db.collection('labReports').doc(id).delete()
}

// ── Identities (O(1) Identity Resolution) ─────────────────────────────────────

export interface Identity {
  provider: 'email' | 'phone' | 'google'
  value: string
  patientUid: string
  linkedAt: string
}

/**
 * O(1) lookup: resolve a provider+value to a patient UID.
 * Document ID: `{provider}_{value}` e.g. "email_john@gmail.com"
 */
export async function resolveIdentity(provider: string, value: string): Promise<string | null> {
  const docId = `${provider}_${value}`
  const doc = await db.collection('identities').doc(docId).get()
  if (!doc.exists) return null
  return (doc.data() as Identity).patientUid
}

/**
 * Link a new identity to a patient. Creates/overwrites the identity doc.
 */
export async function linkIdentity(provider: string, value: string, patientUid: string): Promise<void> {
  const docId = `${provider}_${value}`
  const docRef = db.collection('identities').doc(docId)
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef)
    if (doc.exists) {
      const existing = doc.data() as Identity
      if (existing.patientUid !== patientUid) {
        throw new Error(`Identity ${docId} is already linked to another patient (UID: ${existing.patientUid})`)
      }
    }
    transaction.set(docRef, {
      provider,
      value,
      patientUid,
      linkedAt: new Date().toISOString(),
    })
  })
}

/**
 * Get all identities linked to a patient UID.
 */
export async function getPatientIdentities(patientUid: string): Promise<Identity[]> {
  const snap = await db.collection('identities').where('patientUid', '==', patientUid).get()
  return snap.docs.map(d => d.data() as Identity)
}

/**
 * Unlink a specific identity.
 */
export async function unlinkIdentity(provider: string, value: string): Promise<void> {
  const docId = `${provider}_${value}`
  await db.collection('identities').doc(docId).delete()
}

/**
 * Delete ALL identity docs for a patient (used for account deletion).
 */
export async function deleteAllIdentities(patientUid: string): Promise<void> {
  const snap = await db.collection('identities').where('patientUid', '==', patientUid).get()
  if (snap.empty) return
  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
}

// ── Patients ──────────────────────────────────────────────────────────────────

export async function getPatientByUid(uid: string): Promise<Patient | null> {
  const doc = await db.collection('patients').doc(uid).get()
  if (!doc.exists) return null
  return doc.data() as Patient
}

export async function getAllPatients(): Promise<Patient[]> {
  const snap = await db.collection('patients').get()
  return snap.docs.map(d => d.data() as Patient)
}

export async function getPatientByIdentifier(identifier: string): Promise<Patient | null> {
  const normalized = identifier.trim()

  // Try email first (lowercase for email)
  if (normalized.includes('@')) {
    const emailSnap = await db.collection('patients').where('email', '==', normalized.toLowerCase()).limit(1).get()
    if (!emailSnap.empty) {
      return emailSnap.docs[0].data() as Patient
    }
    return null
  }

  // Try phone number — check BOTH formats to avoid duplicate creation
  // WhatsApp sends "917044321580", portal stores "+917044321580"
  const phoneVariants: string[] = [normalized]
  if (normalized.startsWith('+')) {
    phoneVariants.push(normalized.slice(1)) // "+917..." → "917..."
  } else if (/^\d+$/.test(normalized)) {
    phoneVariants.push(`+${normalized}`)   // "917..." → "+917..."
  }

  for (const phone of phoneVariants) {
    const phoneSnap = await db.collection('patients').where('phone', '==', phone).limit(1).get()
    if (!phoneSnap.empty) {
      return phoneSnap.docs[0].data() as Patient
    }
  }

  return null
}

export async function createOrUpdatePatient(data: Partial<Patient> & { uid: string }): Promise<Patient> {
  const existing = await getPatientByUid(data.uid)
  const now = new Date().toISOString()

  if (existing) {
    // Merge: add new auth providers, update contact info if provided
    const updatedProviders = Array.from(new Set([
      ...existing.authProviders,
      ...(data.authProviders || []),
    ]))
    const updates: Partial<Patient> = {
      authProviders: updatedProviders as Patient['authProviders'],
      updatedAt: now,
    }
    if (data.name && !existing.name) updates.name = data.name
    if (data.email && !existing.email) updates.email = data.email
    if (data.phone && !existing.phone) updates.phone = data.phone

    await db.collection('patients').doc(data.uid).update(updates)
    return { ...existing, ...updates }
  }

  // Create new patient
  const patient: any = {
    uid: data.uid,
    name: data.name || '',
    authProviders: data.authProviders || [],
    createdAt: now,
    updatedAt: now,
  }
  if (data.email) patient.email = data.email
  if (data.phone) patient.phone = data.phone
  await db.collection('patients').doc(data.uid).set(patient)
  return patient
}

export async function linkAuthProvider(
  uid: string,
  provider: 'email' | 'phone' | 'google',
  value: string
): Promise<Patient | null> {
  const patient = await getPatientByUid(uid)
  if (!patient) return null

  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  }

  // Add the provider to the list
  if (!patient.authProviders.includes(provider)) {
    updates.authProviders = [...patient.authProviders, provider]
  }

  // Set the contact info
  if (provider === 'email') {
    updates.email = value.toLowerCase().trim()
  } else if (provider === 'phone') {
    updates.phone = value.trim()
  }

  await db.collection('patients').doc(uid).update(updates)
  return { ...patient, ...updates } as Patient
}

// ── Lab Reports by UID ────────────────────────────────────────────────────────

export async function getPatientReportsByUid(uid: string): Promise<LabReport[]> {
  const snap = await db.collection('labReports').where('patientUid', '==', uid).get()
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as LabReport))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
