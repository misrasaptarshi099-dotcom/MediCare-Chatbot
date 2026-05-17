import { requireAdminSession } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getLabReports, updateLabReport } from '@/lib/db'
import { storage } from '@/lib/firestore'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

const portalBaseUrl =
  process.env.PATIENT_PORTAL_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'

export async function POST(request: Request) {
  const adminUser = await requireAdminSession();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json()
    const { reportId } = body

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // 1. Fetch report details
    const reports = await getLabReports()
    const report = reports.find(r => r.id === reportId)

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // 2. Read the file directly from Storage when path exists; fallback to URL for legacy records
    let buffer: Buffer
    if (report.storagePath) {
      const bucket = storage.bucket()
      const [fileBuffer] = await bucket.file(report.storagePath).download()
      buffer = fileBuffer
    } else {
      const fileResponse = await fetch(report.fileUrl)
      if (!fileResponse.ok) {
        throw new Error(`Failed to download report file from storage: ${fileResponse.statusText}`)
      }
      const arrayBuffer = await fileResponse.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    // 3. Build email content
    // Use an anti-clip preheader just like the reminder email
    const preheader = `Your ${report.testName} results are ready. &zwnj;&nbsp;`.repeat(15)
    
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="display: none; max-height: 0px; overflow: hidden;">
            ${preheader}
          </div>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0f172a; margin-bottom: 5px;">MediCare Hospital</h1>
            <p style="color: #64748b; margin-top: 0;">Diagnostic Services</p>
          </div>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Your Lab Report is Ready</h2>
            <p>Dear ${report.patientName},</p>
            <p>Your recent diagnostic test results are now available. We have attached the report to this email for your convenience.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0;"><strong>Test Name:</strong> ${report.testName}</p>
              <p style="margin: 5px 0;"><strong>Category:</strong> ${report.reportType === 'blood_test' ? 'Blood Test' : 'X-Ray / Imaging'}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(report.createdAt).toLocaleDateString()}</p>
              ${report.notes ? `<p style="margin: 5px 0; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;"><strong>Doctor's Notes:</strong><br/>${report.notes}</p>` : ''}
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${portalBaseUrl}/patient/login" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                View in Patient Portal
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <p style="margin: 5px 0;">If you have any questions about your results, please contact your referring doctor or reply to this email.</p>
            <p style="margin: 5px 0;">Best regards,<br/>MediCare Diagnostics Team</p>
          </div>
        </body>
      </html>
    `

    // 4. Send email
    await transporter.sendMail({
      from: `"MediCare Diagnostics" <${process.env.EMAIL_USER}>`,
      to: report.patientEmail,
      subject: `Your Lab Report: ${report.testName}`,
      html,
      attachments: [
        {
          filename: report.fileName,
          content: buffer,
        }
      ]
    })

    // 5. Update status
    await updateLabReport(reportId, { 
      status: 'sent',
      sentAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error sending report email:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
  }
}
