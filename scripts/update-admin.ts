import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  console.log('🔄 Connecting to Firestore to update users and clear patient data...');
  
  const { db } = await import('../lib/firestore');

  const TARGET_EMAIL = 'misrasaptarshi099@gmail.com';

  // 1. ADD ADMIN TO THE CORRECT COLLECTION (adminUsers)
  const adminUsersRef = db.collection('adminUsers');
  const adminSnapshot = await adminUsersRef.where('email', '==', TARGET_EMAIL).get();
  
  if (adminSnapshot.empty) {
    await adminUsersRef.doc('admin-1').set({
      id: 'admin-1',
      username: 'admin',
      email: TARGET_EMAIL,
      role: 'admin',
      name: 'Hospital Administrator',
      createdAt: new Date().toISOString()
    });
    console.log(`✅ Created new Admin account in adminUsers: ${TARGET_EMAIL}`);
  } else {
    console.log(`✅ Admin account already exists in adminUsers: ${TARGET_EMAIL}`);
  }

  // 2. CLEAR PREVIOUS PATIENT DATA WITH THIS EMAIL
  console.log('🧹 Clearing previous patient data for this email...');
  
  // Clear from Chats
  const chatsSnap = await db.collection('chats').where('email', '==', TARGET_EMAIL).get();
  for (const doc of chatsSnap.docs) {
    await doc.ref.delete();
  }
  console.log(`🗑️ Deleted ${chatsSnap.size} old chat sessions.`);

  // Clear from Appointments
  const apptSnap = await db.collection('appointments').where('patientEmail', '==', TARGET_EMAIL).get();
  for (const doc of apptSnap.docs) {
    await doc.ref.delete();
  }
  console.log(`🗑️ Deleted ${apptSnap.size} old appointments.`);

  // Clear from Callback Tickets
  const ticketSnap = await db.collection('callbackTickets').where('patientEmail', '==', TARGET_EMAIL).get();
  for (const doc of ticketSnap.docs) {
    await doc.ref.delete();
  }
  console.log(`🗑️ Deleted ${ticketSnap.size} old callback tickets.`);

  console.log('🎉 Database update complete!');
  process.exit(0);
}

main().catch(console.error);
