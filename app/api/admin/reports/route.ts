export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import {
  getLabReports,
  addLabReport,
  updateLabReport,
  deleteLabReport,
  type LabReport,
} from '@/lib/db'
import { storage } from '@/lib/firestore'

export async function GET() {
  try {
    const reports = await getLabReports()
    return NextResponse.json({ reports })
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
    const file = formData.get('file') as File | null

    if (!patientName || !patientEmail || !reportType || !testName || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Upload file to Firebase Cloud Storage
    const bucket = storage.bucket()
    const fileExtension = file.name.split('.').pop()
    const safeFileName = `${reportType}_${Date.now()}.${fileExtension}`
    const storagePath = `reports/${patientEmail}/${safeFileName}`
    const storageFile = bucket.file(storagePath)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    })

    // Make the file public so we can get a download URL
    await storageFile.makePublic()
    const fileUrl = storageFile.publicUrl()

    // 2. Save metadata to Firestore
    const reportId = uuidv4()
    const report: LabReport = {
      id: reportId,
      patientName,
      patientEmail: patientEmail.toLowerCase().trim(),
      patientPhone: patientPhone || '',
      reportType,
      testName,
      fileUrl,
      fileName: file.name,
      notes: notes || '',
      status: 'pending',
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

    if (!id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
    }

    // 1. Delete from Firestore
    await deleteLabReport(id)

    // 2. Try to delete from Cloud Storage to prevent orphans
    if (fileUrl) {
      try {
        const bucket = storage.bucket()
        // Extract the path from the public URL
        // Public URL format: https://storage.googleapis.com/BUCKET_NAME/path/to/file
        // We need 'path/to/file'
        const urlParts = fileUrl.split(bucket.name + '/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          await bucket.file(decodeURIComponent(filePath)).delete()
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
