import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const deletePhoneUser = async () => {
  const adminMod = await import('firebase-admin')
  const admin = adminMod.default || adminMod

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      })
    })
  }

  try {
    const auth = admin.auth()
    const user = await auth.getUserByPhoneNumber('+917044321580')
    await auth.deleteUser(user.uid)
    console.log('Successfully deleted the orphaned phone account:', user.uid)
  } catch (err: any) {
    console.log('Phone account not found or already deleted:', err.message)
  }
}

deletePhoneUser()
