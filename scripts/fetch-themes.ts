import { Firestore, Timestamp } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { shouldDeliverOn } from '../src/utils/schedule-matcher.js';
import { replacePromptVariables } from '../src/utils/prompt-replacer.js';

interface ThemeData {
  id: string;
  title: string;
  prompt: string;
  schedule?: string;
  lastDeliveredAt?: Date;
}

interface ThemeOutput {
  id: string;
  title: string;
  prompt: string;
}

async function main(): Promise<void> {
  console.log('[FetchThemes] Fetching themes from Firestore...');

  const skipScheduleCheck = process.env.SKIP_SCHEDULE_CHECK === 'true';
  if (skipScheduleCheck) {
    console.log('[FetchThemes] Schedule check is DISABLED (manual override)');
  }

  const firestore = new Firestore();
  const snapshot = await firestore.collection('themes').get();
  const allThemes: ThemeData[] = [];
  const today = new Date();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const title = data.title;
    const prompt = data.prompt;
    const schedule = data.schedule;
    let lastDeliveredAt: Date | undefined;

    // Convert Firestore Timestamp to Date
    if (data.lastDeliveredAt instanceof Timestamp) {
      lastDeliveredAt = data.lastDeliveredAt.toDate();
    } else if (data.lastDeliveredAt instanceof Date) {
      lastDeliveredAt = data.lastDeliveredAt;
    }

    if (typeof title === 'string' && title.length > 0 &&
        typeof prompt === 'string' && prompt.length > 0) {
      allThemes.push({
        id: doc.id,
        title: title,
        prompt: prompt,
        schedule: typeof schedule === 'string' ? schedule : undefined,
        lastDeliveredAt: lastDeliveredAt
      });
    }
  }

  console.log(`[FetchThemes] Found ${allThemes.length} total theme(s)`);

  // Filter themes by schedule (unless skip_schedule_check is enabled)
  const scheduledThemes = allThemes.filter(theme => {
    if (skipScheduleCheck) {
      return true; // Include all themes when schedule check is disabled
    }
    const shouldDeliver = shouldDeliverOn(theme.schedule, today, theme.lastDeliveredAt);
    if (!shouldDeliver) {
      console.log(`[FetchThemes] Skipping theme "${theme.title}" (schedule: ${theme.schedule || 'none'})`);
    }
    return shouldDeliver;
  });

  console.log(`[FetchThemes] ${scheduledThemes.length} theme(s) scheduled for delivery today`);

  // Process prompts with variable replacement
  const outputThemes: ThemeOutput[] = scheduledThemes.map(theme => {
    const processedPrompt = replacePromptVariables(theme.prompt, theme.lastDeliveredAt, today);
    return {
      id: theme.id,
      title: theme.title,
      prompt: processedPrompt
    };
  });

  // Ensure output directory exists
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write themes to JSON file
  const outputPath = path.join(outputDir, 'themes.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputThemes, null, 2));
  console.log(`[FetchThemes] Themes saved to ${outputPath}`);

  // Exit with code 2 if no themes to process (used by workflow to skip subsequent steps)
  if (outputThemes.length === 0) {
    console.log('[FetchThemes] No themes scheduled for today, exiting with code 2');
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('[FetchThemes] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
