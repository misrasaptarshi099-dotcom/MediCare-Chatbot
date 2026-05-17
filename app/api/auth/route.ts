import { NextResponse } from 'next/server'
import { getAdminUsers, type User } from '@/lib/db'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { createAdminSession, requireAdminSession, deleteAdminSession } from '@/lib/admin-auth'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const users = await getAdminUsers()
    const user = users.find(u => u.username === username)

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
