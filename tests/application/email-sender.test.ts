import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailSender } from '../../src/application/email-sender.js';
import type { NewsletterContent, Subscriber } from '../../src/types/index.js';

// Mock Resend
vi.mock('resend', () => {
  return {
    Resend: vi.fn()
  };
});

describe('EmailSender', () => {
  let emailSender: EmailSender;
  let mockResend: {
    batch: {
      send: ReturnType<typeof vi.fn>;
    };
  };
  let mockFirestoreConnector: {
    getSubscribers: ReturnType<typeof vi.fn>;
  };

  const testContent: NewsletterContent = {
    subject: 'Test Newsletter',
    htmlBody: '<h1>Hello</h1><p>This is a test newsletter.</p>',
    textBody: 'Hello\n\nThis is a test newsletter.'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockResend = {
      batch: {
        send: vi.fn()
      }
    };

    mockFirestoreConnector = {
      getSubscribers: vi.fn()
    };
  });

  describe('send', () => {
    it('should send newsletter to all subscribers successfully', async () => {
      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' },
        { mailto: 'user2@example.com' }
      ];

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);
      mockResend.batch.send.mockResolvedValue({
        data: [
          { id: 'msg-1' },
          { id: 'msg-2' }
        ],
        error: null
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.themeId).toBe('theme-1');
      expect(result.totalRecipients).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failedRecipients).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warning when subscriber list is empty', async () => {
      mockFirestoreConnector.getSubscribers.mockResolvedValue([]);

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.themeId).toBe('theme-1');
      expect(result.totalRecipients).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedRecipients).toHaveLength(0);
      expect(result.errors).toContain('No subscribers found for theme theme-1');
    });

    it('should handle partial send failures', async () => {
      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' },
        { mailto: 'user2@example.com' },
        { mailto: 'user3@example.com' }
      ];

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);
      mockResend.batch.send.mockResolvedValue({
        data: [
          { id: 'msg-1' },
          { id: null }, // Failed
          { id: 'msg-3' }
        ],
        error: null
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.totalRecipients).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedRecipients).toHaveLength(1);
      expect(result.failedRecipients).toContain('user2@example.com');
    });

    it('should handle Resend API error', async () => {
      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' }
      ];

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);
      mockResend.batch.send.mockResolvedValue({
        data: null,
        error: { message: 'API rate limit exceeded', name: 'rate_limit_error' }
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.successCount).toBe(0);
      expect(result.errors).toContain('Batch send failed: API rate limit exceeded');
    });

    it('should batch subscribers when count exceeds 100', async () => {
      // Create 150 subscribers
      const subscribers: Subscriber[] = Array.from({ length: 150 }, (_, i) => ({
        mailto: `user${i}@example.com`
      }));

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);

      // First batch of 100
      mockResend.batch.send.mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, i) => ({ id: `msg-${i}` })),
        error: null
      });

      // Second batch of 50
      mockResend.batch.send.mockResolvedValueOnce({
        data: Array.from({ length: 50 }, (_, i) => ({ id: `msg-${100 + i}` })),
        error: null
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.totalRecipients).toBe(150);
      expect(result.successCount).toBe(150);
      expect(mockResend.batch.send).toHaveBeenCalledTimes(2);
    });

    it('should format email correctly with from address', async () => {
      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' }
      ];

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);
      mockResend.batch.send.mockResolvedValue({
        data: [{ id: 'msg-1' }],
        error: null
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@mycompany.com'
      );

      await emailSender.send('theme-1', testContent);

      expect(mockResend.batch.send).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            from: 'newsletter@mycompany.com',
            to: 'user1@example.com',
            subject: 'Test Newsletter',
            html: testContent.htmlBody,
            text: testContent.textBody
          })
        ])
      );
    });

    it('should throw error when FROM_EMAIL is not configured', () => {
      expect(() => {
        new EmailSender(
          mockResend as never,
          mockFirestoreConnector as never,
          ''
        );
      }).toThrow('FROM_EMAIL is required');
    });

    it('should handle rate limiting with retry', async () => {
      const subscribers: Subscriber[] = [
        { mailto: 'user1@example.com' }
      ];

      mockFirestoreConnector.getSubscribers.mockResolvedValue(subscribers);

      // First call fails with rate limit
      mockResend.batch.send.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded', name: 'rate_limit_error', statusCode: 429 }
      });

      // Second call succeeds
      mockResend.batch.send.mockResolvedValueOnce({
        data: [{ id: 'msg-1' }],
        error: null
      });

      emailSender = new EmailSender(
        mockResend as never,
        mockFirestoreConnector as never,
        'newsletter@example.com'
      );

      const result = await emailSender.send('theme-1', testContent);

      expect(result.successCount).toBe(1);
      expect(mockResend.batch.send).toHaveBeenCalledTimes(2);
    });
  });
});
