import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/firestore');
  const snap = await db.collection('doctors').get();
  console.log(`Found ${snap.size} doctors in Firestore!`);
  process.exit(0);
}
main().catch(console.error);
