import { Resend } from 'resend';
import type { FirestoreConnector } from '../infrastructure/firestore-connector.js';
import type { NewsletterContent, SendResult } from '../types/index.js';
import { BATCH_SIZE, RATE_LIMIT_DELAY_MS } from '../types/index.js';

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Email sender using Resend API
 * Handles batch sending and rate limiting
 */
export class EmailSender {
  private resend: Resend;
  private firestoreConnector: FirestoreConnector;
  private fromEmail: string;

  constructor(
    resend: Resend,
    firestoreConnector: FirestoreConnector,
    fromEmail: string
  ) {
    if (!fromEmail || fromEmail.trim() === '') {
      throw new Error('FROM_EMAIL is required');
    }

    this.resend = resend;
    this.firestoreConnector = firestoreConnector;
    this.fromEmail = fromEmail;
  }

  /**
   * Send newsletter to all subscribers of a theme
   */
  async send(themeId: string, content: NewsletterContent): Promise<SendResult> {
    const result: SendResult = {
      themeId,
      totalRecipients: 0,
      successCount: 0,
      failedRecipients: [],
      errors: []
    };

    // Get subscribers
    const subscribers = await this.firestoreConnector.getSubscribers(themeId);

    if (subscribers.length === 0) {
      result.errors.push(`No subscribers found for theme ${themeId}`);
      console.warn(`[EmailSender] No subscribers found for theme ${themeId}`);
      return result;
    }

    result.totalRecipients = subscribers.length;

    // Split into batches of BATCH_SIZE (100)
    const batches = this.splitIntoBatches(subscribers.map(s => s.mailto), BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchResult = await this.sendBatchWithRetry(batch, content, themeId);

      result.successCount += batchResult.successCount;
      result.failedRecipients.push(...batchResult.failedRecipients);
      result.errors.push(...batchResult.errors);

      // Rate limiting between batches
      if (batchIndex < batches.length - 1) {
        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    return result;
  }

  /**
   * Split array into batches of specified size
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Send a batch of emails with retry on rate limit
   */
  private async sendBatchWithRetry(
    emails: string[],
    content: NewsletterContent,
    themeId: string,
    retryCount = 0
  ): Promise<{ successCount: number; failedRecipients: string[]; errors: string[] }> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    const emailPayloads = emails.map(email => ({
      from: this.fromEmail,
      to: email,
      subject: content.subject,
      html: content.htmlBody,
      text: content.textBody
    }));

    try {
      const response = await this.resend.batch.send(emailPayloads);

      if (response.error) {
        // Check if rate limited and should retry
        const errorWithStatus = response.error as { statusCode?: number; message: string };
        if (errorWithStatus.statusCode === 429 && retryCount < MAX_RETRIES) {
          console.log(`[EmailSender] Rate limited, retrying in ${RETRY_DELAY_MS}ms...`);
          await delay(RETRY_DELAY_MS * (retryCount + 1)); // Exponential backoff
          return this.sendBatchWithRetry(emails, content, themeId, retryCount + 1);
        }

        return {
          successCount: 0,
          failedRecipients: emails,
          errors: [`Batch send failed: ${response.error.message}`]
        };
      }

      // Process results
      const data = response.data;
      let successCount = 0;
      const failedRecipients: string[] = [];

      if (Array.isArray(data)) {
        for (let i = 0; i < emails.length; i++) {
          const resultItem = data[i] as { id?: string } | undefined;
          if (resultItem && resultItem.id) {
            successCount++;
          } else {
            failedRecipients.push(emails[i]);
          }
        }
      }

      return {
        successCount,
        failedRecipients,
        errors: []
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        successCount: 0,
        failedRecipients: emails,
        errors: [`Batch send exception: ${message}`]
      };
    }
  }
}
