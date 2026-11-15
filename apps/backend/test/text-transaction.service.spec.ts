import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { ExtractionError } from '../src/extraction/extraction.error.js';
import type { TransactionExtractor } from '../src/extraction/transaction-extractor.interface.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { InteractionRepository } from '../src/interactions/interaction.repository.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { TextLogRateLimiter } from '../src/rate-limit/text-log-rate-limiter.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { ClarificationCandidateService } from '../src/transactions/clarification-candidate.service.js';
import { TextNormalizerService } from '../src/extraction/text-normalizer.service.js';
import type { TransactionRepository } from '../src/transactions/transaction.repository.js';
import { TransactionValidationService } from '../src/transactions/transaction-validation.service.js';
import { FinancialEventValidationService } from '../src/transactions/financial-event-validation.service.js';
import type { UsersService } from '../src/users/users.service.js';

function setup(options: { extractionError?: ExtractionError; databaseError?: Error } = {}) {
  const extract = options.extractionError
    ? vi.fn().mockRejectedValue(options.extractionError)
    : vi.fn().mockResolvedValue({
        transactions: [
          {
            type: 'expense',
            amount: '250',
            currency: 'ETB',
            category: 'food',
            note: 'lunch',
            confidence: 0.95,
          },
        ],
      });
  const extractor = {
    model: 'test-model',
    promptVersion: 'test-prompt',
    extract,
  } as TransactionExtractor;
  const logText = options.databaseError
    ? vi.fn().mockRejectedValue(options.databaseError)
    : vi.fn().mockResolvedValue({ groupId: 'group-id', firstLog: false });
  const repository = { logText, latestActiveGroup: vi.fn() } as unknown as TransactionRepository;
  const createInteraction = vi.fn().mockResolvedValue({ id: 'interaction-id' });
  const findPending = vi.fn().mockResolvedValue(null);
  const interactions = {
    findPendingForUser: vi.fn().mockResolvedValue(null),
    findPending,
    create: createInteraction,
  } as unknown as InteractionRepository;
  const candidates = {
    infer: vi.fn().mockReturnValue(null),
  } as unknown as ClarificationCandidateService;
  const users = {
    findByTelegramId: vi.fn().mockResolvedValue({ id: 'user-id', language: 'EN' }),
  } as unknown as UsersService;
  const rateLimiter = { allowed: vi.fn().mockResolvedValue(true) } as unknown as TextLogRateLimiter;
  const transport = new RecordingTelegramTransport();
  const logger = { error: vi.fn() } as unknown as StructuredLogger;
  const config = { get: vi.fn().mockReturnValue(2_000) } as unknown as ConfigService<
    Environment,
    true
  >;
  const service = new TextTransactionService(
    extractor,
    new TransactionValidationService(),
    new FinancialEventValidationService(),
    repository,
    interactions,
    candidates,
    new TextNormalizerService(),
    rateLimiter,
    users,
    new I18nService(),
    transport,
    logger,
    config,
  );
  return { service, transport, logText, createInteraction, findPending };
}

const input = {
  telegramId: 100,
  chatId: 200,
  updateId: 300,
  messageId: 400,
  messageAt: new Date('2026-08-01T05:00:00.000Z'),
  text: 'I spent 250 birr on lunch',
};

describe('TextTransactionService', () => {
  it('confirms only after a successful ledger write', async () => {
    const { service, transport, logText } = setup();
    await expect(service.log(input)).resolves.toBe(true);
    expect(logText).toHaveBeenCalledOnce();
    expect(transport.messages[0]?.text).toContain('250.00 ETB');
    expect(transport.messages[0]?.text).toContain('Food');
  });

  it('returns a localized extraction error and writes nothing', async () => {
    const { service, transport, logText } = setup({
      extractionError: new ExtractionError('currency_unsupported'),
    });
    await expect(service.log(input)).resolves.toBe(false);
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('ETB only');
  });

  it('never confirms when the database write fails', async () => {
    const { service, transport } = setup({ databaseError: new Error('database unavailable') });
    await expect(service.log(input)).rejects.toThrow('database unavailable');
    expect(transport.messages).toHaveLength(0);
  });

  it('requires confirmation and saves nothing when a receipt is first extracted', async () => {
    const { service, transport, logText, createInteraction } = setup();
    await expect(
      service.requestReceiptConfirmation(
        {
          telegramId: 100,
          chatId: 200,
          updateId: 301,
          messageId: 401,
          messageAt: new Date('2026-08-01T05:00:00.000Z'),
          extractionModel: 'gemini-test',
          promptVersion: 'receipt-v1',
        },
        {
          transactions: [
            {
              type: 'expense',
              amount: '1250',
              currency: 'ETB',
              category: 'food',
              note: 'Fresh Corner groceries',
              confidence: 0.95,
            },
          ],
        },
      ),
    ).resolves.toBe(false);
    expect(logText).not.toHaveBeenCalled();
    expect(createInteraction).toHaveBeenCalledWith(
      'user-id',
      'CONFIRM_RECEIPT',
      expect.objectContaining({ kind: 'confirm_receipt', source: 'receipt' }),
    );
    expect(transport.messages[0]?.text).toContain('Nothing is saved yet');
    expect(transport.messages[0]?.options?.inlineKeyboard).toBeDefined();
  });

  it('persists a receipt with receipt provenance only after confirmation', async () => {
    const { service, logText, findPending } = setup();
    findPending.mockResolvedValue({
      id: 'interaction-id',
      payload: {
        kind: 'confirm_receipt',
        sourceUpdateId: 301,
        sourceMessageId: 401,
        messageAt: '2026-08-01T05:00:00.000Z',
        model: 'gemini-test',
        promptVersion: 'receipt-v1',
        source: 'receipt',
        transactions: [
          {
            type: 'expense',
            amount: '1250.00',
            currency: 'ETB',
            category: 'food',
            confidence: 0.95,
          },
        ],
      },
    });
    await expect(
      service.handleCallback({
        telegramId: 100,
        chatId: 200,
        updateId: 302,
        interactionId: 'interaction-id',
        action: 'confirm',
      }),
    ).resolves.toBe(true);
    expect(logText).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'RECEIPT',
        sourceUpdateId: 301,
        processedUpdateId: 302,
        interactionId: 'interaction-id',
      }),
    );
  });
});
