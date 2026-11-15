import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../src/database/prisma.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { ReceiptMediaService } from '../src/receipt/receipt-media.service.js';
import { ReceiptProcessingService } from '../src/receipt/receipt-processing.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';

const job = {
  userId: 'user-id',
  telegramId: 100,
  chatId: 200,
  updateId: 300,
  messageId: 400,
  messageAt: '2026-08-13T09:00:00.000Z',
  fileId: 'opaque-file',
  mimeType: 'image/png' as const,
  locale: 'en' as const,
};

function setup(classification: unknown) {
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const requestReceiptClassification = vi.fn().mockResolvedValue(false);
  const service = new ReceiptProcessingService(
    {
      prepare: vi
        .fn()
        .mockResolvedValue({ directory: '/safe/receipt', imagePath: '/safe/receipt/image.png' }),
      cleanup,
    } as unknown as ReceiptMediaService,
    {
      model: 'gemini-test',
      promptVersion: 'classification-v1',
      extract: vi.fn(),
      classifyImage: vi.fn().mockResolvedValue(classification),
    },
    { requestReceiptClassification } as unknown as TextTransactionService,
    {
      user: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      processedUpdate: { update: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService,
    new I18nService(),
    new RecordingTelegramTransport(),
    { error: vi.fn() } as unknown as StructuredLogger,
  );
  return { service, cleanup, requestReceiptClassification };
}

describe('ReceiptProcessingService classification path', () => {
  it('passes a refund document through the same classified receipt confirmation boundary', async () => {
    const classification = {
      transactions: [
        {
          status: 'ready',
          kind: 'refund',
          direction: 'inflow',
          amount: '345.00',
          currency: 'ETB',
          category: 'refund',
          note: 'Test Supermarket',
          confidence: 0.96,
          clarificationReason: null,
        },
      ],
    };
    const { service, cleanup, requestReceiptClassification } = setup(classification);
    await service.process(job);
    expect(requestReceiptClassification).toHaveBeenCalledWith(
      expect.objectContaining({ extractionModel: 'gemini-test' }),
      classification,
    );
    expect(cleanup).toHaveBeenCalledWith('/safe/receipt');
  });

  it('always removes the temporary receipt when classified processing rejects it', async () => {
    const failure = setup({ transactions: [] });
    failure.requestReceiptClassification.mockRejectedValue(new Error('invalid receipt'));
    await expect(failure.service.process(job)).rejects.toThrow('invalid receipt');
    expect(failure.cleanup).toHaveBeenCalledWith('/safe/receipt');
  });
});
