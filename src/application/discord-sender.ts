import type { DiscordPostResult } from '../types/index.js';
import {
  DISCORD_SAFE_LIMIT,
  DISCORD_CHUNK_DELAY_MS,
  DISCORD_MAX_RETRIES,
  DISCORD_MAX_RETRY_DELAY_MS
} from '../types/index.js';

/**
 * Delay helper for rate limiting / retry backoff.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Split text into messages no longer than `limit` characters (String.length / UTF-16 units),
 * preserving line boundaries where possible.
 *
 * Contract (plan:001 / ADR Decision 2, lead ruling M1):
 * - Empty input => [] (no messages).
 * - Decompose into segments where each segment is "a run of non-newline chars followed by a
 *   trailing '\n'", or "a run of non-newline chars at EOF (no trailing newline)", or a lone '\n'.
 *   This keeps each '\n' attached to the end of its preceding line.
 * - Greedily concatenate segments so the running length never exceeds `limit`.
 * - A single segment longer than `limit` is force-sliced into `limit`-sized pieces.
 * - Invariant: chunks.join('') === text (strict, including trailing-newline absence and "\n\n").
 * - Each chunk has 1..limit characters; no empty chunk is emitted.
 */
export function splitIntoMessages(text: string, limit: number = DISCORD_SAFE_LIMIT): string[] {
  if (text === '') {
    return [];
  }

  // Each segment carries its own trailing '\n' (if any). join('') of all segments === text.
  const segments = text.match(/[^\n]*\n|[^\n]+/g) ?? [];

  const chunks: string[] = [];
  let buffer = '';

  for (const segment of segments) {
    // If the segment alone exceeds the limit, flush the buffer and force-slice the segment.
    if (segment.length > limit) {
      if (buffer !== '') {
        chunks.push(buffer);
        buffer = '';
      }
      let rest = segment;
      while (rest.length > limit) {
        chunks.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      // Remaining tail (< limit) becomes the new buffer to allow further greedy concatenation.
      buffer = rest;
      continue;
    }

    // Would appending exceed the limit? If so, flush and start a new buffer with this segment.
    if (buffer.length + segment.length > limit) {
      if (buffer !== '') {
        chunks.push(buffer);
      }
      buffer = segment;
    } else {
      buffer += segment;
    }
  }

  if (buffer !== '') {
    chunks.push(buffer);
  }

  return chunks;
}

/**
 * Posts newsletter text to Discord channels via the REST API (v10) using a Bot token.
 *
 * Mirrors the EmailSender pattern: constructor DI + aggregate result type + per-chunk 429 retry.
 * `post()` never throws; it folds outcomes into a DiscordPostResult.
 */
export class DiscordSender {
  private token: string;

  constructor(token: string) {
    if (!token || token.trim() === '') {
      throw new Error('Discord bot token is required');
    }
    this.token = token;
  }

  /**
   * Pure split function (exported as method for convenience; the free function is the source).
   */
  splitIntoMessages(text: string, limit: number = DISCORD_SAFE_LIMIT): string[] {
    return splitIntoMessages(text, limit);
  }

  /**
   * Split `text` and POST each chunk sequentially to the channel.
   * Honors HTTP 429 retry_after; non-429 errors fail the chunk but processing continues.
   * Never throws.
   */
  async post(channelId: string, text: string): Promise<DiscordPostResult> {
    const chunks = splitIntoMessages(text);

    const result: DiscordPostResult = {
      channelId,
      totalChunks: chunks.length,
      successCount: 0,
      failedChunks: [],
      errors: []
    };

    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    for (let i = 0; i < chunks.length; i++) {
      const ok = await this.postChunkWithRetry(url, channelId, chunks[i], i, result);

      // Delay before the next chunk (not after the last one).
      if (ok && i < chunks.length - 1) {
        await delay(DISCORD_CHUNK_DELAY_MS);
      }
    }

    return result;
  }

  /**
   * POST a single chunk, retrying on 429 up to DISCORD_MAX_RETRIES.
   * Returns true on success, false on failure (failure is recorded in `result`).
   */
  private async postChunkWithRetry(
    url: string,
    channelId: string,
    content: string,
    index: number,
    result: DiscordPostResult
  ): Promise<boolean> {
    for (let retry = 0; retry <= DISCORD_MAX_RETRIES; retry++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content })
        });
      } catch (error) {
        // Network exception: non-retryable, record failure and continue with next chunk.
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.failedChunks.push(index);
        result.errors.push(`Chunk ${index} (channel ${channelId}): network error: ${message}`);
        return false;
      }

      if (response.ok) {
        result.successCount++;
        return true;
      }

      if (response.status === 429) {
        if (retry >= DISCORD_MAX_RETRIES) {
          result.failedChunks.push(index);
          result.errors.push(
            `Chunk ${index} (channel ${channelId}): rate limited (429), exceeded ${DISCORD_MAX_RETRIES} retries`
          );
          return false;
        }
        const waitMs = await this.resolveRetryDelay(response, retry);
        await delay(waitMs);
        continue;
      }

      // Non-429 4xx/5xx: non-retryable. Record and stop this chunk; caller continues.
      const bodySummary = await this.summarizeBody(response);
      result.failedChunks.push(index);
      result.errors.push(
        `Chunk ${index} (channel ${channelId}): HTTP ${response.status}${bodySummary ? ` - ${bodySummary}` : ''}`
      );
      return false;
    }

    // Unreachable in practice (loop returns), but satisfies control-flow analysis.
    result.failedChunks.push(index);
    result.errors.push(`Chunk ${index} (channel ${channelId}): unexpected retry loop exit`);
    return false;
  }

  /**
   * Resolve the wait time for a 429 response.
   * Primary: body JSON `retry_after` (seconds, may be fractional).
   * Fallback: `Retry-After` header (integer seconds).
   * Final fallback: 1s * (retry + 1). Clamped to DISCORD_MAX_RETRY_DELAY_MS.
   */
  private async resolveRetryDelay(response: Response, retry: number): Promise<number> {
    let seconds: number | undefined;

    try {
      const body = (await response.clone().json()) as { retry_after?: unknown };
      if (typeof body.retry_after === 'number' && Number.isFinite(body.retry_after)) {
        seconds = body.retry_after;
      }
    } catch {
      // ignore JSON parse failures; fall through to header / default
    }

    if (seconds === undefined) {
      const header = response.headers.get('Retry-After');
      if (header) {
        const parsed = Number(header);
        if (Number.isFinite(parsed)) {
          seconds = parsed;
        }
      }
    }

    const ms = seconds !== undefined ? seconds * 1000 : 1000 * (retry + 1);
    return Math.min(Math.max(ms, 0), DISCORD_MAX_RETRY_DELAY_MS);
  }

  /**
   * Best-effort short summary of an error response body for logging.
   */
  private async summarizeBody(response: Response): Promise<string> {
    try {
      const text = await response.clone().text();
      return text.slice(0, 200).replace(/\s+/g, ' ').trim();
    } catch {
      return '';
    }
  }
}
