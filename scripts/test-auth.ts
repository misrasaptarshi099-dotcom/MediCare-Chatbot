import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import admin from 'firebase-admin'

if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: projectId as string,
      clientEmail: clientEmail as string,
      privateKey: privateKey as string,
    }),
  })
}

async function test() {
  try {
    const user = await admin.auth().getUserByPhoneNumber('+917044321588')
    console.log('User found:', user.uid)
  } catch (err: any) {
    console.log('User not found. Attempting to create...')
    try {
      const newUser = await admin.auth().createUser({
        phoneNumber: '+917044321588',
        displayName: 'Linking'
      })
      console.log('User created:', newUser.uid)
    } catch (createErr: any) {
      console.error('Create error:', createErr.message)
    }
  }
}

test()
