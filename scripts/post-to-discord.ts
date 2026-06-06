import * as fs from 'fs';
import * as path from 'path';
import { DiscordSender } from '../src/application/index.js';
import type { DiscordPostResult } from '../src/types/index.js';

interface ThemeEntry {
  id: string;
  title: string;
  prompt: string;
  discordChannelId?: string;
}

async function main(): Promise<void> {
  console.log('[PostToDiscord] Starting Discord delivery...');

  const outputDir = path.join(process.cwd(), 'output');
  const themesPath = path.join(outputDir, 'themes.json');

  if (!fs.existsSync(themesPath)) {
    console.error('[PostToDiscord] themes.json not found. Run fetch-themes first.');
    console.error('::error::Discord delivery failed: output/themes.json not found');
    process.exit(1);
  }

  let themes: ThemeEntry[];
  try {
    themes = JSON.parse(fs.readFileSync(themesPath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PostToDiscord] Failed to parse themes.json: ${message}`);
    console.error(`::error::Discord delivery failed: invalid output/themes.json (${message})`);
    process.exit(1);
  }

  // Targets = themes that carry a discordChannelId string.
  const targets = themes.filter(
    (t): t is ThemeEntry & { discordChannelId: string } =>
      typeof t.discordChannelId === 'string' && t.discordChannelId.length > 0
  );

  // Log skipped themes for visibility.
  for (const theme of themes) {
    if (typeof theme.discordChannelId !== 'string' || theme.discordChannelId.length === 0) {
      console.log(`[PostToDiscord] Theme "${theme.title}" (${theme.id}) has no discordChannelId. Skipping.`);
    }
  }

  if (targets.length === 0) {
    console.log('[PostToDiscord] No themes with a Discord channel configured. Exiting (0).');
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || token.trim() === '') {
    console.error(
      `[PostToDiscord] ${targets.length} theme(s) target Discord but DISCORD_BOT_TOKEN is not set.`
    );
    console.error('::error::Discord delivery failed: DISCORD_BOT_TOKEN is not set');
    process.exit(1);
  }

  const sender = new DiscordSender(token);

  let hadFailure = false;
  let totalChunks = 0;
  let totalSuccess = 0;
  let postedThemes = 0;

  for (const theme of targets) {
    console.log(`\n[PostToDiscord] Processing theme: ${theme.title} (${theme.id}) -> channel ${theme.discordChannelId}`);

    const textPath = path.join(outputDir, `newsletter-${theme.id}.txt`);
    if (!fs.existsSync(textPath)) {
      console.warn(`[PostToDiscord] newsletter-${theme.id}.txt not found. Skipping.`);
      continue;
    }

    const text = fs.readFileSync(textPath, 'utf-8');
    if (text.trim() === '') {
      console.warn(`[PostToDiscord] newsletter-${theme.id}.txt is empty/whitespace. Skipping.`);
      continue;
    }

    const result: DiscordPostResult = await sender.post(theme.discordChannelId, text);
    postedThemes++;
    totalChunks += result.totalChunks;
    totalSuccess += result.successCount;

    console.log(
      `[PostToDiscord] Theme ${theme.id}: ${result.successCount}/${result.totalChunks} chunk(s) posted.`
    );

    if (result.failedChunks.length > 0) {
      hadFailure = true;
      for (const err of result.errors) {
        console.error(`[PostToDiscord]   ${err}`);
      }
      console.error(
        `::error::Discord delivery failed for theme "${theme.title}" (${theme.id}): ` +
          `${result.failedChunks.length} chunk(s) failed`
      );
    }
  }

  console.log(
    `\n[PostToDiscord] Done. Posted ${totalSuccess}/${totalChunks} chunk(s) across ${postedThemes} theme(s).`
  );

  if (hadFailure) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[PostToDiscord] Error:', message);
  console.error(`::error::Discord delivery failed: ${message}`);
  process.exit(1);
});
