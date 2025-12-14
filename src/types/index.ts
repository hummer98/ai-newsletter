/**
 * Theme configuration stored in Firestore
 */
export interface Theme {
  id: string;
  prompt: string;
}

/**
 * Subscriber information stored in Firestore subcollection
 */
export interface Subscriber {
  mailto: string;
}

/**
 * Generated newsletter content
 */
export interface NewsletterContent {
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Result of newsletter generation for a theme
 */
export interface GenerationResult {
  themeId: string;
  success: boolean;
  content?: NewsletterContent;
  error?: string;
}

/**
 * Result of email sending operation
 */
export interface SendResult {
  themeId: string;
  totalRecipients: number;
  successCount: number;
  failedRecipients: string[];
  errors: string[];
}

/**
 * Configuration for the newsletter system
 */
export interface Config {
  gcpProjectId: string;
  resendApiKey: string;
  fromEmail: string;
}

/**
 * Constants for retry and batch operations
 */
export const MAX_RETRY_COUNT = 3;
export const BATCH_SIZE = 100;
export const RATE_LIMIT_DELAY_MS = 500; // 2 requests per second
