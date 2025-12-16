import { Firestore } from '@google-cloud/firestore';
import { execSync } from 'child_process';

const THEME_TITLE = 'AIコーディングエージェント最新動向';
const THEME_SCHEDULE = 'weekly:monday'; // Every Monday
const THEME_PROMPT = `{{period}}のAIコーディングエージェント（GitHub Copilot、Cursor、Claude Code、Cline、Devin等）に関する最新ニュースを収集してください。

対象トピック:
- 新機能リリース、アップデート情報
- 各ツールの比較・レビュー
- AI支援開発のベストプラクティス
- 企業での導入事例
- セキュリティや倫理に関する議論

ビジネス意思決定者向けに、技術動向とビジネスインパクトを分析してください。`;

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

  // Create theme document with auto-generated ID
  const themeRef = firestore.collection('themes').doc();
  const themeId = themeRef.id;

  await themeRef.set({
    title: THEME_TITLE,
    prompt: THEME_PROMPT,
    schedule: THEME_SCHEDULE
    // Note: lastDeliveredAt is intentionally omitted for new themes
  });
  console.log(`[Install] Created theme: ${themeId}`);

  // Create subscriber document with auto-generated ID
  const subscriberRef = themeRef.collection('mailto').doc();
  const subscriberId = subscriberRef.id;

  await subscriberRef.set({
    mailto: subscriberEmail
  });
  console.log(`[Install] Added subscriber: ${subscriberEmail} (${subscriberId})`);

  console.log('\n[Install] Done! Example theme has been installed.');
  console.log(`\nFirestore structure created:`);
  console.log(`  themes/`);
  console.log(`    └── ${themeId}/`);
  console.log(`          ├── title: "${THEME_TITLE}"`);
  console.log(`          ├── prompt: "${THEME_PROMPT.substring(0, 50)}..."`);
  console.log(`          ├── schedule: "${THEME_SCHEDULE}"`);
  console.log(`          └── mailto/`);
  console.log(`                └── ${subscriberId}/`);
  console.log(`                      └── mailto: "${subscriberEmail}"`);
  console.log(`\nSchedule formats supported:`);
  console.log(`  - weekly:monday    (every Monday) ← current setting`);
  console.log(`  - weekly:sunday    (every Sunday)`);
  console.log(`  - biweekly:monday  (every other Monday)`);
  console.log(`  - monthly:1,15     (1st and 15th of each month)`);
  console.log(`\nPrompt variables supported:`);
  console.log(`  - {{period}} - "YYYY年MM月DD日からYYYY年MM月DD日まで"`);
  console.log(`  - {{today}}  - "YYYY年MM月DD日"`);
  console.log(`  - {{days}}   - Number of days since last delivery`);
}

main().catch((error) => {
  console.error('[Install] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
