import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DiscordSender, splitIntoMessages } from '../../src/application/discord-sender.js';

function makeResponse(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {}
): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    headers: {
      get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null
    },
    clone() {
      return this;
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  } as unknown as Response;
}

describe('splitIntoMessages', () => {
  it('returns empty array for empty input', () => {
    expect(splitIntoMessages('')).toEqual([]);
  });

  it('returns a single chunk when text is within the limit', () => {
    const text = 'hello\nworld';
    const chunks = splitIntoMessages(text, 1900);
    expect(chunks).toEqual(['hello\nworld']);
    expect(chunks.join('')).toBe(text);
  });

  it('handles text exactly at the limit as one chunk', () => {
    const text = 'a'.repeat(10);
    const chunks = splitIntoMessages(text, 10);
    expect(chunks).toEqual(['aaaaaaaaaa']);
    expect(chunks.join('')).toBe(text);
    expect(chunks[0].length).toBe(10);
  });

  it('splits when text is limit + 1 (single line force-split)', () => {
    const text = 'a'.repeat(11);
    const chunks = splitIntoMessages(text, 10);
    expect(chunks).toEqual(['aaaaaaaaaa', 'a']);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => c.length >= 1 && c.length <= 10)).toBe(true);
  });

  it('force-splits a single line that far exceeds the limit', () => {
    const text = 'x'.repeat(25);
    const chunks = splitIntoMessages(text, 10);
    expect(chunks).toEqual(['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxx']);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => c.length >= 1 && c.length <= 10)).toBe(true);
  });

  it('greedily packs multiple lines without exceeding the limit', () => {
    // "aaa\n" (4) + "bbb\n" (4) = 8 <= 10; "ccc" (3) would overflow -> new chunk
    const text = 'aaa\nbbb\nccc';
    const chunks = splitIntoMessages(text, 8);
    expect(chunks).toEqual(['aaa\nbbb\n', 'ccc']);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => c.length >= 1 && c.length <= 8)).toBe(true);
  });

  it('preserves consecutive newlines (\\n\\n) and round-trips exactly', () => {
    const text = 'a\n\nb';
    const chunks = splitIntoMessages(text, 1900);
    expect(chunks.join('')).toBe(text);

    const tiny = splitIntoMessages('a\n\nb', 2);
    expect(tiny.join('')).toBe('a\n\nb');
    expect(tiny.every(c => c.length >= 1 && c.length <= 2)).toBe(true);
  });

  it('preserves a trailing newline exactly', () => {
    const text = 'line1\nline2\n';
    const chunks = splitIntoMessages(text, 1900);
    expect(chunks.join('')).toBe(text);
  });

  it('round-trips the real fixture exactly with each chunk <= 1900', () => {
    const fixturePath = path.join(
      process.cwd(),
      'output',
      'newsletter-kSmyXNiKZDznRMGx4G9c.txt'
    );
    const text = fs.readFileSync(fixturePath, 'utf-8');
    const chunks = splitIntoMessages(text);

    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => c.length >= 1 && c.length <= 1900)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('forces a tiny limit on the real fixture and still round-trips', () => {
    const fixturePath = path.join(
      process.cwd(),
      'output',
      'newsletter-kSmyXNiKZDznRMGx4G9c.txt'
    );
    const text = fs.readFileSync(fixturePath, 'utf-8');
    const chunks = splitIntoMessages(text, 100);

    expect(chunks.join('')).toBe(text);
    expect(chunks.every(c => c.length >= 1 && c.length <= 100)).toBe(true);
  });
});

describe('DiscordSender', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('throws when token is empty or whitespace', () => {
    expect(() => new DiscordSender('')).toThrow('Discord bot token is required');
    expect(() => new DiscordSender('   ')).toThrow('Discord bot token is required');
  });

  it('returns totalChunks 0 and makes no POST for empty text', async () => {
    const sender = new DiscordSender('token-abc');
    const result = await sender.post('chan-1', '');

    expect(result.totalChunks).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failedChunks).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the correct URL with Bot auth header and content body', async () => {
    fetchMock.mockResolvedValue(makeResponse(200, { id: 'msg-1' }));

    const sender = new DiscordSender('token-abc');
    const result = await sender.post('chan-123', 'hello world');

    expect(result.successCount).toBe(1);
    expect(result.totalChunks).toBe(1);
    expect(result.failedChunks).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/channels/chan-123/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bot token-abc');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ content: 'hello world' });
  });

  it('retries on 429 honoring retry_after and eventually succeeds', async () => {
    vi.useFakeTimers();

    fetchMock
      .mockResolvedValueOnce(makeResponse(429, { retry_after: 0.5 }))
      .mockResolvedValueOnce(makeResponse(200, { id: 'msg-1' }));

    const sender = new DiscordSender('token-abc');
    const promise = sender.post('chan-1', 'retry me');

    // Let the first fetch + 429 handling run, advance past the retry_after wait.
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.successCount).toBe(1);
    expect(result.failedChunks).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 403 and records the failed chunk', async () => {
    fetchMock.mockResolvedValue(makeResponse(403, { message: 'Missing Permissions' }));

    const sender = new DiscordSender('token-abc');
    const result = await sender.post('chan-1', 'forbidden');

    expect(result.successCount).toBe(0);
    expect(result.failedChunks).toEqual([0]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('continues to remaining chunks after a non-429 failure (partial delivery)', async () => {
    vi.useFakeTimers();

    // First chunk fails (404), second chunk succeeds.
    fetchMock
      .mockResolvedValueOnce(makeResponse(404, { message: 'Unknown Channel' }))
      .mockResolvedValueOnce(makeResponse(200, { id: 'msg-2' }));

    const sender = new DiscordSender('token-abc');
    // Force two chunks via tiny content with newline; use limit through long text.
    const promise = sender.post('chan-1', 'a'.repeat(1900) + 'b'.repeat(50));
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.totalChunks).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failedChunks).toEqual([0]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
