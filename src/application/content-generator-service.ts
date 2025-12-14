import type { ContentGeneratorService, SearchResult } from './newsletter-generator.js';
import type { NewsletterContent } from '../types/index.js';

/**
 * Content generator service implementation
 * Generates newsletter content from search results
 */
export class DefaultContentGeneratorService implements ContentGeneratorService {
  /**
   * Generate newsletter content from search results
   * This creates a simple formatted newsletter from the search results
   */
  async generate(prompt: string, searchResults: SearchResult[]): Promise<NewsletterContent> {
    console.log(`[ContentGenerator] Generating content for: ${prompt}`);

    const subject = this.generateSubject(prompt);
    const htmlBody = this.generateHtmlBody(prompt, searchResults);
    const textBody = this.generateTextBody(prompt, searchResults);

    return {
      subject,
      htmlBody,
      textBody
    };
  }

  private generateSubject(prompt: string): string {
    const date = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    // Extract key topic from prompt (first 30 chars or until period)
    const topic = prompt.split('.')[0].substring(0, 50);
    return `${date} - ${topic}`;
  }

  private generateHtmlBody(prompt: string, searchResults: SearchResult[]): string {
    const articles = searchResults.map(result => `
      <div style="margin-bottom: 20px; padding: 15px; border-left: 3px solid #4A90D9;">
        <h3 style="margin: 0 0 10px 0;">
          <a href="${this.escapeHtml(result.url)}" style="color: #1a73e8; text-decoration: none;">
            ${this.escapeHtml(result.title)}
          </a>
        </h3>
        <p style="margin: 0; color: #5f6368;">${this.escapeHtml(result.snippet)}</p>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <header style="border-bottom: 2px solid #4A90D9; padding-bottom: 15px; margin-bottom: 20px;">
    <h1 style="margin: 0; color: #202124;">Newsletter</h1>
    <p style="margin: 5px 0 0 0; color: #5f6368;">${this.escapeHtml(prompt)}</p>
  </header>

  <main>
    ${articles}
  </main>

  <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; color: #5f6368; font-size: 12px;">
    <p>This newsletter was automatically generated.</p>
  </footer>
</body>
</html>
    `.trim();
  }

  private generateTextBody(prompt: string, searchResults: SearchResult[]): string {
    const header = `Newsletter\n${'='.repeat(50)}\n${prompt}\n\n`;

    const articles = searchResults.map((result, index) =>
      `${index + 1}. ${result.title}\n   ${result.snippet}\n   ${result.url}\n`
    ).join('\n');

    const footer = `\n${'='.repeat(50)}\nThis newsletter was automatically generated.`;

    return header + articles + footer;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
