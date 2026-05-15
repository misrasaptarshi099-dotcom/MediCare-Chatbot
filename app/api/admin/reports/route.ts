export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import {
  getLabReports,
  addLabReport,
  updateLabReport,
  deleteLabReport,
  getAllAppointments,
  getAllPatients,
  type LabReport,
} from '@/lib/db'
import { storage } from '@/lib/firestore'

function extractStoragePathFromUrl(fileUrl: string, bucketName: string): string | null {
  try {
    const parsed = new URL(fileUrl)
    const prefix = `/${bucketName}/`
    if (parsed.pathname.startsWith(prefix)) {
      return decodeURIComponent(parsed.pathname.slice(prefix.length))
    }
    return null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const reports = await getLabReports()
    
    const allAppointments = await getAllAppointments()
    const diagnosticKeywords = ['blood', 'test', 'panel', 'scan', 'x-ray', 'xray', 'mri', 'ultrasound', 'cbc', 'kft', 'lft', 'tft']
    
    const pendingUploads = allAppointments.filter(apt => 
      apt.status === 'completed' &&
      diagnosticKeywords.some(kw => apt.service.toLowerCase().includes(kw)) &&
      !reports.some(r => r.appointmentId === apt.id)
    )

    return NextResponse.json({ reports, pendingUploads })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    const patientName = formData.get('patientName') as string
    const patientEmail = formData.get('patientEmail') as string
    const patientPhone = formData.get('patientPhone') as string
    const reportType = formData.get('reportType') as 'blood_test' | 'xray'
    const testName = formData.get('testName') as string
    const notes = formData.get('notes') as string
    const appointmentId = formData.get('appointmentId') as string | null
    const file = formData.get('file') as File | null

    if (!patientName || !patientEmail || !reportType || !testName || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Upload file to Firebase Cloud Storage
    const bucket = storage.bucket()
    const fileExtension = file.name.split('.').pop()
    const safeFileName = `${reportType}_${Date.now()}.${fileExtension}`
    const normalizedEmail = patientEmail.toLowerCase().trim()
    const storagePath = `reports/${normalizedEmail}/${safeFileName}`
    const storageFile = bucket.file(storagePath)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    })

    let fileUrl: string
    try {
      await storageFile.makePublic()
      fileUrl = storageFile.publicUrl()
    } catch {
      // Fallback when bucket uses uniform bucket-level access (ACLs disabled).
      const [signedUrl] = await storageFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 30,
      })
      fileUrl = signedUrl
    }

    // 2. Resolve patientUid for strict linking
    let patientUid = ''
    if (appointmentId) {
      const appointments = await getAllAppointments()
      const apt = appointments.find(a => a.id === appointmentId)
      if (apt?.patientUid) {
        patientUid = apt.patientUid
      }
    }
    if (!patientUid) {
      // Fallback: lookup by email or phone
      const patients = await getAllPatients()
      const match = patients.find(p => 
        (p.email && p.email.toLowerCase().trim() === normalizedEmail) || 
        (p.phone && p.phone === patientPhone)
      )
      if (match) {
        patientUid = match.uid
      }
    }

    // 3. Save metadata to Firestore
    const reportId = uuidv4()
    const report: LabReport = {
      id: reportId,
      patientName,
      patientEmail: normalizedEmail,
      patientPhone: patientPhone || '',
      ...(patientUid && { patientUid }),
      reportType,
      testName,
      fileUrl,
      storagePath,
      fileName: file.name,
      notes: notes || '',
      status: 'pending',
      ...(appointmentId && { appointmentId }),
      createdAt: new Date().toISOString()
    }

    await addLabReport(report)

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    console.error('Error uploading report:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload report' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    await updateLabReport(id, updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating report:', error)
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const fileUrl = searchParams.get('fileUrl')
    const storagePath = searchParams.get('storagePath')

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // 1. Delete from Firestore
    await deleteLabReport(id)

    // 2. Try to delete from Cloud Storage to prevent orphans
    if (storagePath || fileUrl) {
      try {
        const bucket = storage.bucket()
        const filePath = storagePath || extractStoragePathFromUrl(fileUrl as string, bucket.name)
        if (filePath) {
          await bucket.file(filePath).delete()
        }
      } catch (err) {
        console.warn('Failed to delete file from storage, but metadata was deleted:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting report:', error)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }
}
