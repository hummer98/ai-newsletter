/**
 * Schedule configuration for newsletter delivery
 * Formats:
 * - "weekly:monday" - every Monday
 * - "weekly:tuesday" - every Tuesday
 * - "biweekly:monday" - every other Monday (based on lastDeliveredAt)
 * - "monthly:1,11,21" - on 1st, 11th, 21st of each month
 */
export type ScheduleConfig = string;

/**
 * Theme configuration stored in Firestore
 */
export interface Theme {
  id: string;
  title: string;
  prompt: string;
  schedule?: ScheduleConfig;
  lastDeliveredAt?: Date;
  discordChannelId?: string;
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
 * Result of posting a newsletter to a Discord channel
 */
export interface DiscordPostResult {
  channelId: string;
  totalChunks: number;
  successCount: number;
  failedChunks: number[]; // indices of chunks that failed
  errors: string[];       // human/log oriented messages
}

/**
 * Constants for retry and batch operations
 */
export const MAX_RETRY_COUNT = 3;
export const BATCH_SIZE = 100;
export const RATE_LIMIT_DELAY_MS = 500; // 2 requests per second

/**
 * Constants for Discord channel delivery
 */
export const DISCORD_MESSAGE_LIMIT = 2000;  // Discord per-message hard limit (reference)
export const DISCORD_SAFE_LIMIT = 1900;     // default split limit (margin 100)
export const DISCORD_CHUNK_DELAY_MS = 750;  // delay between chunks
export const DISCORD_MAX_RETRIES = 5;       // 429 retries per chunk
export const DISCORD_MAX_RETRY_DELAY_MS = 60000; // clamp for retry_after (anti-hang)
