import { Firestore } from '@google-cloud/firestore';
import { execSync } from 'child_process';

const THEME_ID = 'ai-coding-agents';
const THEME_PROMPT = 'AIコーディングエージェント（GitHub Copilot, Cursor, Claude Code, Cline, Devin など）の最新ニュース、アップデート、Tips を収集してください。';

function getGitUserEmail(): string {
  try {
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    if (!email) {
      throw new Error('git user.email is not configured');
    }
    return email;
  } catch {
    throw new Error('Failed to get git user.email. Please configure with: git config --global user.email "your@email.com"');
  }
}

async function main(): Promise<void> {
  console.log('[Install] Creating AI News example theme...');

  // Get subscriber email from git config
  const subscriberEmail = getGitUserEmail();
  console.log(`[Install] Subscriber email: ${subscriberEmail}`);

  // Initialize Firestore
  const firestore = new Firestore();

  // Create theme document
  const themeRef = firestore.collection('themes').doc(THEME_ID);
  const themeDoc = await themeRef.get();

  if (themeDoc.exists) {
    console.log(`[Install] Theme "${THEME_ID}" already exists. Skipping theme creation.`);
  } else {
    await themeRef.set({
      prompt: THEME_PROMPT
    });
    console.log(`[Install] Created theme: ${THEME_ID}`);
  }

  // Create subscriber document
  const subscriberRef = themeRef.collection('mailto').doc('subscriber-1');
  const subscriberDoc = await subscriberRef.get();

  if (subscriberDoc.exists) {
    console.log(`[Install] Subscriber already exists. Updating email...`);
  }

  await subscriberRef.set({
    mailto: subscriberEmail
  });
  console.log(`[Install] Added subscriber: ${subscriberEmail}`);

  console.log('\n[Install] Done! Example theme has been installed.');
  console.log(`\nFirestore structure created:`);
  console.log(`  themes/`);
  console.log(`    └── ${THEME_ID}/`);
  console.log(`          ├── prompt: "${THEME_PROMPT.substring(0, 50)}..."`);
  console.log(`          └── mailto/`);
  console.log(`                └── subscriber-1/`);
  console.log(`                      └── mailto: "${subscriberEmail}"`);
}

main().catch((error) => {
  console.error('[Install] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
