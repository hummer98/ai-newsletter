import { Firestore } from '@google-cloud/firestore';
import { execSync } from 'child_process';

const THEME_TITLE = '小型船舶・マリンテクノロジー週報';
const THEME_SCHEDULE = 'weekly:monday'; // Every Monday
const THEME_PROMPT = `{{period}}の小型船舶・マリンテクノロジーに関する最新情報を収集してください。

## 1. AIナビゲーションシステム動向
- 国内外のAI航海システムの新製品・新機能リリース
- AIナビゲーション技術のアップデート情報
- 自律運航・遠隔操縦技術の最新動向
- 小型船舶向けナビゲーションアプリケーション
- 業界ニュースリリース、プレスリリース

検索キーワード例:
- AI navigation system small boats, AI marine navigation, autonomous boat navigation
- small vessel AI navigation, recreational boat AI
- 小型船舶 AIナビゲーション, 船舶用AI航法システム

## 2. 艤装品・電子機器動向
- 新製品発表・リリース情報
- GPS、魚群探知機、レーダー等の航海電子機器
- 電動推進システム（モーター、コントローラー等）
- マリンエレクトロニクスの技術トレンド
- 業界展示会・イベント情報

検索キーワード例:
- marine electronics new products, boat equipment releases
- GPS chartplotter, fish finder, marine radar
- electric propulsion system boats
- 小型船舶 艤装品, 船舶用電子機器, マリンエレクトロニクス

## 3. 法規制動向
- 小型船舶の安全基準・検査制度の変更
- 電動船のバッテリー規制、安全基準
- 船舶検査（船検）の要件変更
- 海事関連法令の改正
- 国土交通省、海上保安庁等の政策発表
- 国内外の電動船関連規制の比較

検索キーワード例:
- small boat regulations Japan, electric boat battery regulations
- 小型船舶 法改正, 船舶検査 電動船
- 電動船 バッテリー規制, 小型船舶安全規則
- 国土交通省 小型船舶, 海上保安庁 電動船

各セクションごとにニュースをまとめて、業界関係者向けに技術動向とビジネスインパクトを分析してください。`;

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
  console.log('[Install] Creating Marine technology newsletter theme...');

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

  console.log('\n[Install] Done! Marine technology newsletter theme has been installed.');
  console.log(`\nFirestore structure created:`);
  console.log(`  themes/`);
  console.log(`    └── ${themeId}/`);
  console.log(`          ├── title: "${THEME_TITLE}"`);
  console.log(`          ├── prompt: "${THEME_PROMPT.substring(0, 80)}..."`);
  console.log(`          ├── schedule: "${THEME_SCHEDULE}"`);
  console.log(`          └── mailto/`);
  console.log(`                └── ${subscriberId}/`);
  console.log(`                      └── mailto: "${subscriberEmail}"`);
  console.log(`\nSchedule formats supported:`);
  console.log(`  - weekly:monday    (every Monday)`);
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
