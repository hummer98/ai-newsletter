import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ThemeData {
  id: string;
  title: string;
  prompt: string;
}

async function main(): Promise<void> {
  console.log('[GenerateNewsletters] Starting newsletter generation for all themes...');

  const outputDir = path.join(process.cwd(), 'output');
  const themesPath = path.join(outputDir, 'themes.json');

  if (!fs.existsSync(themesPath)) {
    throw new Error(`Themes file not found: ${themesPath}`);
  }

  const themes: ThemeData[] = JSON.parse(fs.readFileSync(themesPath, 'utf-8'));
  console.log(`[GenerateNewsletters] Found ${themes.length} theme(s)`);

  if (themes.length === 0) {
    console.log('[GenerateNewsletters] No themes to process. Exiting.');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const theme of themes) {
    console.log(`\n[GenerateNewsletters] Processing theme: ${theme.title} (${theme.id})`);

    try {
      // Prepare theme data as JSON string for command argument
      const themeJson = JSON.stringify(theme);

      // Execute Claude Code command for this theme
      // Using heredoc to properly escape the JSON
      const command = `claude -p "/generate-newsletter ${themeJson.replace(/"/g, '\\"')}"`;

      console.log(`[GenerateNewsletters] Executing: ${command}`);
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      console.log(`[GenerateNewsletters] Claude Code output:\n${output}`);

      // Verify that the newsletter file was created
      const newsletterPath = path.join(outputDir, `newsletter-${theme.id}.json`);
      if (!fs.existsSync(newsletterPath)) {
        throw new Error(`Newsletter file not created: ${newsletterPath}`);
      }

      console.log(`[GenerateNewsletters] ✓ Successfully generated newsletter for theme: ${theme.title}`);
      successCount++;
    } catch (error) {
      console.error(`[GenerateNewsletters] ✗ Failed to generate newsletter for theme: ${theme.title}`);
      console.error(`[GenerateNewsletters] Error:`, error instanceof Error ? error.message : error);
      failCount++;
    }
  }

  console.log(`\n[GenerateNewsletters] Generation complete. Success: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[GenerateNewsletters] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
