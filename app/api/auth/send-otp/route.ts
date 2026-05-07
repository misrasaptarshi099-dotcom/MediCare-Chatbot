import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { saveOtp, getOtp, deleteOtp } from '@/lib/db'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(request: Request) {
  const { email } = await request.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Generate a secure 6-digit OTP
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + OTP_TTL_MS

  // Persist the OTP in Firestore
  await saveOtp(email, code, expiresAt, 'patient')

  // Send the OTP via email
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

    await transporter.sendMail({
      from: `"MediCare Patient Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your MediCare Login Code',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #2563eb; border-radius: 10px; padding: 12px 18px;">
              <span style="color: white; font-size: 20px; font-weight: 700;">🏥 MediCare</span>
            </div>
          </div>
          <h2 style="color: #111827; text-align: center; margin-bottom: 8px;">Your Login Code</h2>
          <p style="color: #6b7280; text-align: center; margin-bottom: 24px;">Use this code to sign into the Patient Portal. It expires in 10 minutes.</p>
          <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #e5e7eb; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #2563eb; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #9ca3af; text-align: center; font-size: 13px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Failed to send email. Please check server email configuration.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
