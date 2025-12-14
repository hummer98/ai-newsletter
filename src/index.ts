import { Firestore } from '@google-cloud/firestore';
import { Resend } from 'resend';
import { FirestoreConnector } from './infrastructure/firestore-connector.js';
import { NewsletterGenerator, EmailSender, DefaultContentGeneratorService, MockWebSearchService } from './application/index.js';
import type { Config, GenerationResult, SendResult } from './types/index.js';

/**
 * Validate required environment variables
 */
function validateConfig(): Config {
  const gcpProjectId = process.env.CLOUDSDK_CORE_PROJECT;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  const missing: string[] = [];

  if (!gcpProjectId) missing.push('CLOUDSDK_CORE_PROJECT');
  if (!resendApiKey) missing.push('RESEND_API_KEY');
  if (!fromEmail) missing.push('FROM_EMAIL');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    gcpProjectId: gcpProjectId!,
    resendApiKey: resendApiKey!,
    fromEmail: fromEmail!
  };
}

/**
 * Main execution summary
 */
interface ExecutionResult {
  generationResults: GenerationResult[];
  sendResults: SendResult[];
  totalThemes: number;
  successfulGenerations: number;
  successfulSends: number;
  failedThemes: string[];
  errors: string[];
}

/**
 * Print execution summary
 */
function printSummary(result: ExecutionResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXECUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total themes processed: ${result.totalThemes}`);
  console.log(`Successful generations: ${result.successfulGenerations}`);
  console.log(`Successful email sends: ${result.successfulSends}`);

  if (result.failedThemes.length > 0) {
    console.log(`\nFailed themes: ${result.failedThemes.join(', ')}`);
  }

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  const totalEmails = result.sendResults.reduce((sum, r) => sum + r.successCount, 0);
  console.log(`\nTotal emails sent: ${totalEmails}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('[Newsletter] Starting newsletter generation and delivery...');
  console.log(`[Newsletter] Timestamp: ${new Date().toISOString()}`);

  // Validate configuration
  let config: Config;
  try {
    config = validateConfig();
    console.log(`[Newsletter] Project ID: ${config.gcpProjectId}`);
  } catch (error) {
    console.error('[Newsletter] Configuration error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Initialize services
  const firestore = new Firestore({
    projectId: config.gcpProjectId
  });
  const firestoreConnector = new FirestoreConnector(firestore);

  const resend = new Resend(config.resendApiKey);
  const emailSender = new EmailSender(resend, firestoreConnector, config.fromEmail);

  // Note: In production, replace MockWebSearchService with actual implementation
  const webSearchService = new MockWebSearchService();
  const contentGenerator = new DefaultContentGeneratorService();
  const newsletterGenerator = new NewsletterGenerator(
    firestoreConnector,
    webSearchService,
    contentGenerator
  );

  const result: ExecutionResult = {
    generationResults: [],
    sendResults: [],
    totalThemes: 0,
    successfulGenerations: 0,
    successfulSends: 0,
    failedThemes: [],
    errors: []
  };

  try {
    // Generate newsletters for all themes
    console.log('[Newsletter] Generating content for all themes...');
    result.generationResults = await newsletterGenerator.generateAll();
    result.totalThemes = result.generationResults.length;

    // Process each successful generation
    for (const genResult of result.generationResults) {
      if (genResult.success && genResult.content) {
        result.successfulGenerations++;

        // Send email
        console.log(`[Newsletter] Sending emails for theme: ${genResult.themeId}`);
        try {
          const sendResult = await emailSender.send(genResult.themeId, genResult.content);
          result.sendResults.push(sendResult);

          if (sendResult.successCount > 0) {
            result.successfulSends++;
          }

          if (sendResult.errors.length > 0) {
            result.errors.push(...sendResult.errors.map(e => `[${genResult.themeId}] ${e}`));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`[${genResult.themeId}] Send failed: ${errorMessage}`);
          result.failedThemes.push(genResult.themeId);
        }
      } else {
        result.failedThemes.push(genResult.themeId);
        if (genResult.error) {
          result.errors.push(`[${genResult.themeId}] Generation failed: ${genResult.error}`);
        }
      }
    }

    printSummary(result);

    // Exit with error if there were any failures
    if (result.failedThemes.length > 0 || result.errors.length > 0) {
      console.log('[Newsletter] Completed with some failures');
      process.exit(0); // Still exit 0 as per requirement (individual failures don't stop workflow)
    } else {
      console.log('[Newsletter] Completed successfully');
      process.exit(0);
    }
  } catch (error) {
    console.error('[Newsletter] Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main
main().catch(error => {
  console.error('[Newsletter] Unhandled error:', error);
  process.exit(1);
});
