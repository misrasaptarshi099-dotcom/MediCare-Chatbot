import { db } from './firestore'

// ── Interfaces ────────────────────────────────────────────────────────────────

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
  doctorId: string
  doctorName: string
  date: string
  time: string
  service: string
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: string
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
  email: string
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
  service: string
  createdAt: string
}

export interface SentReminder {
  appointmentId: string
  sentAt: string
}

export interface OtpEntry {
  email: string
  code: string
  expiresAt: number
  purpose?: string
}

export interface LabReport {
  id: string
  patientName: string
  patientEmail: string
  patientPhone: string
  reportType: 'blood_test' | 'xray'
  testName: string
  fileUrl: string
  fileName: string
  notes?: string
  status: 'pending' | 'ready' | 'sent'
  createdAt: string
  sentAt?: string
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export async function getDoctors(): Promise<Doctor[]> {
  const snap = await db.collection('doctors').get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Doctor))
}

export async function getDoctor(id: string): Promise<Doctor | null> {
  const doc = await db.collection('doctors').doc(id).get()
  return doc.exists ? ({ id: doc.id, ...doc.data() } as Doctor) : null
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

export async function addAppointment(appointment: Appointment): Promise<void> {
  await db.collection('appointments').doc(appointment.id).set(appointment)
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

export async function saveOtp(email: string, code: string, expiresAt: number, purpose: string = 'patient'): Promise<void> {
  const docId = `${email.toLowerCase()}_${purpose}`
  await db.collection('otps').doc(docId).set({ email: email.toLowerCase(), code, expiresAt, purpose })
}

export async function getOtp(email: string, purpose: string = 'patient'): Promise<OtpEntry | null> {
  const docId = `${email.toLowerCase()}_${purpose}`
  const doc = await db.collection('otps').doc(docId).get()
  return doc.exists ? (doc.data() as OtpEntry) : null
}

export async function deleteOtp(email: string, purpose: string = 'patient'): Promise<void> {
  const docId = `${email.toLowerCase()}_${purpose}`
  await db.collection('otps').doc(docId).delete()
}

// ── Chat Sessions ─────────────────────────────────────────────────────────────

export async function getChatSession(email: string): Promise<ChatSession | null> {
  const doc = await db.collection('chatSessions').doc(email.toLowerCase()).get()
  return doc.exists ? (doc.data() as ChatSession) : null
}

export async function saveChatSession(email: string, messages: ChatMessage[], lastUpdated: string): Promise<void> {
  await db.collection('chatSessions').doc(email.toLowerCase()).set({
    email: email.toLowerCase(),
    messages,
    lastUpdated,
  })
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  const snap = await db.collection('chatSessions').get()
  return snap.docs.map(d => d.data() as ChatSession)
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
    return `- ${d.name} | ${d.specialty} | ${d.department} | Room ${d.roomNumber} | Fee $${d.consultationFee} | Today (${dayName}) slots: [${todaySlots.join(', ') || 'none'}] | Full week: ${weekSummary}`
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
    `- ${s.name} (id: ${s.id}) | ${s.department} | Duration: ${s.duration} min | Base price: $${s.basePrice}`
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
