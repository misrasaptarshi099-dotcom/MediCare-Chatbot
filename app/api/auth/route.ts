import { NextResponse } from 'next/server'
import { getAdminUserByUsername } from '@/lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createAdminSession, requireAdminSession, deleteAdminSession } from '@/lib/admin-auth'
import { checkRateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { adminLoginSchema, validateInput } from '@/lib/sanitize'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)

    // Rate limit: 5 failed attempts per 15 minutes
    const shortKey = rateLimitKey('login-short', ip)
    const shortCheck = checkRateLimit(shortKey, 5, 15 * 60 * 1000)
    if (!shortCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 15 minutes.' },
        { status: 429 }
      )
    }

    // Rate limit: 10 failed attempts per day
    const dailyKey = rateLimitKey('login-daily', ip)
    const dailyCheck = checkRateLimit(dailyKey, 10, 24 * 60 * 60 * 1000)
    if (!dailyCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts today. Please try again tomorrow.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Input validation
    const validation = validateInput(adminLoginSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { username, password } = validation.data

    const user = await getAdminUserByUsername(username)

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create secure session token
    const sessionToken = await createAdminSession(user.id)
    
    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Error in auth:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')

    const user = await requireAdminSession()

    if (!user) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Error checking auth:', error)
    return NextResponse.json({ authenticated: false })
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    
    if (session?.value) {
      await deleteAdminSession(session.value)
    }
    
    cookieStore.delete('session')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging out:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

