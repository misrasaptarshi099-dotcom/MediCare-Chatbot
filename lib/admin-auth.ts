import { cookies } from 'next/headers'
import { db } from '@/lib/firestore'
import { getAdminUsers, type User } from '@/lib/db'
import crypto from 'crypto'

export async function createAdminSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await db.collection('adminSessions').doc(token).set({
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  return token;
}

export async function verifyAdminSessionToken(token: string): Promise<string | null> {
  const doc = await db.collection('adminSessions').doc(token).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (new Date(data!.expiresAt) < new Date()) return null;
  return data!.userId;
}

export async function deleteAdminSession(token: string): Promise<void> {
  await db.collection('adminSessions').doc(token).delete();
}

export async function requireAdminSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')
  
  if (!session?.value) return null
  
  const userId = await verifyAdminSessionToken(session.value)
  if (!userId) return null

  const users = await getAdminUsers()
  return users.find(u => u.id === userId) ?? null
}
