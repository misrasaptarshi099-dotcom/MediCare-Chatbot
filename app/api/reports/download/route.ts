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

/** Build a short-lived signed URL or fall back to a proxied file buffer. */
async function buildDownloadUrl(report: { storagePath?: string; fileUrl?: string; fileName?: string }) {
  const safe = (report.fileName || 'report.pdf').replace(/["\\\\\\n\\r]/g, '_')

  if (report.storagePath) {
    const file = storage.bucket().file(report.storagePath)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000, // 5-minute expiry
      responseDisposition: `attachment; filename="${safe}"`,
      responseType: 'application/pdf',
    })
    return { signedUrl }
  }

  // Legacy fallback: no storagePath, proxy from fileUrl
  if (report.fileUrl) {
    const response = await fetch(report.fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch report file: ${response.statusText}`)
    }
    const fileBuffer = Buffer.from(await response.arrayBuffer())
    return { fileBuffer, fileName: safe }
  }

  throw new Error('Report has no storage path or file URL')
}

// ── GET: admin-only direct downloads (cookie-authenticated) ─────────────────
// Admin dashboard links use plain <a href="..."> which can only do GET.
// Auth is via the HTTP-only session cookie — no token in the URL.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get('reportId')

  if (!reportId) {
    return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
  }

  try {
    const isAdmin = await isAdminAuthenticated()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const report = await getLabReport(reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const result = await buildDownloadUrl(report)
    if ('signedUrl' in result) {
      return NextResponse.redirect(result.signedUrl, 307)
    }

    return new NextResponse(result.fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Report download error:', error)
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 })
  }
}

// ── POST: patient downloads (Bearer token in Authorization header) ──────────
// Returns JSON { url } with a short-lived signed Cloud Storage URL.
// The patient's ID token never appears in a URL, log, or Referer header.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const { adminAuth } = await import('@/lib/firebase-admin')
    let patientUid: string
    try {
      const decoded = await adminAuth.verifyIdToken(idToken)
      patientUid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reportId = body.reportId
    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    const report = await getLabReport(reportId)
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (report.patientUid !== patientUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const result = await buildDownloadUrl(report)
    if ('signedUrl' in result) {
      return NextResponse.json({ url: result.signedUrl })
    }

    // Legacy fallback: return the file inline since we can't produce a URL
    return new NextResponse(result.fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Report download error:', error)
    return NextResponse.json({ error: 'Failed to download report' }, { status: 500 })
  }
}
