import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { LocalModelTransactionExtractor } from '../src/extraction/providers/local-model-transaction-extractor.js';

const config = {
  get: vi.fn((key: keyof Environment) => {
    const values = {
      EXTRACTION_MODEL: 'local-test-model',
      EXTRACTION_PROMPT_VERSION: 'phase3-test',
      EXTRACTION_LOCAL_BASE_URL: 'http://localhost:11434/v1',
    };
    return values[key as keyof typeof values];
  }),
} as unknown as ConfigService<Environment, true>;

describe('LocalModelTransactionExtractor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('accepts only schema-valid JSON content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    transactions: [
                      {
                        type: 'expense',
                        amount: '250',
                        currency: 'ETB',
                        category: 'food',
                        confidence: 0.9,
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      }),
    );
    const extractor = new LocalModelTransactionExtractor(config);
    await expect(extractor.extract({ text: 'private text', locale: 'en' })).resolves.toMatchObject({
      transactions: [{ category: 'food' }],
    });
  });

  it('rejects malformed model output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'not-json' } }] }),
      }),
    );
    const extractor = new LocalModelTransactionExtractor(config);
    await expect(extractor.extract({ text: 'private text', locale: 'en' })).rejects.toMatchObject({
      code: 'invalid_output',
    });
  });

  it('aborts a model request after the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    const extractor = new LocalModelTransactionExtractor(config);
    const result = extractor.extract({ text: 'private text', locale: 'en' });
    const expectation = expect(result).rejects.toMatchObject({ code: 'invalid_output' });
    await vi.advanceTimersByTimeAsync(10_001);
    await expectation;
  });
});
