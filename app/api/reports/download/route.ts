import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminUsers, getLabReport } from '@/lib/db'
import { storage } from '@/lib/firestore'

function buildContentDisposition(fileName: string) {
  const safe = fileName.replace(/["\\]/g, '_')
  return `attachment; filename="${safe}"`
}

async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session) return false

    const decoded = Buffer.from(session.value, 'base64').toString()
    const [userId] = decoded.split(':')
    if (!userId) return false

    const users = await getAdminUsers()
    return users.some(user => user.id === userId)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get('reportId')
  const uid = searchParams.get('uid')

  if (!reportId) {
    return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
  }

  try {
    const report = await getLabReport(reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const isAdmin = await isAdminAuthenticated()
    const isPatientMatch = !!uid && uid === report.patientUid
    if (!isAdmin && !isPatientMatch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let fileBuffer: Buffer
    if (report.storagePath) {
      const [buffer] = await storage.bucket().file(report.storagePath).download()
      fileBuffer = buffer
    } else {
      const response = await fetch(report.fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch report file: ${response.statusText}`)
      }
      fileBuffer = Buffer.from(await response.arrayBuffer())
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': buildContentDisposition(report.fileName || 'report.pdf'),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Report download error:', error)
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 })
  }
}
