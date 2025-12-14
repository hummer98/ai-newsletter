import { Firestore, FieldValue } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';

interface ThemeOutput {
  id: string;
  title: string;
  prompt: string;
}

async function main(): Promise<void> {
  console.log('[UpdateDeliveryTimestamp] Updating lastDeliveredAt for delivered themes...');

  // Read themes that were processed
  const themesPath = path.join(process.cwd(), 'output', 'themes.json');
  if (!fs.existsSync(themesPath)) {
    console.log('[UpdateDeliveryTimestamp] No themes.json found, skipping');
    return;
  }

  const themesContent = fs.readFileSync(themesPath, 'utf-8');
  const themes: ThemeOutput[] = JSON.parse(themesContent);

  if (themes.length === 0) {
    console.log('[UpdateDeliveryTimestamp] No themes to update');
    return;
  }

  const firestore = new Firestore();
  const now = FieldValue.serverTimestamp();

  for (const theme of themes) {
    try {
      await firestore.collection('themes').doc(theme.id).update({
        lastDeliveredAt: now
      });
      console.log(`[UpdateDeliveryTimestamp] Updated lastDeliveredAt for theme: ${theme.id}`);
    } catch (error) {
      console.error(`[UpdateDeliveryTimestamp] Failed to update theme ${theme.id}:`,
        error instanceof Error ? error.message : error);
    }
  }

  console.log('[UpdateDeliveryTimestamp] Done');
}

main().catch((error) => {
  console.error('[UpdateDeliveryTimestamp] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
