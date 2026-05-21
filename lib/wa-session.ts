/**
 * WhatsApp Session Manager
 *
 * Persists conversation state per phone number in Firestore.
 * Each session tracks where the patient is in the conversation flow
 * and any temporary data (selected department, doctor, date, etc.).
 */

import { db } from './firestore'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WaStep =
  | 'MAIN_MENU'
  | 'BOOK_DEPT'
  | 'BOOK_DOCTOR'
  | 'BOOK_DATE'
  | 'BOOK_SLOT'
  | 'BOOK_CONFIRM'
  | 'VIEW_APPOINTMENTS'
  | 'VIEW_REPORTS'
  | 'REPORT_SELECT'
  | 'AI_CHAT'
  | 'CALLBACK_DEPT'
  | 'CALLBACK_QUERY'
  | 'ASK_NAME'
  | 'BOOK_CUSTOM_DATE'
  | 'ASK_EMAIL'
  | 'VERIFY_EMAIL_OTP'
export interface WaSessionData {
  /** Cached list of department IDs for the current menu */
  deptList?: string[]
  /** Cached list of doctor IDs for the current menu */
  doctorList?: string[]
  /** Cached list of time slots for the current menu */
  slotList?: string[]
  /** Cached list of appointment IDs for viewing */
  appointmentList?: string[]
  /** Cached list of report IDs for viewing */
  reportList?: string[]

  selectedDeptId?: string
  selectedDeptName?: string
  selectedDoctorId?: string
  selectedDoctorName?: string
  selectedDoctorFee?: number
  selectedDate?: string   // YYYY-MM-DD
  selectedTime?: string   // HH:mm or display format
  selectedService?: string
  reschedulingAptId?: string

  callbackDept?: string

  /** AI chat conversation history for multi-turn context */
  chatHistory?: Array<{ role: 'user' | 'model'; text: string }>
}

export interface WaSession {
  phone: string
  patientUid?: string
  patientName?: string
  patientPhone?: string
  step: WaStep
  data: WaSessionData
  lastActive: string // ISO timestamp
}

// ── Firestore Collection ──────────────────────────────────────────────────────

const COLLECTION = 'waSessions'

/**
 * Retrieve the current session for a WhatsApp phone number.
 * Returns null if no session exists yet.
 */
export async function getWaSession(phone: string): Promise<WaSession | null> {
  const doc = await db.collection(COLLECTION).doc(phone).get()
  return doc.exists ? (doc.data() as WaSession) : null
}

/**
 * Create or update a session. Uses Firestore merge so partial
 * updates don't wipe existing fields.
 */
export async function setWaSession(phone: string, updates: Partial<WaSession>): Promise<void> {
  await db.collection(COLLECTION).doc(phone).set(
    { ...updates, lastActive: new Date().toISOString() },
    { merge: true },
  )
}

/**
 * Reset a session back to the main menu, clearing all temporary data.
 */
export async function resetWaSession(phone: string, patientUid?: string, patientName?: string): Promise<void> {
  await db.collection(COLLECTION).doc(phone).set({
    phone,
    patientUid: patientUid || null,
    patientName: patientName || null,
    step: 'MAIN_MENU' as WaStep,
    data: {},
    lastActive: new Date().toISOString(),
  })
}
