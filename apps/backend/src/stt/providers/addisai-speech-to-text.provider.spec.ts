/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { AddisAiSpeechToTextProvider } from './addisai-speech-to-text.provider.js';
import { SttError } from '../stt.error.js';

describe('AddisAiSpeechToTextProvider', () => {
  let provider: AddisAiSpeechToTextProvider;
  let mockConfigService: any;
  let fetchMock: any;
  beforeEach(async () => {
    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        switch (key) {
          case 'ADDISAI_API_KEY':
            return 'test-key';
          case 'ADDISAI_BASE_URL':
            return 'https://api.test.com/api';
          case 'ADDISAI_TIMEOUT_MS':
            return 1000;
          case 'ADDISAI_MAX_RETRIES':
            return 1;
          case 'ADDISAI_RETRY_BASE_DELAY_MS':
            return 10;
          case 'ADDISAI_MAX_RESPONSE_BYTES':
            return 1000000;
          case 'ADDISAI_DAILY_REQUEST_LIMIT':
            return 10;
          case 'ADDISAI_CIRCUIT_FAILURE_THRESHOLD':
            return 2;
          case 'ADDISAI_CIRCUIT_COOLDOWN_SECONDS':
            return 1;
          default:
            return null;
        }
      }),
    };

    provider = new AddisAiSpeechToTextProvider(mockConfigService);

    // Mock fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    // Mock fs.readFile
    vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('mock-audio'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully transcribe audio', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '100' }),
      body: {
        getReader: () => {
          let read = false;
          return {
            read: async () => {
              if (!read) {
                read = true;
                return {
                  done: false,
                  value: Buffer.from(
                    JSON.stringify({
                      status: 'success',
                      data: { transcription: 'test transcript' },
                    }),
                  ),
                };
              }
              return { done: true, value: undefined };
            },
            cancel: async () => {},
          };
        },
      },
    });

    const result = await provider.transcribe({ wavPath: 'test.wav', locale: 'en' });
    expect(result.transcript).toBe('test transcript');
    expect(result.provider).toBe('addisai');
    expect(result.model).toBe('addisai-transcription-v2');
  });

  it('should handle authentication errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    });

    await expect(provider.transcribe({ wavPath: 'test.wav', locale: 'en' })).rejects.toThrow(
      new SttError('authentication'),
    );
  });

  it('should retry on transient failures (500)', async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '100' }),
        body: {
          getReader: () => {
            let read = false;
            return {
              read: async () => {
                if (!read) {
                  read = true;
                  return {
                    done: false,
                    value: Buffer.from(
                      JSON.stringify({
                        status: 'success',
                        data: { transcription: 'test transcript' },
                      }),
                    ),
                  };
                }
                return { done: true, value: undefined };
              },
              cancel: async () => {},
            };
          },
        },
      };
    });

    const result = await provider.transcribe({ wavPath: 'test.wav', locale: 'en' });
    expect(result.transcript).toBe('test transcript');
    expect(callCount).toBe(2);
  });
});
