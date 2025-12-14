import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsletterGenerator } from '../../src/application/newsletter-generator.js';
import type { Theme, GenerationResult } from '../../src/types/index.js';

describe('NewsletterGenerator', () => {
  let generator: NewsletterGenerator;
  let mockFirestoreConnector: {
    getThemes: ReturnType<typeof vi.fn>;
    getThemeById: ReturnType<typeof vi.fn>;
  };
  let mockWebSearchService: {
    search: ReturnType<typeof vi.fn>;
  };
  let mockContentGenerator: {
    generate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFirestoreConnector = {
      getThemes: vi.fn(),
      getThemeById: vi.fn()
    };

    mockWebSearchService = {
      search: vi.fn()
    };

    mockContentGenerator = {
      generate: vi.fn()
    };
  });

  describe('generateForTheme', () => {
    it('should generate newsletter content for a valid theme', async () => {
      const theme: Theme = { id: 'theme-1', prompt: 'Latest tech news' };

      mockWebSearchService.search.mockResolvedValue({
        results: [
          { title: 'News 1', snippet: 'Description 1', url: 'https://example.com/1' },
          { title: 'News 2', snippet: 'Description 2', url: 'https://example.com/2' }
        ]
      });

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Weekly Tech News',
        htmlBody: '<h1>Tech News</h1><p>Content here</p>',
        textBody: 'Tech News\n\nContent here'
      });

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.themeId).toBe('theme-1');
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content?.subject).toBe('Weekly Tech News');
      expect(result.error).toBeUndefined();
    });

    it('should fail when prompt is empty', async () => {
      const theme: Theme = { id: 'theme-1', prompt: '' };

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty prompt');
      expect(result.content).toBeUndefined();
    });

    it('should retry web search up to 3 times on failure', async () => {
      const theme: Theme = { id: 'theme-1', prompt: 'Tech news' };

      // Fail 3 times
      mockWebSearchService.search
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Server error'));

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Web search failed after 3 retries');
      expect(mockWebSearchService.search).toHaveBeenCalledTimes(3);
    });

    it('should succeed on retry if web search recovers', async () => {
      const theme: Theme = { id: 'theme-1', prompt: 'Tech news' };

      mockWebSearchService.search
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          results: [{ title: 'News', snippet: 'Desc', url: 'https://example.com' }]
        });

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Newsletter',
        htmlBody: '<p>Content</p>',
        textBody: 'Content'
      });

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.success).toBe(true);
      expect(mockWebSearchService.search).toHaveBeenCalledTimes(2);
    });

    it('should fail when content generation fails', async () => {
      const theme: Theme = { id: 'theme-1', prompt: 'Tech news' };

      mockWebSearchService.search.mockResolvedValue({
        results: [{ title: 'News', snippet: 'Desc', url: 'https://example.com' }]
      });

      mockContentGenerator.generate.mockRejectedValue(new Error('AI service unavailable'));

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content generation failed');
    });

    it('should fail when web search returns no results', async () => {
      const theme: Theme = { id: 'theme-1', prompt: 'Very obscure topic' };

      mockWebSearchService.search.mockResolvedValue({
        results: []
      });

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const result = await generator.generateForTheme(theme);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No search results');
    });
  });

  describe('generateAll', () => {
    it('should process all themes and return results', async () => {
      const themes: Theme[] = [
        { id: 'theme-1', prompt: 'Tech news' },
        { id: 'theme-2', prompt: 'Sports news' }
      ];

      mockFirestoreConnector.getThemes.mockResolvedValue(themes);

      mockWebSearchService.search.mockResolvedValue({
        results: [{ title: 'News', snippet: 'Desc', url: 'https://example.com' }]
      });

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Newsletter',
        htmlBody: '<p>Content</p>',
        textBody: 'Content'
      });

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const results = await generator.generateAll();

      expect(results).toHaveLength(2);
      expect(results[0].themeId).toBe('theme-1');
      expect(results[1].themeId).toBe('theme-2');
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should continue processing when one theme fails', async () => {
      const themes: Theme[] = [
        { id: 'theme-1', prompt: 'Tech news' },
        { id: 'theme-2', prompt: 'Sports news' }
      ];

      mockFirestoreConnector.getThemes.mockResolvedValue(themes);

      // First theme fails, second succeeds
      mockWebSearchService.search
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          results: [{ title: 'News', snippet: 'Desc', url: 'https://example.com' }]
        });

      mockContentGenerator.generate.mockResolvedValue({
        subject: 'Newsletter',
        htmlBody: '<p>Content</p>',
        textBody: 'Content'
      });

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const results = await generator.generateAll();

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });

    it('should return empty array when no themes exist', async () => {
      mockFirestoreConnector.getThemes.mockResolvedValue([]);

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const results = await generator.generateAll();

      expect(results).toHaveLength(0);
    });

    it('should throw error when Firestore connection fails', async () => {
      mockFirestoreConnector.getThemes.mockRejectedValue(new Error('Connection failed'));

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      await expect(generator.generateAll()).rejects.toThrow('Failed to fetch themes');
    });
  });

  describe('getSummary', () => {
    it('should return execution summary', async () => {
      const results: GenerationResult[] = [
        { themeId: 'theme-1', success: true, content: { subject: '', htmlBody: '', textBody: '' } },
        { themeId: 'theme-2', success: false, error: 'Some error' },
        { themeId: 'theme-3', success: true, content: { subject: '', htmlBody: '', textBody: '' } }
      ];

      generator = new NewsletterGenerator(
        mockFirestoreConnector as never,
        mockWebSearchService as never,
        mockContentGenerator as never
      );

      const summary = generator.getSummary(results);

      expect(summary.totalThemes).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.failedThemeIds).toEqual(['theme-2']);
    });
  });
});
