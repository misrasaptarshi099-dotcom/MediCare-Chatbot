/**
 * Input Sanitization & Validation
 *
 * Provides Zod schemas and helpers to validate and sanitize all user-facing
 * inputs before they touch Firestore or Nodemailer HTML templates.
 *
 * Key protections:
 * - Max-length constraints prevent database overflow / payload abuse
 * - HTML tag stripping prevents XSS in Nodemailer email templates
 * - Strict type checks prevent NoSQL injection via non-string fields
 */

import { z } from 'zod'

// ── HTML Sanitizer ────────────────────────────────────────────────────────────

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
}
const HTML_ESCAPE_RE = /[&<>"'`/]/g

/**
 * HTML-encode special characters to prevent XSS when the value is later
 * embedded in Nodemailer HTML templates or admin dashboard views.
 */
export function sanitizeHtml(text: string): string {
  return text.replace(HTML_ESCAPE_RE, (char) => HTML_ENTITY_MAP[char] || char).trim()
}

/**
 * Normalize plain text for Firestore storage: trim, collapse whitespace, strip
 * control characters. Does NOT HTML-encode — use sanitizeHtml at HTML sinks.
 */
export function sanitizePlainText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Zod Schemas ───────────────────────────────────────────────────────────────

/** Chat message from the web portal */
export const chatMessageSchema = z.object({
  query: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message is too long (max 1000 characters)')
    .transform(sanitizePlainText),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })
    )
    .max(100, 'Conversation history too long')
    .optional()
    .default([]),
  uid: z.string().max(128).optional(),
  email: z.string().email().max(254).optional(),
})

/** Appointment booking payload */
export const appointmentSchema = z.object({
  patientName: z
    .string()
    .min(1, 'Patient name is required')
    .max(100, 'Patient name is too long')
    .transform(sanitizePlainText),
  patientPhone: z
    .string()
    .max(20, 'Phone number is too long')
    .optional()
    .default(''),
  patientEmail: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .email('Invalid email format')
      .max(254)
      .optional()
      .default('')
  ),
  patientUid: z.string().max(128).optional(),
  doctorId: z.string().max(100).optional(),
  doctorName: z
    .string()
    .max(100)
    .transform(sanitizePlainText)
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .max(10),
  time: z.string().max(20),
  service: z
    .string()
    .max(200, 'Service name is too long')
    .transform(sanitizePlainText)
    .optional()
    .default('General Consultation'),
  paymentStatus: z.enum(['paid', 'unpaid', 'refunded']).optional(),
  amount: z.number().min(0).max(1000000).optional(),
})

/** Admin login payload */
export const adminLoginSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(50, 'Username is too long')
    .transform(sanitizePlainText),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
})

/** OTP send payload (admin) */
export const adminOtpSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(254, 'Email is too long'),
})

/** OTP send payload (patient — email or phone) */
export const patientOtpSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Identifier is required')
    .max(254, 'Identifier is too long')
    .refine(
      (val) => {
        const trimmed = val.trim()
        // Valid email or valid phone (digits with optional leading +)
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || /^\+?[0-9]{10,15}$/.test(trimmed)
      },
      { message: 'Must be a valid email address or phone number' }
    ),
})

/** OTP verify payload */
export const verifyOtpSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(254),
  code: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must be numeric'),
})

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Validate input against a Zod schema and return the parsed result or an
 * error message string.
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const message = result.error.issues.map(i => i.message).join('; ')
  return { success: false, error: message }
}
