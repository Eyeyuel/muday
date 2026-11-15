import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { HasabSpeechToTextProvider } from '../src/stt/providers/hasab-speech-to-text.provider.js';

const directories: string[] = [];

function provider(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    HASAB_API_KEY: 'test-secret-key',
    HASAB_BASE_URL: 'https://api.hasab.ai/api',
    HASAB_TIMEOUT_MS: 500,
    HASAB_MAX_RETRIES: 0,
    HASAB_RETRY_BASE_DELAY_MS: 1,
    HASAB_MAX_RESPONSE_BYTES: 1_000_000,
    HASAB_DAILY_REQUEST_LIMIT: 100,
    HASAB_CIRCUIT_FAILURE_THRESHOLD: 3,
    HASAB_CIRCUIT_COOLDOWN_SECONDS: 300,
    STT_MODEL: 'hasab-test',
    ...overrides,
  };
  return new HasabSpeechToTextProvider({
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService<Environment, true>);
}

async function wavPath() {
  const directory = await mkdtemp(join(tmpdir(), 'mezgeb-hasab-test-'));
  directories.push(directory);
  const path = join(directory, 'voice.wav');
  await writeFile(path, Buffer.from('test-wave'));
  return path;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('HasabSpeechToTextProvider', () => {
  it('uses Hasab multipart fields and parses the documented response', async () => {
    const fetchMock = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, transcription: 'I spent 250 birr on lunch' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await provider().transcribe({ wavPath: await wavPath(), locale: 'en' });
    expect(result.transcript).toBe('I spent 250 birr on lunch');
    expect(result.provider).toBe('hasab');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.hasab.ai/api/v1/upload-audio',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret-key' },
      }),
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('transcribe')).toBe('true');
    expect(form.get('translate')).toBe('false');
    expect(form.get('summarize')).toBe('false');
    expect(form.get('timestamps')).toBe('false');
    expect(form.get('language')).toBe('auto');
    expect(form.has('source_language')).toBe(false);
  });

  it('uses automatic language detection for both saved locales and parses nested transcripts', async () => {
    const fetchMock = vi
      .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              audio: { transcription: '  ለ lunch 300 birr ከፈልኩ  ' },
            }),
            { status: 200 },
          ),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const subject = provider();

    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).resolves.toMatchObject({
      transcript: 'ለ lunch 300 birr ከፈልኩ',
    });
    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'en' }),
    ).resolves.toMatchObject({
      transcript: 'ለ lunch 300 birr ከፈልኩ',
    });

    for (const call of fetchMock.mock.calls) {
      const form = call[1]?.body as FormData;
      expect(form.get('language')).toBe('auto');
      expect(form.has('source_language')).toBe(false);
    }
  });

  it('maps authentication and malformed responses to safe STT errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(
      provider().transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).rejects.toMatchObject({
      code: 'authentication',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(
      provider().transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('opens its circuit after bounded repeated provider failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const subject = provider({ HASAB_CIRCUIT_FAILURE_THRESHOLD: 2, HASAB_MAX_RETRIES: 0 });
    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).rejects.toMatchObject({
      code: 'failed',
    });
    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).rejects.toMatchObject({
      code: 'failed',
    });
    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'am' }),
    ).rejects.toMatchObject({
      code: 'failed',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('enforces the configured daily request budget', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ transcription: 'salary 5000 birr' }), { status: 200 }),
        ),
    );
    const subject = provider({ HASAB_DAILY_REQUEST_LIMIT: 1 });
    await subject.transcribe({ wavPath: await wavPath(), locale: 'en' });
    await expect(
      subject.transcribe({ wavPath: await wavPath(), locale: 'en' }),
    ).rejects.toMatchObject({
      code: 'quota',
    });
  });

  it('rejects oversized, invalid JSON, explicit failure, and empty transcripts without retrying', async () => {
    const responses = [
      new Response('{}', { status: 200, headers: { 'content-length': '101' } }),
      new Response('not-json', { status: 200 }),
      new Response(JSON.stringify({ success: false, transcription: 'must not be accepted' }), {
        status: 200,
      }),
      new Response(JSON.stringify({ success: true, transcription: '   ' }), { status: 200 }),
    ];
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(responses.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const subject = provider({ HASAB_MAX_RESPONSE_BYTES: 100, HASAB_MAX_RETRIES: 2 });

    for (let index = 0; index < 4; index += 1) {
      await expect(
        subject.transcribe({ wavPath: await wavPath(), locale: 'am' }),
      ).rejects.toMatchObject({ code: 'invalid_response', retryable: false });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries bounded transient 5xx and network failures before succeeding', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('private network detail'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, transcription: 'salary 5000 birr' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      provider({ HASAB_MAX_RETRIES: 2, HASAB_CIRCUIT_FAILURE_THRESHOLD: 10 }).transcribe({
        wavPath: await wavPath(),
        locale: 'en',
      }),
    ).resolves.toMatchObject({ transcript: 'salary 5000 birr' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps aborts to retryable timeouts and never retries authentication or quota errors', async () => {
    const timeoutFetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('timed out', 'AbortError'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ transcription: 'taxi 100 birr' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', timeoutFetch);
    await expect(
      provider({ HASAB_MAX_RETRIES: 1, HASAB_CIRCUIT_FAILURE_THRESHOLD: 10 }).transcribe({
        wavPath: await wavPath(),
        locale: 'am',
      }),
    ).resolves.toMatchObject({ transcript: 'taxi 100 birr' });
    expect(timeoutFetch).toHaveBeenCalledTimes(2);

    for (const status of [401, 403, 402, 429]) {
      const permanentFetch = vi.fn().mockResolvedValue(new Response('{}', { status }));
      vi.stubGlobal('fetch', permanentFetch);
      await expect(
        provider({ HASAB_MAX_RETRIES: 2 }).transcribe({
          wavPath: await wavPath(),
          locale: 'en',
        }),
      ).rejects.toMatchObject({
        code: status === 401 || status === 403 ? 'authentication' : 'quota',
        retryable: false,
      });
      expect(permanentFetch).toHaveBeenCalledTimes(1);
    }
  });

  it('does not emit credentials, paths, transcripts, provider bodies, amounts, or notes to logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('contains private provider response and 5000 birr')),
    );

    await expect(
      provider({ HASAB_MAX_RETRIES: 0 }).transcribe({
        wavPath: await wavPath(),
        locale: 'am',
      }),
    ).rejects.toMatchObject({ code: 'failed' });

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
