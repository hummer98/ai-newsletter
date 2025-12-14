import type { FirestoreConnector } from '../infrastructure/firestore-connector.js';
import type { Theme, NewsletterContent, GenerationResult } from '../types/index.js';
import { MAX_RETRY_COUNT } from '../types/index.js';

/**
 * Search result from web search service
 */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Web search response
 */
export interface SearchResponse {
  results: SearchResult[];
}

/**
 * Web search service interface
 */
export interface WebSearchService {
  search(query: string): Promise<SearchResponse>;
}

/**
 * Content generator service interface
 */
export interface ContentGeneratorService {
  generate(prompt: string, searchResults: SearchResult[]): Promise<NewsletterContent>;
}

/**
 * Execution summary for newsletter generation
 */
export interface ExecutionSummary {
  totalThemes: number;
  successCount: number;
  failureCount: number;
  failedThemeIds: string[];
}

/**
 * Delay helper for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Newsletter generator that orchestrates web search and content generation
 */
export class NewsletterGenerator {
  private firestoreConnector: FirestoreConnector;
  private webSearchService: WebSearchService;
  private contentGenerator: ContentGeneratorService;

  constructor(
    firestoreConnector: FirestoreConnector,
    webSearchService: WebSearchService,
    contentGenerator: ContentGeneratorService
  ) {
    this.firestoreConnector = firestoreConnector;
    this.webSearchService = webSearchService;
    this.contentGenerator = contentGenerator;
  }

  /**
   * Generate newsletter content for a single theme
   */
  async generateForTheme(theme: Theme): Promise<GenerationResult> {
    // Validate prompt
    if (!theme.prompt || theme.prompt.trim() === '') {
      return {
        themeId: theme.id,
        success: false,
        error: `Theme ${theme.id} has empty prompt`
      };
    }

    // Execute web search with retries
    let searchResponse: SearchResponse | null = null;
    let lastError: string = '';

    for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
      try {
        searchResponse = await this.webSearchService.search(theme.prompt);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.log(`[NewsletterGenerator] Web search attempt ${attempt} failed: ${lastError}`);

        if (attempt < MAX_RETRY_COUNT) {
          await delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    if (!searchResponse) {
      return {
        themeId: theme.id,
        success: false,
        error: `Web search failed after ${MAX_RETRY_COUNT} retries: ${lastError}`
      };
    }

    // Check if we got any results
    if (searchResponse.results.length === 0) {
      return {
        themeId: theme.id,
        success: false,
        error: `No search results found for theme ${theme.id}`
      };
    }

    // Generate content
    try {
      const content = await this.contentGenerator.generate(theme.prompt, searchResponse.results);

      return {
        themeId: theme.id,
        success: true,
        content
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        themeId: theme.id,
        success: false,
        error: `Content generation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Generate newsletters for all themes
   * Processes sequentially to isolate failures
   */
  async generateAll(): Promise<GenerationResult[]> {
    let themes: Theme[];

    try {
      themes = await this.firestoreConnector.getThemes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch themes: ${errorMessage}`);
    }

    if (themes.length === 0) {
      console.log('[NewsletterGenerator] No themes found');
      return [];
    }

    console.log(`[NewsletterGenerator] Processing ${themes.length} themes`);

    const results: GenerationResult[] = [];

    for (const theme of themes) {
      console.log(`[NewsletterGenerator] Processing theme: ${theme.id}`);
      const result = await this.generateForTheme(theme);
      results.push(result);

      if (result.success) {
        console.log(`[NewsletterGenerator] Theme ${theme.id} completed successfully`);
      } else {
        console.warn(`[NewsletterGenerator] Theme ${theme.id} failed: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Get execution summary from results
   */
  getSummary(results: GenerationResult[]): ExecutionSummary {
    const successCount = results.filter(r => r.success).length;
    const failedThemeIds = results.filter(r => !r.success).map(r => r.themeId);

    return {
      totalThemes: results.length,
      successCount,
      failureCount: results.length - successCount,
      failedThemeIds
    };
  }
}
