import { Firestore } from '@google-cloud/firestore';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';

interface NewsletterData {
  themeId: string;
  title: string;
  date: string;
  summary: string;
  articles: Array<{
    title: string;
    url: string;
    source: string;
    date: string;
    description: string;
  }>;
  analysis: string;
}

interface Subscriber {
  mailto: string;
}

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSubscribersForTheme(firestore: Firestore, themeId: string): Promise<Subscriber[]> {
  const snapshot = await firestore
    .collection('themes')
    .doc(themeId)
    .collection('mailto')
    .get();

  const subscribers: Subscriber[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const doc of snapshot.docs) {
    const mailto = doc.data().mailto;
    if (typeof mailto === 'string' && emailRegex.test(mailto)) {
      subscribers.push({ mailto });
    }
  }

  return subscribers;
}

async function main(): Promise<void> {
  console.log('[SendNewsletter] Starting newsletter delivery...');

  // Validate environment
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }
  if (!fromEmail) {
    throw new Error('FROM_EMAIL environment variable is required');
  }

  const outputDir = path.join(process.cwd(), 'output');

  // Load themes to get theme IDs
  const themesPath = path.join(outputDir, 'themes.json');
  if (!fs.existsSync(themesPath)) {
    throw new Error('Themes file not found');
  }

  const themes = JSON.parse(fs.readFileSync(themesPath, 'utf-8'));
  if (themes.length === 0) {
    console.log('[SendNewsletter] No themes found. Exiting.');
    return;
  }

  // Initialize clients
  const firestore = new Firestore();
  const resend = new Resend(resendApiKey);

  // Process each theme
  let totalSent = 0;
  let totalFailed = 0;

  for (const theme of themes) {
    console.log(`\n[SendNewsletter] Processing theme: ${theme.title} (${theme.id})`);

    // Load newsletter content for this theme
    const jsonPath = path.join(outputDir, `newsletter-${theme.id}.json`);
    const htmlPath = path.join(outputDir, `newsletter-${theme.id}.html`);
    const textPath = path.join(outputDir, `newsletter-${theme.id}.txt`);

    if (!fs.existsSync(jsonPath) || !fs.existsSync(htmlPath)) {
      console.error(`[SendNewsletter] Newsletter files not found for theme ${theme.id}. Skipping.`);
      continue;
    }

    const data: NewsletterData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const htmlBody = fs.readFileSync(htmlPath, 'utf-8');
    const textBody = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf-8') : '';

    const subscribers = await getSubscribersForTheme(firestore, theme.id);
    console.log(`[SendNewsletter] Found ${subscribers.length} subscriber(s)`);

    if (subscribers.length === 0) {
      console.log(`[SendNewsletter] No subscribers for theme ${theme.id}. Skipping.`);
      continue;
    }

    // Send in batches
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      const emails = batch.map(s => s.mailto);

      console.log(`[SendNewsletter] Sending batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: emails,
          subject: `${data.date} - ${data.title}`,
          html: htmlBody,
          text: textBody
        });

        if (result.error) {
          console.error(`[SendNewsletter] Batch error:`, result.error);
          totalFailed += emails.length;
        } else {
          console.log(`[SendNewsletter] Batch sent successfully. ID: ${result.data?.id}`);
          totalSent += emails.length;
        }
      } catch (error) {
        console.error(`[SendNewsletter] Send error:`, error instanceof Error ? error.message : error);
        totalFailed += emails.length;
      }

      // Rate limiting
      if (i + BATCH_SIZE < subscribers.length) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }
  }

  console.log(`\n[SendNewsletter] Delivery complete. Sent: ${totalSent}, Failed: ${totalFailed}`);
}

main().catch((error) => {
  console.error('[SendNewsletter] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
