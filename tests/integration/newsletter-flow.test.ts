import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreConnector } from '../../src/infrastructure/firestore-connector.js';
import { NewsletterGenerator, EmailSender } from '../../src/application/index.js';
import type { Theme, Subscriber, NewsletterContent, GenerationResult, SendResult } from '../../src/types/index.js';

/**
 * Integration tests for the complete newsletter flow
 * These tests verify the interaction between components
 */
describe('Newsletter Flow Integration', () => {
  let mockFirestore: {
    collection: ReturnType<typeof vi.fn>;
  };
  let mockResend: {
    batch: {
      send: ReturnType<typeof vi.fn>;
    };
  };
  let mockWebSearch: {
    search: ReturnType<typeof vi.fn>;
  };
  let mockContentGenerator: {
    generate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Firestore
    mockFirestore = {
      collection: vi.fn()
    };

    // Setup mock Resend
    mockResend = {
      batch: {
        send: vi.fn()
      }
    };

    // Setup mock web search
    mockWebSearch = {
      search: vi.fn()
    };

    // Setup mock content generator
    mockContentGenerator = {
      generate: vi.fn()
    };
  });

  describe('End-to-end newsletter delivery', () => {
    it('should complete full flow: fetch themes, generate content, send emails', async () => {
      // Setup: Mock theme data
      const themes: Theme[] = [
        { id: 'tech-news', prompt: 'Latest technology news and innovations' }
      ];

      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' },
        { mailto: 'user2@example.com' }
      ];

      const generatedContent: NewsletterContent = {
        subject: 'Weekly Tech News - December 2024',
        htmlBody: '<h1>Tech News</h1><p>Latest updates...</p>',
        textBody: 'Tech News\n\nLatest updates...'
      };

      // Configure Firestore mocks
      const mockThemesCollection = {
        get: vi.fn().mockResolvedValue({
          docs: themes.map(t => ({
            id: t.id,
            data: () => ({ prompt: t.prompt })
          }))
        }),
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: subscribers.map((s, i) => ({
                id: `sub-${i}`,
                data: () => s
              }))
            })
          })
        })
      };

      mockFirestore.collection.mockReturnValue(mockThemesCollection);

      // Configure web search mock
      mockWebSearch.search.mockResolvedValue({
        results: [
          { title: 'AI Breakthrough', snippet: 'New AI model released', url: 'https://example.com/ai' },
          { title: 'Tech IPO', snippet: 'Company goes public', url: 'https://example.com/ipo' }
        ]
      });

      // Configure content generator mock
      mockContentGenerator.generate.mockResolvedValue(generatedContent);

      // Configure Resend mock
      mockResend.batch.send.mockResolvedValue({
        data: [{ id: 'msg-1' }, { id: 'msg-2' }],
        error: null
      });

      // Create instances
      const firestoreConnector = new FirestoreConnector(mockFirestore as never);
      const newsletterGenerator = new NewsletterGenerator(
        firestoreConnector,
        mockWebSearch as never,
        mockContentGenerator as never
      );
      const emailSender = new EmailSender(
        mockResend as never,
        firestoreConnector,
        'newsletter@example.com'
      );

      // Execute: Generate newsletters
      const generationResults = await newsletterGenerator.generateAll();

      // Verify generation
      expect(generationResults).toHaveLength(1);
      expect(generationResults[0].success).toBe(true);
      expect(generationResults[0].content).toEqual(generatedContent);

      // Execute: Send emails for successful generations
      const sendResults: SendResult[] = [];
      for (const result of generationResults) {
        if (result.success && result.content) {
          const sendResult = await emailSender.send(result.themeId, result.content);
          sendResults.push(sendResult);
        }
      }

      // Verify sending
      expect(sendResults).toHaveLength(1);
      expect(sendResults[0].totalRecipients).toBe(2);
      expect(sendResults[0].successCount).toBe(2);
      expect(sendResults[0].failedRecipients).toHaveLength(0);

      // Verify correct calls were made
      expect(mockWebSearch.search).toHaveBeenCalledWith('Latest technology news and innovations');
      expect(mockResend.batch.send).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            from: 'newsletter@example.com',
            to: 'user1@example.com',
            subject: generatedContent.subject
          }),
          expect.objectContaining({
            from: 'newsletter@example.com',
            to: 'user2@example.com',
            subject: generatedContent.subject
          })
        ])
      );
    });

    it('should handle multiple themes with mixed success/failure', async () => {
      // Setup: Multiple themes
      const themes: Theme[] = [
        { id: 'theme-success', prompt: 'Success theme prompt' },
        { id: 'theme-fail', prompt: 'Fail theme prompt' }
      ];

      // Configure Firestore for theme list
      const mockThemeDoc = vi.fn();
      mockThemeDoc.mockImplementation((themeId: string) => ({
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: [{ id: 'sub-1', data: () => ({ mailto: 'user@example.com' }) }]
          })
        })
      }));

      mockFirestore.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: themes.map(t => ({
            id: t.id,
            data: () => ({ prompt: t.prompt })
          }))
        }),
        doc: mockThemeDoc
      });

      // Web search: first succeeds, second fails 3 times
      mockWebSearch.search
        .mockResolvedValueOnce({
          results: [{ title: 'Success', snippet: 'Content', url: 'https://example.com' }]
        })
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockRejectedValueOnce(new Error('Search failed'))
        .mockRejectedValueOnce(new Error('Search failed'));

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Newsletter',
        htmlBody: '<p>Content</p>',
        textBody: 'Content'
      });

      mockResend.batch.send.mockResolvedValue({
        data: [{ id: 'msg-1' }],
        error: null
      });

      // Create instances
      const firestoreConnector = new FirestoreConnector(mockFirestore as never);
      const newsletterGenerator = new NewsletterGenerator(
        firestoreConnector,
        mockWebSearch as never,
        mockContentGenerator as never
      );
      const emailSender = new EmailSender(
        mockResend as never,
        firestoreConnector,
        'newsletter@example.com'
      );

      // Execute
      const generationResults = await newsletterGenerator.generateAll();

      // Verify: One success, one failure
      expect(generationResults).toHaveLength(2);

      const successResult = generationResults.find(r => r.themeId === 'theme-success');
      const failResult = generationResults.find(r => r.themeId === 'theme-fail');

      expect(successResult?.success).toBe(true);
      expect(failResult?.success).toBe(false);
      expect(failResult?.error).toContain('Web search failed after 3 retries');

      // Only send for successful theme
      let sendCount = 0;
      for (const result of generationResults) {
        if (result.success && result.content) {
          await emailSender.send(result.themeId, result.content);
          sendCount++;
        }
      }

      expect(sendCount).toBe(1);
      expect(mockResend.batch.send).toHaveBeenCalledTimes(1);
    });

    it('should isolate failures and continue processing other themes', async () => {
      const themes: Theme[] = [
        { id: 'first', prompt: 'First theme' },
        { id: 'second', prompt: 'Second theme' },
        { id: 'third', prompt: 'Third theme' }
      ];

      mockFirestore.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: themes.map(t => ({
            id: t.id,
            data: () => ({ prompt: t.prompt })
          }))
        }),
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [{ id: 'sub-1', data: () => ({ mailto: 'user@example.com' }) }]
            })
          })
        })
      });

      // First succeeds, second fails, third succeeds
      mockWebSearch.search
        .mockResolvedValueOnce({ results: [{ title: 'First', snippet: 'Content', url: 'https://1.com' }] })
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({ results: [{ title: 'Third', snippet: 'Content', url: 'https://3.com' }] });

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Newsletter',
        htmlBody: '<p>Content</p>',
        textBody: 'Content'
      });

      const firestoreConnector = new FirestoreConnector(mockFirestore as never);
      const newsletterGenerator = new NewsletterGenerator(
        firestoreConnector,
        mockWebSearch as never,
        mockContentGenerator as never
      );

      const results = await newsletterGenerator.generateAll();
      const summary = newsletterGenerator.getSummary(results);

      expect(summary.totalThemes).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.failedThemeIds).toEqual(['second']);
    });
  });

  describe('Error handling scenarios', () => {
    it('should fail gracefully when Firestore is unavailable', async () => {
      mockFirestore.collection.mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Firestore connection refused'))
      });

      const firestoreConnector = new FirestoreConnector(mockFirestore as never);
      const newsletterGenerator = new NewsletterGenerator(
        firestoreConnector,
        mockWebSearch as never,
        mockContentGenerator as never
      );

      await expect(newsletterGenerator.generateAll()).rejects.toThrow('Failed to fetch themes');
    });

    it('should report partial email delivery failures', async () => {
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                { id: 's1', data: () => ({ mailto: 'success@example.com' }) },
                { id: 's2', data: () => ({ mailto: 'fail@example.com' }) }
              ]
            })
          })
        })
      });

      // One success, one failure in response
      mockResend.batch.send.mockResolvedValue({
        data: [{ id: 'msg-1' }, { id: null }],
        error: null
      });

      const firestoreConnector = new FirestoreConnector(mockFirestore as never);
      const emailSender = new EmailSender(
        mockResend as never,
        firestoreConnector,
        'newsletter@example.com'
      );

      const content: NewsletterContent = {
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        textBody: 'Test'
      };

      const result = await emailSender.send('theme-1', content);

      expect(result.totalRecipients).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failedRecipients).toHaveLength(1);
      expect(result.failedRecipients).toContain('fail@example.com');
    });
  });
});
