import { Firestore } from '@google-cloud/firestore';

const AI_NEWS_THEME_ID = 'kSmyXNiKZDznRMGx4G9c';
const NEW_SCHEDULE = 'weekly:monday'; // Every Monday

async function main(): Promise<void> {
  console.log('[FixSchedule] Updating AI News theme schedule...');

  const firestore = new Firestore();
  const themeRef = firestore.collection('themes').doc(AI_NEWS_THEME_ID);

  // Check if theme exists
  const themeDoc = await themeRef.get();
  if (!themeDoc.exists) {
    throw new Error(`Theme ${AI_NEWS_THEME_ID} not found`);
  }

  const currentData = themeDoc.data();
  console.log(`\nCurrent configuration:`);
  console.log(`  Title: ${currentData?.title}`);
  console.log(`  Schedule: ${currentData?.schedule || '(no schedule - delivers daily)'}`);

  // Update schedule
  await themeRef.update({
    schedule: NEW_SCHEDULE
  });

  console.log(`\n✓ Updated schedule to: ${NEW_SCHEDULE}`);
  console.log(`\nAI News will now be delivered every Monday.`);

  // Verify update
  const updatedDoc = await themeRef.get();
  const updatedData = updatedDoc.data();
  console.log(`\nVerified configuration:`);
  console.log(`  Title: ${updatedData?.title}`);
  console.log(`  Schedule: ${updatedData?.schedule}`);
}

main().catch((error) => {
  console.error('[FixSchedule] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
