import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getLabReport } from '@/lib/db'
import { storage } from '@/lib/firestore'

async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session) return false

    const { verifyAdminSessionToken } = await import('@/lib/admin-auth')
    const userId = await verifyAdminSessionToken(session.value)
    if (!userId) return false

    const { getAdminUser } = await import('@/lib/db')
    const user = await getAdminUser(userId)
    return !!user
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

    // Use a Signed URL to let the client download directly from Cloud Storage.
    // This eliminates "double egress" (Storage → Server → Client) and reduces
    // serverless memory usage since we no longer buffer the entire file.
    if (report.storagePath) {
      const file = storage.bucket().file(report.storagePath)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 5 * 60 * 1000, // 5-minute expiry
        responseDisposition: `attachment; filename="${(report.fileName || 'report.pdf').replace(/["\\\n\r]/g, '_')}"`,
        responseType: 'application/pdf',
      })

      return NextResponse.redirect(signedUrl, 307)
    }

    // Fallback: if no storagePath, proxy from the legacy fileUrl
    const response = await fetch(report.fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch report file: ${response.statusText}`)
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer())

    const safe = (report.fileName || 'report.pdf').replace(/["\\\n\r]/g, '_')
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safe}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Report download error:', error)
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 })
  }
}

