import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { ExtractionError } from '../src/extraction/extraction.error.js';
import { TextNormalizerService } from '../src/extraction/text-normalizer.service.js';
import type { TransactionExtractor } from '../src/extraction/transaction-extractor.interface.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { InteractionRepository } from '../src/interactions/interaction.repository.js';
import type { InteractionPayloadInput } from '../src/interactions/interaction-payload.schema.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { TextLogRateLimiter } from '../src/rate-limit/text-log-rate-limiter.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import { ClarificationCandidateService } from '../src/transactions/clarification-candidate.service.js';
import { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type {
  LogTransactionInput,
  TransactionRepository,
} from '../src/transactions/transaction.repository.js';
import { TransactionValidationService } from '../src/transactions/transaction-validation.service.js';
import { FinancialEventValidationService } from '../src/transactions/financial-event-validation.service.js';
import type { UsersService } from '../src/users/users.service.js';

const interactionId = '123e4567-e89b-42d3-a456-426614174000';
const input = {
  telegramId: 100,
  chatId: 200,
  updateId: 300,
  messageId: 400,
  messageAt: new Date('2026-08-01T05:00:00.000Z'),
  text: 'I paid for lunch',
};

function setup(
  extractResult: unknown,
  options: {
    firstLog?: boolean;
    pending?: unknown;
    model?: string;
    promptVersion?: string;
  } = {},
) {
  const extractor = {
    model: options.model ?? 'rule-based-v1',
    promptVersion: options.promptVersion ?? 'phase4-v1',
    extract:
      extractResult instanceof Error
        ? vi.fn().mockRejectedValue(extractResult)
        : vi.fn().mockResolvedValue(extractResult),
  } as TransactionExtractor;
  const logText = vi
    .fn<(input: LogTransactionInput) => Promise<{ groupId: string; firstLog: boolean }>>()
    .mockResolvedValue({
      groupId: 'group-id',
      firstLog: Boolean(options.firstLog),
    });
  const repository = {
    logText,
    latestActiveGroup: vi.fn(),
    undo: vi.fn(),
  } as unknown as TransactionRepository;
  const create = vi
    .fn<
      (userId: string, kind: string, payload: InteractionPayloadInput) => Promise<{ id: string }>
    >()
    .mockResolvedValue({ id: interactionId });
  const findPending = vi.fn();
  const recordTransferRejected = vi.fn().mockResolvedValue(undefined);
  const interactions = {
    create,
    findPendingForUser: vi.fn().mockResolvedValue(options.pending ?? null),
    findPending,
    cancel: vi.fn(),
    failClarification: vi.fn(),
    recordInvalidOutput: vi.fn().mockResolvedValue(undefined),
    recordTransferRejected,
  } as unknown as InteractionRepository;
  const normalizer = new TextNormalizerService();
  const transport = new RecordingTelegramTransport();
  const service = new TextTransactionService(
    extractor,
    new TransactionValidationService(),
    new FinancialEventValidationService(),
    repository,
    interactions,
    new ClarificationCandidateService(normalizer),
    normalizer,
    { allowed: vi.fn().mockResolvedValue(true) } as unknown as TextLogRateLimiter,
    {
      findByTelegramId: vi.fn().mockResolvedValue({ id: 'user-id', language: 'EN' }),
    } as unknown as UsersService,
    new I18nService(),
    transport,
    { error: vi.fn() } as unknown as StructuredLogger,
    { get: vi.fn().mockReturnValue(2_000) } as unknown as ConfigService<Environment, true>,
  );
  return {
    service,
    transport,
    create,
    logText,
    interactions,
    findPending,
    extractor,
    recordTransferRejected,
  };
}

describe('Phase 4 TextTransactionService', () => {
  it('asks one missing-amount question without writing', async () => {
    const { service, transport, create, logText } = setup(new ExtractionError('amount_missing'));
    await expect(service.log(input)).resolves.toBe(false);
    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CLARIFY_AMOUNT',
      expect.objectContaining({ category: 'food', clarificationCount: 1 }),
    );
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('How much');
  });

  it('resolves one amount reply and writes only after resolution', async () => {
    const payload = {
      kind: 'clarify_amount' as const,
      sourceUpdateId: 300,
      sourceMessageId: 400,
      messageAt: input.messageAt.toISOString(),
      model: 'rule-based-v1',
      promptVersion: 'phase4-v1',
      type: 'expense' as const,
      category: 'food' as const,
      note: 'lunch',
      clarificationCount: 1 as const,
    };
    const { service, logText } = setup(new Error('extractor should not run'), {
      pending: { id: interactionId, payload },
    });
    await expect(
      service.log({ ...input, updateId: 301, messageId: 401, text: '250 birr' }),
    ).resolves.toBe(true);
    expect(logText).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionId,
        sourceMessageId: 400,
        processedUpdateId: 301,
        clarificationResolved: true,
      }),
    );
  });

  it('requires confirmation before a high-value write', async () => {
    const { service, transport, create, logText } = setup({
      transactions: [
        {
          type: 'expense',
          amount: '120000',
          currency: 'ETB',
          category: 'rent',
          confidence: 0.95,
        },
      ],
    });
    await expect(service.log({ ...input, text: 'I paid 120000 birr for rent' })).resolves.toBe(
      false,
    );
    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CONFIRM_LARGE_AMOUNT',
      expect.objectContaining({ kind: 'confirm_large_amount' }),
    );
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages[0]?.options?.inlineKeyboard).toBeDefined();
  });

  it('rejects the 1,000,000 ETB upper boundary with a user-facing message', async () => {
    const { service, extractor, transport, logText } = setup({ transactions: [] });
    const classify = vi.fn().mockResolvedValue({
      transactions: [
        {
          status: 'ready',
          kind: 'expense',
          direction: 'outflow',
          amount: '1000000',
          currency: 'ETB',
          category: 'housing_rent',
          confidence: 0.99,
          clarificationReason: null,
        },
      ],
    });
    extractor.classify = classify;

    await expect(service.log({ ...input, text: 'I paid 1000000 birr for rent' })).resolves.toBe(
      false,
    );
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages.at(-1)?.text).toContain('below 1,000,000 ETB');
  });

  it('confirms a group and sends first-log feedback exactly when flagged', async () => {
    const { service, transport, logText } = setup(
      {
        transactions: [
          { type: 'expense', amount: '200', currency: 'ETB', category: 'food', confidence: 0.95 },
          {
            type: 'expense',
            amount: '100',
            currency: 'ETB',
            category: 'transport',
            confidence: 0.95,
          },
        ],
      },
      { firstLog: true },
    );
    await expect(service.log({ ...input, text: 'lunch 200 and taxi 100' })).resolves.toBe(true);
    expect(logText.mock.calls[0]?.[0].transactions).toHaveLength(2);
    expect(transport.messages).toHaveLength(2);
    expect(transport.messages[1]?.text).toContain('first transaction');
  });
});

describe('Phase 5 financial clarification experience', () => {
  const ambiguous = {
    transactions: [
      {
        status: 'needs_clarification' as const,
        kind: 'unclear' as const,
        direction: 'unclear' as const,
        amount: '5000.00',
        currency: 'ETB' as const,
        category: null,
        note: 'from Hana',
        confidence: 0.7,
        clarificationReason: 'purpose' as const,
      },
    ],
  };

  it('asks one purpose question and stores nothing before the answer', async () => {
    const { service, extractor, transport, create, logText } = setup({ transactions: [] });
    extractor.classify = vi.fn().mockResolvedValue(ambiguous);

    await expect(service.log({ ...input, text: 'I received 5000 birr from Hana' })).resolves.toBe(
      false,
    );

    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CLARIFY_FINANCIAL',
      expect.objectContaining({ kind: 'clarify_financial', clarificationCount: 1 }),
    );
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('What was this money for');
    expect(transport.messages[0]?.options?.inlineKeyboard).toHaveLength(4);
  });

  it('resolves a loan answer, persists it, and explains its reporting effect', async () => {
    const payload = {
      kind: 'clarify_financial' as const,
      sourceUpdateId: 300,
      sourceMessageId: 400,
      messageAt: input.messageAt.toISOString(),
      model: 'gemini-test',
      promptVersion: 'classification-v1',
      source: 'text' as const,
      event: {
        amount: '5000.00',
        currency: 'ETB' as const,
        note: 'from Hana',
        confidence: 0.7,
        clarificationReason: 'purpose' as const,
      },
      readyTransactions: [],
      ignoredTransferCount: 0,
      clarificationCount: 1 as const,
    };
    const { service, transport, logText, findPending, create } = setup({ transactions: [] });
    findPending.mockResolvedValue({ id: interactionId, payload });

    await expect(
      service.handleCallback({
        telegramId: input.telegramId,
        chatId: input.chatId,
        updateId: 301,
        interactionId,
        action: 'loan_in',
      }),
    ).resolves.toBe(false);

    expect(logText).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CONFIRM_FINANCIAL',
      expect.objectContaining({
        kind: 'confirm_financial',
        transactions: [expect.objectContaining({ kind: 'loan_received' })],
      }),
    );
    const confirmationPayload = vi.mocked(create).mock.calls.at(-1)?.[2];
    findPending.mockResolvedValue({ id: interactionId, payload: confirmationPayload });
    await expect(
      service.handleCallback({
        telegramId: input.telegramId,
        chatId: input.chatId,
        updateId: 302,
        interactionId,
        action: 'confirm',
      }),
    ).resolves.toBe(true);

    expect(logText).toHaveBeenCalledWith(
      expect.objectContaining({
        clarificationResolved: true,
        transactions: [
          expect.objectContaining({ kind: 'loan_received', category: 'borrowed_money' }),
        ],
      }),
    );
    expect(transport.messages.at(-1)?.text).toContain('does not count as earned income');
  });

  it('does not let another user consume a clarification button', async () => {
    const { service, logText, transport, findPending } = setup({ transactions: [] });
    findPending.mockResolvedValue(null);

    await expect(
      service.handleCallback({
        telegramId: input.telegramId,
        chatId: input.chatId,
        updateId: 301,
        interactionId,
        action: 'loan_in',
      }),
    ).resolves.toBe(false);

    expect(findPending).toHaveBeenCalledWith(interactionId, 'user-id');
    expect(logText).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('expired or was already handled');
  });

  it('keeps valid events when the unclear event is confirmed as an internal transfer', async () => {
    const payload = {
      kind: 'clarify_financial' as const,
      sourceUpdateId: 300,
      sourceMessageId: 400,
      messageAt: input.messageAt.toISOString(),
      model: 'gemini-test',
      promptVersion: 'classification-v1',
      source: 'text' as const,
      event: {
        amount: '2000.00',
        currency: 'ETB' as const,
        confidence: 0.7,
        clarificationReason: 'ownership' as const,
      },
      readyTransactions: [
        {
          kind: 'expense' as const,
          direction: 'outflow' as const,
          type: 'expense' as const,
          amount: '50.00',
          currency: 'ETB' as const,
          category: 'fees' as const,
          note: 'transfer fee',
          confidence: 0.96,
        },
      ],
      ignoredTransferCount: 0,
      clarificationCount: 1 as const,
    };
    const { service, logText, findPending, create } = setup({ transactions: [] });
    findPending.mockResolvedValue({ id: interactionId, payload });

    await expect(
      service.handleCallback({
        telegramId: input.telegramId,
        chatId: input.chatId,
        updateId: 301,
        interactionId,
        action: 'own_transfer',
      }),
    ).resolves.toBe(false);

    expect(logText).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CONFIRM_FINANCIAL',
      expect.objectContaining({
        transactions: [expect.objectContaining({ kind: 'expense', category: 'fees' })],
      }),
    );
  });
});

describe('Hasab-to-Gemini voice transcript pipeline', () => {
  const voiceInput = {
    ...input,
    source: 'voice' as const,
    sttProvider: 'hasab',
    sttModel: 'hasab-transcription-v1',
  };

  it('passes one transcript through classification and preserves multiple transactions', async () => {
    const { service, extractor, logText } = setup(
      { transactions: [] },
      { model: 'gemini-2.5-flash', promptVersion: 'gemini-financial-v1' },
    );
    const classify = vi.fn().mockResolvedValue({
      transactions: [
        {
          status: 'ready',
          kind: 'expense',
          direction: 'outflow',
          amount: '250.00',
          currency: 'ETB',
          category: 'food_groceries',
          note: 'lunch',
          confidence: 0.98,
          clarificationReason: null,
        },
        {
          status: 'ready',
          kind: 'expense',
          direction: 'outflow',
          amount: '100.00',
          currency: 'ETB',
          category: 'transport_public',
          note: 'taxi',
          confidence: 0.97,
          clarificationReason: null,
        },
      ],
    });
    extractor.classify = classify;

    await expect(
      service.logVoiceTranscript({ ...voiceInput, text: 'lunch 250 and taxi 100' }),
    ).resolves.toBe(true);

    expect(classify).toHaveBeenCalledWith(
      {
        text: 'lunch 250 and taxi 100',
        locale: 'en',
      },
      'user-id',
    );
    expect(logText).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'VOICE',
        model: 'gemini-2.5-flash',
        promptVersion: 'gemini-financial-v1',
        sttProvider: 'hasab',
        sttModel: 'hasab-transcription-v1',
      }),
    );
    expect(logText.mock.calls[0]?.[0].transactions).toEqual([
      expect.objectContaining({ amount: '250.00', category: 'food_groceries' }),
      expect.objectContaining({ amount: '100.00', category: 'transport_public' }),
    ]);
  });

  it.each(['amount_missing', 'money_direction', 'ownership', 'purpose'] as const)(
    'asks one %s clarification and persists nothing',
    async (clarificationReason) => {
      const { service, extractor, create, logText } = setup({ transactions: [] });
      extractor.classify = vi.fn().mockResolvedValue({
        transactions: [
          {
            status: 'needs_clarification',
            kind: 'unclear',
            direction: 'unclear',
            amount: clarificationReason === 'amount_missing' ? null : '5000.00',
            currency: 'ETB',
            category: null,
            note: 'from Hana',
            confidence: 0.7,
            clarificationReason,
          },
        ],
      });

      await expect(service.logVoiceTranscript(voiceInput)).resolves.toBe(false);

      if (clarificationReason === 'amount_missing') {
        expect(create).not.toHaveBeenCalled();
      } else {
        expect(create).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(
          'user-id',
          'CLARIFY_FINANCIAL',
          expect.objectContaining({
            kind: 'clarify_financial',
            source: 'voice',
            sttProvider: 'hasab',
            sttModel: 'hasab-transcription-v1',
          }),
        );
      }
      expect(logText).not.toHaveBeenCalled();
    },
  );

  it('requires confirmation before persisting a high-value voice transaction', async () => {
    const { service, extractor, create, logText } = setup({ transactions: [] });
    extractor.classify = vi.fn().mockResolvedValue({
      transactions: [
        {
          status: 'ready',
          kind: 'expense',
          direction: 'outflow',
          amount: '120000.00',
          currency: 'ETB',
          category: 'housing_rent',
          note: 'rent',
          confidence: 0.99,
          clarificationReason: null,
        },
      ],
    });

    await expect(service.logVoiceTranscript(voiceInput)).resolves.toBe(false);
    expect(create).toHaveBeenCalledWith(
      'user-id',
      'CONFIRM_LARGE_AMOUNT',
      expect.objectContaining({
        kind: 'confirm_large_amount',
        source: 'voice',
        sttProvider: 'hasab',
      }),
    );
    expect(logText).not.toHaveBeenCalled();
  });

  it('does not persist an unsupported internal transfer from voice', async () => {
    const { service, extractor, logText, recordTransferRejected } = setup({ transactions: [] });
    extractor.classify = vi.fn().mockResolvedValue({
      transactions: [
        {
          status: 'unsupported',
          kind: 'transfer',
          direction: 'internal',
          amount: '2000.00',
          currency: 'ETB',
          category: null,
          note: 'between my accounts',
          confidence: 0.99,
          clarificationReason: null,
        },
      ],
    });

    await expect(service.logVoiceTranscript(voiceInput)).resolves.toBe(false);
    expect(recordTransferRejected).toHaveBeenCalledWith('user-id', 'voice', 1);
    expect(logText).not.toHaveBeenCalled();
  });

  it('persists nothing when Gemini transcript classification fails', async () => {
    const { service, extractor, logText } = setup({ transactions: [] });
    const classify = vi.fn().mockRejectedValue(new ExtractionError('invalid_output'));
    extractor.classify = classify;

    await expect(service.logVoiceTranscript(voiceInput)).resolves.toBe(false);

    expect(classify).toHaveBeenCalledOnce();
    expect(logText).not.toHaveBeenCalled();
  });
});
