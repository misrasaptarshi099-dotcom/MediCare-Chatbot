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

  callbackDept?: string
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
 * Retrieve the persisted WhatsApp session for the given phone number.
 *
 * @param phone - The WhatsApp phone number used as the session document ID
 * @returns The session record for `phone`, or `null` if no document exists
 */
export async function getWaSession(phone: string): Promise<WaSession | null> {
  const doc = await db.collection(COLLECTION).doc(phone).get()
  return doc.exists ? (doc.data() as WaSession) : null
}

/**
 * Create or update the WhatsApp session for the given phone.
 *
 * Merges the provided session fields into the stored session and updates the session's `lastActive` timestamp.
 *
 * @param phone - The WhatsApp phone identifier used as the session document ID
 * @param updates - Partial session fields to set or merge into the stored session; omitted fields remain unchanged
 */
export async function setWaSession(phone: string, updates: Partial<WaSession>): Promise<void> {
  await db.collection(COLLECTION).doc(phone).set(
    { ...updates, lastActive: new Date().toISOString() },
    { merge: true },
  )
}

/**
 * Reset the WhatsApp session for a phone to the `MAIN_MENU` state and clear session data.
 *
 * @param phone - The WhatsApp phone identifier used as the session document ID
 * @param patientUid - Optional patient UID to store on the session; when omitted the stored value is set to `null`
 * @param patientName - Optional patient name to store on the session; when omitted the stored value is set to `null`
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
