import { cookies } from 'next/headers'
import { db } from '@/lib/firestore'
import { getAdminUser, type User } from '@/lib/db'
import crypto from 'crypto'

/**
 * Create a new admin session token with expiry metadata.
 * The session doc also stores a createdAt timestamp for TTL cleanup.
 */
export async function createAdminSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  await db.collection('adminSessions').doc(token).set({
    userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  return token;
}

/**
 * Verify a session token. Returns the userId if valid, null otherwise.
 * Automatically deletes the session doc if it's expired.
 */
export async function verifyAdminSessionToken(token: string): Promise<string | null> {
  const docRef = db.collection('adminSessions').doc(token);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  if (new Date(data.expiresAt) < new Date()) {
    // Expired — clean it up immediately
    await docRef.delete().catch(() => {});
    return null;
  }
  return data.userId;
}

export async function deleteAdminSession(token: string): Promise<void> {
  await db.collection('adminSessions').doc(token).delete();
}

/**
 * Purge all expired admin sessions from Firestore.
 * Called opportunistically to prevent unbounded accumulation of stale sessions.
 */
export async function purgeExpiredAdminSessions(): Promise<number> {
  const now = new Date().toISOString();
  const expiredSnap = await db.collection('adminSessions')
    .where('expiresAt', '<', now)
    .limit(100) // batch to avoid large deletes
    .get();

  if (expiredSnap.empty) return 0;

  const batch = db.batch();
  expiredSnap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  return expiredSnap.size;
}

export async function requireAdminSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')
  
  if (!session?.value) return null
  
  const userId = await verifyAdminSessionToken(session.value)
  if (!userId) return null

  // Opportunistically purge expired sessions (~1% of requests)
  if (Math.random() < 0.01) {
    purgeExpiredAdminSessions().catch(() => {});
  }

  return await getAdminUser(userId)
}
