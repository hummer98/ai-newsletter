import { Firestore } from '@google-cloud/firestore';

async function main(): Promise<void> {
  console.log('[CheckSchedule] Checking theme schedules in Firestore...');

  const firestore = new Firestore();
  const snapshot = await firestore.collection('themes').get();

  console.log(`\nFound ${snapshot.docs.length} theme(s):\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Title: ${data.title}`);
    console.log(`  Schedule: ${data.schedule || '(no schedule - delivers daily)'}`);
    console.log(`  Last Delivered: ${data.lastDeliveredAt ? data.lastDeliveredAt.toDate().toISOString() : '(never)'}`);
    console.log('');
  }

  // Show what day of week today is
  const today = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(`Today is: ${days[today.getDay()]} (${today.toISOString().split('T')[0]})`);
}

main().catch((error) => {
  console.error('[CheckSchedule] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
