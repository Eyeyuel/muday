import type { CategoryRepository } from '../src/categories/category.repository.js';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GeminiTransactionExtractor,
  getPartitionedCategories,
  STANDARD_EXPENSE_SUGGESTIONS,
  STANDARD_INCOME_SUGGESTIONS,
} from '../src/extraction/providers/gemini-transaction-extractor.js';

const config = {
  get(key: string) {
    return {
      GEMINI_API_KEY: 'private-test-key',
      GEMINI_MODEL: 'gemini-test',
      EXTRACTION_PROMPT_VERSION: 'gemini-v1',
      GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
      GEMINI_TIMEOUT_MS: 5_000,
      GEMINI_AUDIO_MAX_RETRIES: 2,
      GEMINI_MAX_INLINE_AUDIO_BYTES: 12_000_000,
    }[key];
  },
} as never;

const validContent = JSON.stringify({
  transactions: [
    {
      type: 'expense',
      amount: '250.00',
      currency: 'ETB',
      category: 'food',
      note: 'shiro',
      confidence: 0.95,
    },
  ],
});

const validClassificationContent = JSON.stringify({
  transactions: [
    {
      status: 'ready',
      kind: 'loan_received',
      direction: 'inflow',
      amount: '5000.00',
      currency: 'ETB',
      category: 'borrowed_money',
      note: 'From Hana',
      confidence: 0.96,
      clarificationReason: null,
    },
  ],
});

const parseRequestBody = (body: BodyInit | null | undefined): unknown => {
  if (typeof body !== 'string') throw new Error('Expected a JSON string request body');
  return JSON.parse(body) as unknown;
};

afterEach(() => vi.unstubAllGlobals());

const mockCategoryRepository = {
  getUserCategories: vi.fn().mockResolvedValue([
    { label: 'food', type: 'expense' },
    { label: 'salary', type: 'income' },
  ]),
} as unknown as CategoryRepository;

describe('GeminiTransactionExtractor', () => {
  it('requests schema-constrained text extraction without placing the key in the URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: validContent }] } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new GeminiTransactionExtractor(config, mockCategoryRepository).extract({
      text: 'I bought shiro for 250 birr',
      locale: 'en',
    });
    expect(result.transactions[0]?.category).toBe('food');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('private-test-key');
    expect(options.headers).toMatchObject({ 'x-goog-api-key': 'private-test-key' });
    const body = parseRequestBody(options.body) as Record<string, unknown>;
    expect(body).toHaveProperty('generationConfig.responseJsonSchema');
    expect(JSON.stringify(body)).toContain('<user_message>');
  });

  it('sends WAV inline for one-step voice extraction', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-gemini-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: validContent }] } }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await new GeminiTransactionExtractor(config, mockCategoryRepository).extractAudio({
        wavPath,
        locale: 'am',
      });
      const body = parseRequestBody((fetchMock.mock.calls[0]?.[1] as RequestInit).body) as {
        contents: Array<{ parts: Array<{ inlineData?: { mimeType: string; data: string } }> }>;
      };
      const audio = body.contents[0]?.parts.find((part) => part.inlineData)?.inlineData;
      expect(audio?.mimeType).toBe('audio/wav');
      expect(audio?.data).toBe(Buffer.from('synthetic-wav').toString('base64'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('sends a receipt image inline with receipt-specific instructions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-receipt-gemini-test-'));
    const imagePath = join(directory, 'receipt.png');
    await writeFile(imagePath, Buffer.from('synthetic-png'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: validContent }] } }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await new GeminiTransactionExtractor(config, mockCategoryRepository).extractImage({
        imagePath,
        mimeType: 'image/png',
        locale: 'en',
      });
      const body = parseRequestBody((fetchMock.mock.calls[0]?.[1] as RequestInit).body) as {
        contents: Array<{
          parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
        }>;
      };
      expect(body.contents[0]?.parts[0]?.text).toContain('final amount');
      expect(body.contents[0]?.parts[1]?.inlineData).toEqual({
        mimeType: 'image/png',
        data: Buffer.from('synthetic-png').toString('base64'),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects malformed or provider-error output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(
      new GeminiTransactionExtractor(config, mockCategoryRepository).extract({
        text: 'test',
        locale: 'en',
      }),
    ).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('requests the parallel financial-event contract without changing legacy extraction', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await new GeminiTransactionExtractor(config, mockCategoryRepository).classify(
      {
        text: 'I borrowed 5000 birr from Hana',
        locale: 'en',
      },
      'user-id',
    );
    expect(result.transactions[0]).toMatchObject({
      kind: 'loan_received',
      category: 'borrowed_money',
    });
    const body = parseRequestBody((fetchMock.mock.calls[0]?.[1] as RequestInit).body) as {
      systemInstruction: { parts: Array<{ text: string }> };
      generationConfig: {
        responseJsonSchema: {
          properties: { transactions: { items: { properties: Record<string, unknown> } } };
        };
        temperature: number;
        candidateCount: number;
      };
    };
    const instruction = body.systemInstruction.parts[0]?.text ?? '';
    expect(instruction).toContain('ownership and financial meaning');
    expect(instruction).toContain('Never use Other to hide uncertainty');
    expect(instruction).toContain('Use the `note` field to preserve any valuable context');
    expect(body.generationConfig.responseJsonSchema).toBeDefined();
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.candidateCount).toBe(1);
    const properties =
      body.generationConfig.responseJsonSchema.properties.transactions.items.properties;
    expect(properties.status).toEqual({ type: 'string' });
    expect(properties.category).toEqual({ type: 'string' });
    expect(properties.status).not.toHaveProperty('enum');
    expect(properties.category).not.toHaveProperty('enum');
  });

  it('sends audio and receipt images through the new classification contract', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-classification-media-test-'));
    const wavPath = join(directory, 'voice.wav');
    const imagePath = join(directory, 'receipt.png');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    await writeFile(imagePath, Buffer.from('synthetic-image'));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(config, mockCategoryRepository);
    try {
      await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      await extractor.classifyImage({ imagePath, mimeType: 'image/png', locale: 'en' }, 'user-id');
      const audioBody = parseRequestBody((fetchMock.mock.calls[0]?.[1] as RequestInit).body) as {
        systemInstruction: { parts: Array<{ text: string }> };
        contents: Array<{ parts: Array<{ inlineData?: { mimeType: string } }> }>;
      };
      const imageBody = parseRequestBody((fetchMock.mock.calls[1]?.[1] as RequestInit).body) as {
        systemInstruction: { parts: Array<{ text: string }> };
        contents: Array<{ parts: Array<{ text?: string; inlineData?: { mimeType: string } }> }>;
      };
      expect(
        audioBody.contents[0]?.parts.find((part) => part.inlineData)?.inlineData?.mimeType,
      ).toBe('audio/wav');
      expect(audioBody.systemInstruction.parts[0]?.text).toContain('AUDIO-SPECIFIC RULES');
      expect(fetchMock.mock.calls[0]?.[0]).toContain('/models/gemini-test:generateContent');
      expect(imageBody.systemInstruction.parts[0]?.text).not.toContain('AUDIO-SPECIFIC RULES');
      expect(imageBody.contents[0]?.parts[0]?.text).toContain('refund document');
      expect(imageBody.contents[0]?.parts[1]?.inlineData?.mimeType).toBe('image/png');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('uses GEMINI_AUDIO_MODEL for audio classification when configured', async () => {
    const customConfig = {
      get(key: string) {
        return {
          GEMINI_API_KEY: 'private-test-key',
          GEMINI_MODEL: 'gemini-2.5-flash',
          GEMINI_AUDIO_MODEL: 'gemini-audio-override',
          EXTRACTION_PROMPT_VERSION: 'gemini-v1',
          GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
          GEMINI_TIMEOUT_MS: 5_000,
          GEMINI_AUDIO_MAX_RETRIES: 2,
        }[key];
      },
    } as never;

    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-model-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(customConfig, mockCategoryRepository);
    try {
      await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        '/models/gemini-audio-override:generateContent',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('builds rich audio classification prompt with Ethiopian context and speaker locale', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-prompt-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(config, mockCategoryRepository);
    try {
      await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      const audioBody = parseRequestBody((fetchMock.mock.calls[0]?.[1] as RequestInit).body) as {
        contents: Array<{ parts: Array<{ text?: string }> }>;
      };
      const promptText = audioBody.contents[0]?.parts[0]?.text ?? '';
      expect(promptText).toContain('Locale hint: am');
      expect(promptText).toContain('switch between them');
      expect(promptText).toContain('lemsa kefelku');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('emits sanitized debug logs for audio classification only when GEMINI_AUDIO_DEBUG_LOG is true', async () => {
    const debugConfig = {
      get(key: string) {
        return {
          GEMINI_API_KEY: 'private-test-key',
          GEMINI_MODEL: 'gemini-2.5-flash',
          GEMINI_AUDIO_DEBUG_LOG: true,
          EXTRACTION_PROMPT_VERSION: 'phase3-v3-audio-system',
          GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
          GEMINI_TIMEOUT_MS: 5_000,
          GEMINI_AUDIO_MAX_RETRIES: 2,
        }[key];
      },
    } as never;

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-debug-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(
      debugConfig,
      mockCategoryRepository,
      logger as never,
    );
    try {
      await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      expect(logger.debug).toHaveBeenCalledWith(
        'Audio classification result',
        expect.objectContaining({
          operation: 'gemini-audio-classification',
          model: 'gemini-2.5-flash',
          promptVersion: 'phase3-v3-audio-system',
          transactionCount: 1,
          statuses: ['ready'],
          kinds: ['loan_received'],
          categories: ['borrowed_money'],
          confidences: [0.96],
        }),
      );
      const debugPayload = logger.debug.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(debugPayload).not.toHaveProperty('amount');
      expect(debugPayload).not.toHaveProperty('note');
      expect(debugPayload).not.toHaveProperty('apiKey');
      expect(debugPayload).not.toHaveProperty('audio');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('never promotes an amount_missing audio result to ready', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-threshold-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const classificationWithMissingAmount = JSON.stringify({
      transactions: [
        {
          status: 'needs_clarification',
          kind: 'expense',
          direction: 'outflow',
          amount: 'none',
          currency: 'ETB',
          category: 'food_groceries',
          note: 'lunch',
          confidence: 0.75,
          clarificationReason: 'amount_missing',
        },
      ],
    });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: classificationWithMissingAmount }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(config, mockCategoryRepository);
    try {
      const result = await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      expect(result.transactions[0]?.status).toBe('needs_clarification');
      expect(result.transactions[0]?.kind).toBe('unclear');
      expect(result.transactions[0]?.direction).toBe('unclear');
      expect(result.transactions[0]?.category).toBeNull();
      expect(result.transactions[0]?.clarificationReason).toBe('amount_missing');
      expect(result.transactions[0]?.amount).toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does NOT promote audio needs_clarification events when confidence < threshold or reason is not amount_missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-threshold-negative-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const classificationVarious = JSON.stringify({
      transactions: [
        {
          status: 'needs_clarification',
          kind: 'expense',
          direction: 'outflow',
          amount: 'none',
          currency: 'ETB',
          category: 'food_groceries',
          note: 'lunch',
          confidence: 0.65,
          clarificationReason: 'amount_missing',
        },
        {
          status: 'needs_clarification',
          kind: 'unclear',
          direction: 'unclear',
          amount: '5000.00',
          currency: 'ETB',
          category: 'none',
          note: 'from Hana',
          confidence: 0.95,
          clarificationReason: 'purpose',
        },
      ],
    });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: classificationVarious }] } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(config, mockCategoryRepository);
    try {
      const result = await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      expect(result.transactions[0]?.status).toBe('needs_clarification');
      expect(result.transactions[0]?.clarificationReason).toBe('amount_missing');
      expect(result.transactions[1]?.status).toBe('needs_clarification');
      expect(result.transactions[1]?.clarificationReason).toBe('purpose');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('retries audio classification on transient provider failure and succeeds', async () => {
    const retryConfig = {
      get(key: string) {
        return {
          GEMINI_API_KEY: 'private-test-key',
          GEMINI_MODEL: 'gemini-2.5-flash',
          GEMINI_AUDIO_MAX_RETRIES: 2,
          EXTRACTION_PROMPT_VERSION: 'phase3-v3-audio-system',
          GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
          GEMINI_TIMEOUT_MS: 5_000,
        }[key];
      },
    } as never;

    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-retry-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'temporary 503' } }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: validClassificationContent }] } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(retryConfig, mockCategoryRepository);
    try {
      const result = await extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.transactions[0]?.kind).toBe('loan_received');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('does not retry permanent Gemini client errors', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-permanent-error-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(
        new GeminiTransactionExtractor(config, mockCategoryRepository).classifyAudio(
          { wavPath, locale: 'am' },
          'user-id',
        ),
      ).rejects.toMatchObject({ code: 'invalid_output' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('throws after exhausting all retries on persistent provider failures', async () => {
    const retryConfig = {
      get(key: string) {
        return {
          GEMINI_API_KEY: 'private-test-key',
          GEMINI_MODEL: 'gemini-2.5-flash',
          GEMINI_AUDIO_MAX_RETRIES: 1,
          EXTRACTION_PROMPT_VERSION: 'phase3-v3-audio-system',
          GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
          GEMINI_TIMEOUT_MS: 5_000,
        }[key];
      },
    } as never;

    const directory = await mkdtemp(join(tmpdir(), 'mezgeb-audio-retry-exhaust-test-'));
    const wavPath = join(directory, 'voice.wav');
    await writeFile(wavPath, Buffer.from('synthetic-wav'));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'temporary 500' } }), { status: 500 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const extractor = new GeminiTransactionExtractor(retryConfig, mockCategoryRepository);
    try {
      await expect(
        extractor.classifyAudio({ wavPath, locale: 'am' }, 'user-id'),
      ).rejects.toMatchObject({
        code: 'invalid_output',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('normalizes Gemini wire sentinels before strict domain validation', async () => {
    const content = JSON.stringify({
      transactions: [
        {
          status: 'ready',
          kind: 'income',
          direction: 'inflow',
          amount: '12000',
          currency: 'ETB',
          category: 'salary',
          note: 'none',
          confidence: 1,
          clarificationReason: 'none',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }),
            { status: 200 },
          ),
        ),
    );

    await expect(
      new GeminiTransactionExtractor(config, mockCategoryRepository).classify(
        {
          text: 'I received 12000 birr salary',
          locale: 'en',
        },
        'user-id',
      ),
    ).resolves.toEqual({
      transactions: [
        expect.objectContaining({
          kind: 'income',
          category: 'salary',
          note: undefined,
          clarificationReason: null,
        }),
      ],
    });
  });

  it('extracts and normalizes payment platform from response', async () => {
    const content = JSON.stringify({
      transactions: [
        {
          status: 'ready',
          kind: 'expense',
          direction: 'outflow',
          amount: '300',
          currency: 'ETB',
          category: 'food',
          note: 'lunch',
          platform: 'telebirr',
          confidence: 1,
          clarificationReason: 'none',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }),
            { status: 200 },
          ),
        ),
    );

    const result = await new GeminiTransactionExtractor(config, mockCategoryRepository).classify(
      {
        text: 'I paid 300 birr for lunch using telebirr',
        locale: 'en',
      },
      'user-id',
    );

    expect(result.transactions[0]).toMatchObject({
      kind: 'expense',
      amount: '300',
      category: 'food',
      note: 'lunch',
      platform: 'telebirr',
    });
  });

  it('does not allow Gemini to guess an unstated incoming-payment purpose', async () => {
    const guessedGift = JSON.stringify({
      transactions: [
        {
          status: 'ready',
          kind: 'income',
          direction: 'inflow',
          amount: '5000',
          currency: 'ETB',
          category: 'gift_received',
          note: 'from Hana',
          confidence: 1,
          clarificationReason: 'none',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: guessedGift }] } }] }),
            { status: 200 },
          ),
        ),
    );

    const result = await new GeminiTransactionExtractor(config, mockCategoryRepository).classify(
      {
        text: 'I received 5000 birr from Hana',
        locale: 'en',
      },
      'user-id',
    );
    expect(result.transactions[0]).toMatchObject({
      status: 'needs_clarification',
      kind: 'unclear',
      category: null,
      clarificationReason: 'purpose',
    });
  });

  it('does not allow Gemini to assume a bare transfer is internal', async () => {
    const guessedTransfer = JSON.stringify({
      transactions: [
        {
          status: 'unsupported',
          kind: 'transfer',
          direction: 'internal',
          amount: '2000',
          currency: 'ETB',
          category: 'none',
          confidence: 1,
          clarificationReason: 'none',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: guessedTransfer }] } }] }),
            { status: 200 },
          ),
        ),
    );

    const result = await new GeminiTransactionExtractor(config, mockCategoryRepository).classify(
      {
        text: 'I transferred 2000 birr',
        locale: 'en',
      },
      'user-id',
    );
    expect(result.transactions[0]).toMatchObject({
      status: 'needs_clarification',
      kind: 'unclear',
      category: null,
      clarificationReason: 'ownership',
    });
  });

  describe('getPartitionedCategories & Anti-Collision', () => {
    it('provides full standard suggestions when user has 0 categories', () => {
      const { userExpenses, userIncomes, suggestedExpenses, suggestedIncomes } =
        getPartitionedCategories([], []);

      expect(userExpenses).toEqual([]);
      expect(userIncomes).toEqual([]);
      expect(suggestedExpenses).toEqual(STANDARD_EXPENSE_SUGGESTIONS);
      expect(suggestedIncomes).toEqual(STANDARD_INCOME_SUGGESTIONS);
    });

    it('filters out existing user categories from suggestions without duplication or collision', () => {
      const userExpenses = ['food', 'gym', 'transport'];
      const userIncomes = ['salary', 'freelance'];

      const { suggestedExpenses, suggestedIncomes } = getPartitionedCategories(
        userIncomes,
        userExpenses,
      );

      // food and transport must NOT appear in suggestedExpenses
      expect(suggestedExpenses).not.toContain('food');
      expect(suggestedExpenses).not.toContain('transport');
      expect(suggestedExpenses).toContain('groceries');
      expect(suggestedExpenses).toContain('utilities');

      // salary must NOT appear in suggestedIncomes
      expect(suggestedIncomes).not.toContain('salary');
      expect(suggestedIncomes).toContain('business');
      expect(suggestedIncomes).toContain('remittance');
    });

    it('handles case-insensitivity in deduplication', () => {
      const userExpenses = ['FOOD', 'Transport '];
      const { suggestedExpenses } = getPartitionedCategories([], userExpenses);

      expect(suggestedExpenses).not.toContain('food');
      expect(suggestedExpenses).not.toContain('transport');
    });
  });
});
