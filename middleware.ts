import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy for admin route protection and CSRF validation.
 *
 * 1.6 FIX — Admin pages (/admin/*) are protected at the Edge layer:
 *   If no `session` cookie is present, redirect to /login immediately.
 *   This prevents the client-side-only auth check in admin/layout.tsx from
 *   being the sole gatekeeper (which could be bypassed via devtools/sessionStorage).
 *   Note: Full session validity is still verified server-side by requireAdminSession().
 *
 * 1.8 FIX — CSRF protection for state-changing admin API requests:
 *   POST/PUT/PATCH/DELETE requests to /api/admin/* must include an Origin or Referer
 *   header matching the app's own host. This prevents cross-origin form submissions
 *   from tricking an admin's browser into performing actions.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1.6: Admin page guard ──────────────────────────────────────────────────
  // Protect /admin pages (but NOT /api/admin — those have their own requireAdminSession checks)
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get('session')
    if (!sessionCookie?.value) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── 1.8: CSRF protection for state-changing admin API requests ─────────────
  if (
    pathname.startsWith('/api/admin') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')

    if (!host) {
      return NextResponse.json({ error: 'Missing host header' }, { status: 400 })
    }

    // Accept if Origin matches host
    if (origin) {
      try {
        const originHost = new URL(origin).host
        if (originHost !== host) {
          return NextResponse.json(
            { error: 'CSRF validation failed: origin mismatch' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'CSRF validation failed: malformed origin' },
          { status: 403 }
        )
      }
    } else if (referer) {
      // Fallback to Referer if Origin is absent (some browsers omit Origin on same-origin)
      try {
        const refererHost = new URL(referer).host
        if (refererHost !== host) {
          return NextResponse.json(
            { error: 'CSRF validation failed: referer mismatch' },
            { status: 403 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'CSRF validation failed: malformed referer' },
          { status: 403 }
        )
      }
    } else {
      // Neither Origin nor Referer present — block the request.
      // Legitimate browser requests always send at least one of these.
      return NextResponse.json(
        { error: 'CSRF validation failed: missing origin/referer' },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Admin pages (1.6)
    '/admin/:path*',
    // Admin API routes for CSRF (1.8)
    '/api/admin/:path*',
  ],
}
