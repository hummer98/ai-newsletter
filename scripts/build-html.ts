import * as fs from 'fs';
import * as path from 'path';

interface Article {
  title: string;
  url: string;
  source: string;
  date: string;
  description: string;
}

interface NewsletterData {
  themeId: string;
  title: string;
  date: string;
  summary: string;
  articles: Article[];
  analysis: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildArticleHtml(article: Article): string {
  return `
              <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 8px 0;">
                  <a href="${escapeHtml(article.url)}" style="color: #2c5282; text-decoration: none; font-size: 16px; font-weight: 600;">
                    ${escapeHtml(article.title)}
                  </a>
                </h3>
                <p style="margin: 0 0 8px 0; color: #718096; font-size: 12px;">
                  ${escapeHtml(article.source)} | ${escapeHtml(article.date)}
                </p>
                <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.7;">
                  ${escapeHtml(article.description)}
                </p>
              </div>`;
}

function buildNewsletterHtml(data: NewsletterData): string {
  const articlesHtml = data.articles.map(buildArticleHtml).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 32px 40px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">
                ${escapeHtml(data.title)}
              </h1>
              <p style="margin: 8px 0 0 0; color: #a0c4ff; font-size: 14px;">
                ${escapeHtml(data.date)}
              </p>
            </td>
          </tr>

          <!-- Executive Summary -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 1px solid #e2e8f0;">
              <h2 style="margin: 0 0 16px 0; color: #1a365d; font-size: 18px; font-weight: 600;">
                エグゼクティブサマリー
              </h2>
              <p style="margin: 0; color: #4a5568; font-size: 15px; line-height: 1.8;">
                ${escapeHtml(data.summary)}
              </p>
            </td>
          </tr>

          <!-- News Articles -->
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 24px 0; color: #1a365d; font-size: 18px; font-weight: 600;">
                注目ニュース
              </h2>
${articlesHtml}
            </td>
          </tr>

          <!-- Analysis Section -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #f7fafc; border-left: 4px solid #2c5282; padding: 24px; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 12px 0; color: #1a365d; font-size: 16px; font-weight: 600;">
                  分析・考察
                </h3>
                <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.8;">
                  ${escapeHtml(data.analysis)}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-align: center; line-height: 1.6;">
                このニュースレターはAIによって自動生成されています。<br>
                配信停止をご希望の場合は管理者にお問い合わせください。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildTextBody(data: NewsletterData): string {
  const header = `${data.title}\n${'='.repeat(50)}\n${data.date}\n\n`;

  const summary = `【エグゼクティブサマリー】\n${data.summary}\n\n`;

  const articles = `【注目ニュース】\n` + data.articles.map((article, index) =>
    `${index + 1}. ${article.title}\n   ${article.source} | ${article.date}\n   ${article.description}\n   ${article.url}\n`
  ).join('\n');

  const analysis = `\n【分析・考察】\n${data.analysis}\n`;

  const footer = `\n${'='.repeat(50)}\nこのニュースレターはAIによって自動生成されています。`;

  return header + summary + articles + analysis + footer;
}

async function main(): Promise<void> {
  console.log('[BuildHtml] Building HTML newsletters...');

  const outputDir = path.join(process.cwd(), 'output');

  // Find all newsletter JSON files
  const files = fs.readdirSync(outputDir);
  const newsletterFiles = files.filter(f => f.startsWith('newsletter-') && f.endsWith('.json'));

  if (newsletterFiles.length === 0) {
    throw new Error('No newsletter JSON files found in output directory');
  }

  console.log(`[BuildHtml] Found ${newsletterFiles.length} newsletter(s) to process`);

  let successCount = 0;
  let failCount = 0;

  for (const file of newsletterFiles) {
    try {
      const jsonPath = path.join(outputDir, file);
      const data: NewsletterData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      console.log(`[BuildHtml] Processing newsletter: ${data.title} (${data.themeId})`);

      // Build HTML
      const html = buildNewsletterHtml(data);
      const htmlPath = path.join(outputDir, `newsletter-${data.themeId}.html`);
      fs.writeFileSync(htmlPath, html);
      console.log(`[BuildHtml] HTML saved to ${htmlPath}`);

      // Build text version
      const text = buildTextBody(data);
      const textPath = path.join(outputDir, `newsletter-${data.themeId}.txt`);
      fs.writeFileSync(textPath, text);
      console.log(`[BuildHtml] Text saved to ${textPath}`);

      successCount++;
    } catch (error) {
      console.error(`[BuildHtml] Failed to process ${file}:`, error instanceof Error ? error.message : error);
      failCount++;
    }
  }

  console.log(`[BuildHtml] Build complete. Success: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[BuildHtml] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
