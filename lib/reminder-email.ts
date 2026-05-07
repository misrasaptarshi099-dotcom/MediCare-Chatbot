import nodemailer from 'nodemailer'
import type { Appointment } from './db'

export interface ReminderEmailData {
  appointment: Appointment
  patientEmail: string
}

function buildReminderHtml(apt: Appointment): string {
  const isGeneralOrConsult = apt.service?.toLowerCase().includes('consult') || apt.service?.toLowerCase().includes('general')
  const fastingNote = isGeneralOrConsult
    ? '<li>You may eat and drink normally before this consultation.</li>'
    : '<li><strong>Fasting required:</strong> Do not eat or drink anything (except water) for at least 8 hours before your appointment.</li>'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:36px;">🏥</span>
      </div>
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Appointment Tomorrow!</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Your preparation checklist from MediCare Hospital</p>
    </div>

    <!-- Appointment Details -->
    <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">📋 Appointment Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;width:45%;">Doctor</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.doctorName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Service</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.service || 'General Consultation'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Date</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.date}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Time</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.time}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:14px;">Patient</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.patientName}</td>
        </tr>
      </table>
    </div>

    <!-- Preparation Checklist -->
    <div style="padding:24px 32px;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">✅ Preparation Checklist</h2>

      <div style="margin-bottom:20px;">
        <h3 style="color:#1d4ed8;font-size:14px;margin:0 0 8px;">🍽️ Fasting Instructions</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          ${fastingNote}
          <li>Drinking plain water is always allowed.</li>
          <li>Avoid alcohol 24 hours before your visit.</li>
        </ul>
      </div>

      <div style="margin-bottom:20px;">
        <h3 style="color:#1d4ed8;font-size:14px;margin:0 0 8px;">📁 Documents to Carry</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Government-issued photo ID (Aadhaar / Passport / Driving Licence)</li>
          <li>Insurance card and policy details</li>
          <li>Referral letter from your GP (if applicable)</li>
          <li>Previous test reports, X-rays, or prescription history</li>
          <li>List of current medications you are taking</li>
        </ul>
      </div>

      <div style="margin-bottom:20px;">
        <h3 style="color:#1d4ed8;font-size:14px;margin:0 0 8px;">🚗 Parking &amp; Arrival Info</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Please arrive <strong>15 minutes early</strong> to complete registration.</li>
          <li>Parking is available in Basement Level B1 &amp; B2 (validated for 3 hours).</li>
          <li>Drop-off zone available at the Main Entrance (Ground Floor).</li>
          <li>Wheelchair assistance: inform reception on arrival.</li>
        </ul>
      </div>

      <div style="margin-bottom:8px;">
        <h3 style="color:#1d4ed8;font-size:14px;margin:0 0 8px;">👕 What to Wear</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Comfortable, loose-fitting clothing.</li>
          <li>Avoid heavy jewellery or accessories.</li>
        </ul>
      </div>
    </div>

    <!-- Help -->
    <div style="padding:20px 32px;background:#eff6ff;border-top:1px solid #dbeafe;">
      <p style="color:#1e40af;font-size:13px;margin:0;text-align:center;">
        Need to cancel or reschedule? Log in to the 
        <a href="http://localhost:3000/patient" style="color:#1d4ed8;font-weight:600;">Patient Portal</a>
        or call <strong>+1-800-MEDICARE</strong>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;text-align:center;background:#f8fafc;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        MediCare Hospital · This is an automated reminder — please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendAppointmentReminder(apt: Appointment): Promise<void> {
  const to = apt.patientEmail
  if (!to) throw new Error('No patient email on appointment')

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })

  await transporter.sendMail({
    from: `"MediCare Hospital" <${process.env.EMAIL_USER}>`,
    to,
    subject: `⏰ Reminder: Your appointment with ${apt.doctorName} is tomorrow — ${apt.date} at ${apt.time}`,
    html: buildReminderHtml(apt),
  })
}
