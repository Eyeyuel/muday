import { describe, expect, it, vi } from 'vitest';

import { I18nService } from '../src/i18n/i18n.service.js';
import type { TransactionExtractor } from '../src/extraction/transaction-extractor.interface.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { SpeechToTextProvider } from '../src/stt/speech-to-text.interface.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { VoiceJobData } from '../src/voice/voice-job.js';
import type { VoiceMediaService } from '../src/voice/voice-media.service.js';
import { VoiceProcessingService } from '../src/voice/voice-processing.service.js';

const job: VoiceJobData = {
  userId: 'user-id',
  telegramId: 100,
  chatId: 200,
  updateId: 300,
  messageId: 400,
  messageAt: '2026-08-01T06:00:00.000Z',
  fileId: 'opaque-file-id',
  locale: 'en',
};

function setup(options: { sttError?: Error; transactionError?: Error; direct?: boolean } = {}) {
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const media = {
    prepare: vi.fn().mockResolvedValue({
      directory: '/safe/job',
      inputPath: '/safe/job/input.oga',
      wavPath: '/safe/job/voice.wav',
    }),
    cleanup,
    cleanupAbandoned: vi.fn(),
  } as unknown as VoiceMediaService;
  const transcribe = options.sttError
    ? vi.fn().mockRejectedValue(options.sttError)
    : vi.fn().mockResolvedValue({
        transcript: 'I spent 250 birr on lunch',
        provider: 'hasab',
        model: 'hasab-v1',
        latencyMs: 20,
      });
  const stt = {
    provider: 'fake',
    model: 'fake-v1',
    transcribe,
  } as SpeechToTextProvider;
  const logVoiceTranscript = options.transactionError
    ? vi.fn().mockRejectedValue(options.transactionError)
    : vi.fn().mockResolvedValue(true);
  const transactions = { logVoiceTranscript } as unknown as TextTransactionService;
  const logDirectVoiceExtraction = options.transactionError
    ? vi.fn().mockRejectedValue(options.transactionError)
    : vi.fn().mockResolvedValue(true);
  Object.assign(transactions, { logDirectVoiceExtraction });
  const logDirectVoiceClassification = options.transactionError
    ? vi.fn().mockRejectedValue(options.transactionError)
    : vi.fn().mockResolvedValue(true);
  Object.assign(transactions, { logDirectVoiceClassification });
  const extractAudio = vi.fn().mockResolvedValue({
    transactions: [
      {
        type: 'expense',
        amount: '250',
        currency: 'ETB',
        category: 'food',
        note: 'shiro',
        confidence: 0.95,
      },
    ],
  });
  const classifyAudio = vi.fn().mockResolvedValue({
    transactions: [
      {
        status: 'ready',
        kind: 'expense',
        direction: 'outflow',
        amount: '250',
        currency: 'ETB',
        category: 'food_groceries',
        note: 'shiro',
        confidence: 0.95,
        clarificationReason: null,
      },
    ],
  });
  const extractor = {
    model: 'gemini-test',
    promptVersion: 'gemini-v1',
    extract: vi.fn(),
    extractAudio,
    classifyAudio,
  } as unknown as TransactionExtractor;
  const create = vi.fn<(input: unknown) => Promise<object>>().mockResolvedValue({});
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
    event: { create },
    processedUpdate: { update },
  } as unknown as PrismaService;
  const service = new VoiceProcessingService(
    media,
    stt,
    extractor,
    transactions,
    prisma,
    new I18nService(),
    new RecordingTelegramTransport(),
    { error: vi.fn() } as unknown as StructuredLogger,
    { get: () => (options.direct ? 'direct' : 'stt_then_extract') } as never,
  );
  return {
    service,
    transcribe,
    cleanup,
    logVoiceTranscript,
    logDirectVoiceExtraction,
    logDirectVoiceClassification,
    extractor,
    extractAudio,
    classifyAudio,
    create,
  };
}

describe('VoiceProcessingService', () => {
  it('passes an in-memory transcript into voice ingestion and always cleans files', async () => {
    const {
      service,
      transcribe,
      cleanup,
      logVoiceTranscript,
      create,
      classifyAudio,
      extractAudio,
    } = setup();
    await service.process(job);
    expect(transcribe).toHaveBeenCalledWith({
      wavPath: '/safe/job/voice.wav',
      locale: 'en',
    });
    expect(logVoiceTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'I spent 250 birr on lunch',
        source: 'voice',
        sttProvider: 'hasab',
        sttModel: 'hasab-v1',
      }),
    );
    expect(cleanup).toHaveBeenCalledWith('/safe/job');
    expect(classifyAudio).not.toHaveBeenCalled();
    expect(extractAudio).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
    expect(JSON.stringify(create.mock.calls[0]?.[0])).not.toContain('I spent 250 birr');
  });

  it('cleans files when STT or transaction processing fails', async () => {
    const sttFailure = setup({ sttError: new Error('provider unavailable') });
    await expect(sttFailure.service.process(job)).rejects.toThrow();
    expect(sttFailure.logVoiceTranscript).not.toHaveBeenCalled();
    expect(sttFailure.cleanup).toHaveBeenCalledOnce();

    const transactionFailure = setup({ transactionError: new Error('database unavailable') });
    await expect(transactionFailure.service.process(job)).rejects.toThrow();
    expect(transactionFailure.cleanup).toHaveBeenCalledOnce();
  });

  it('uses one direct audio extraction and bypasses STT in direct mode', async () => {
    const {
      service,
      classifyAudio,
      extractAudio,
      logDirectVoiceExtraction,
      logDirectVoiceClassification,
      logVoiceTranscript,
      cleanup,
    } = setup({ direct: true });
    await service.process(job);
    expect(classifyAudio).toHaveBeenCalledWith(
      {
        wavPath: '/safe/job/voice.wav',
        locale: 'en',
      },
      'user-id',
    );
    expect(logDirectVoiceClassification).toHaveBeenCalledWith(
      expect.objectContaining({ extractionModel: 'gemini-test', promptVersion: 'gemini-v1' }),
      {
        transactions: [
          {
            status: 'ready',
            kind: 'expense',
            direction: 'outflow',
            amount: '250',
            currency: 'ETB',
            category: 'food_groceries',
            note: 'shiro',
            confidence: 0.95,
            clarificationReason: null,
          },
        ],
      },
    );
    expect(extractAudio).not.toHaveBeenCalled();
    expect(logDirectVoiceExtraction).not.toHaveBeenCalled();
    expect(logVoiceTranscript).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledWith('/safe/job');
  });
});
