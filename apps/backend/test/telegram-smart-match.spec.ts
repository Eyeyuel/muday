import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { DashboardRepository } from '../src/dashboard/dashboard.repository.js';
import type { TelegramTransport } from '../src/telegram/transport/telegram-transport.interface.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { InteractionRepository } from '../src/interactions/interaction.repository.js';
import type { TransactionRepository } from '../src/transactions/transaction.repository.js';
import type { UsersService } from '../src/users/users.service.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import type { TransactionExtractor } from '../src/extraction/transaction-extractor.interface.js';
import type { TransactionValidationService } from '../src/transactions/transaction-validation.service.js';
import type { FinancialEventValidationService } from '../src/transactions/financial-event-validation.service.js';
import type { TextLogRateLimiter } from '../src/rate-limit/text-log-rate-limiter.service.js';
import type { Environment } from '../src/config/environment.js';

describe('Telegram Bot Smart Match & Candidate Linkage', () => {
  let service: TextTransactionService;
  const findMatchCandidates = vi.fn();
  const linkCandidate = vi.fn();
  const sendMessage = vi.fn().mockResolvedValue(1001);
  const findPending = vi.fn().mockResolvedValue(null);
  const findPendingForUser = vi.fn().mockResolvedValue(null);
  const createInteraction = vi.fn();
  const resolveInteraction = vi.fn().mockResolvedValue(undefined);
  const cancelInteraction = vi.fn().mockResolvedValue(undefined);
  const logText = vi.fn().mockResolvedValue({ groupId: 'group-uuid-1', firstLog: false });

  const mockUsers = {
    findByTelegramId: vi.fn().mockResolvedValue({
      id: 'user-uuid-1',
      telegramId: 123456789,
      preferredLanguage: 'en',
      status: 'ACTIVE',
    }),
    getLocale: vi.fn().mockResolvedValue('en'),
  } as unknown as UsersService;

  const mockI18n = new I18nService();

  const mockExtractor = {
    model: 'test-model',
    promptVersion: '1.0',
    extract: vi.fn(),
    classify: vi.fn().mockResolvedValue({
      events: [
        {
          kind: 'expense',
          direction: 'outflow',
          type: 'expense',
          amount: '350.00',
          currency: 'ETB',
          category: 'food_dining',
          note: 'Lunch with team',
          confidence: 0.95,
        },
      ],
      transfers: [],
      unclearEvents: [],
    }),
  } as unknown as TransactionExtractor;

  const mockValidator = {
    validate: vi.fn(),
  } as unknown as TransactionValidationService;

  const mockFinancialValidator = {
    validate: vi.fn().mockReturnValue({
      ready: [
        {
          kind: 'expense',
          direction: 'outflow',
          type: 'expense',
          amount: '350.00',
          currency: 'ETB',
          category: 'food_dining',
          note: 'Lunch with team',
          confidence: 0.95,
        },
      ],
      needsClarification: false,
      transfers: 0,
    }),
  } as unknown as FinancialEventValidationService;

  const mockConfig = {
    get: vi.fn().mockReturnValue(2000),
  } as unknown as ConfigService<Environment, true>;

  const mockRateLimiter = {
    allowed: vi.fn().mockResolvedValue(true),
  } as unknown as TextLogRateLimiter;

  const mockTransport = {
    sendMessage,
  } as unknown as TelegramTransport;

  const mockDashboardRepo = {
    findMatchCandidates,
    linkCandidate,
  } as unknown as DashboardRepository;

  const mockInteractions = {
    findPending,
    findPendingForUser,
    create: createInteraction,
    resolve: resolveInteraction,
    cancel: cancelInteraction,
    recordInvalidOutput: vi.fn(),
  } as unknown as InteractionRepository;

  const mockTransactions = {
    logText,
  } as unknown as TransactionRepository;

  const mockLogger = {
    log: vi.fn(),
    warn: vi.fn(),
  } as unknown as StructuredLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    findPending.mockResolvedValue(null);
    findPendingForUser.mockResolvedValue(null);
    createInteraction.mockResolvedValue({
      id: 'interaction-uuid-1',
      kind: 'CONFIRM_FINANCIAL',
      payload: {},
    });
    sendMessage.mockResolvedValue(1001);
    logText.mockResolvedValue({ groupId: 'group-uuid-1', firstLog: false });

    service = new TextTransactionService(
      mockExtractor,
      mockValidator,
      mockFinancialValidator,
      mockTransactions,
      mockInteractions,
      {} as never,
      {} as never,
      mockRateLimiter,
      mockUsers,
      mockI18n,
      mockTransport,
      mockLogger,
      mockConfig,
      mockDashboardRepo,
    );
  });

  it('triggers Smart Match prompt with 1 candidate when an unreviewed SMS draft matches amount', async () => {
    findMatchCandidates.mockResolvedValue([
      {
        id: 'draft-uuid-01',
        targetType: 'pending_interaction',
        amountEtb: '350.00',
        type: 'expense',
        category: 'uncategorized',
        note: null,
        bankSource: 'Telebirr',
        occurredAt: '2026-08-31T10:15:00.000Z',
      },
    ]);

    const result = await service.log({
      telegramId: 123456789,
      chatId: 987654321,
      updateId: 101,
      messageId: 202,
      messageAt: new Date(),
      text: 'Lunch with team 350',
    });

    expect(result).toBe(false);
    expect(findMatchCandidates).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({
        amountEtb: '350.00',
        type: 'expense',
      }),
    );

    expect(createInteraction).toHaveBeenCalledWith(
      'user-uuid-1',
      'CONFIRM_FINANCIAL',
      expect.objectContaining({
        kind: 'confirm_smart_match',
      }),
    );

    expect(sendMessage).toHaveBeenCalledWith(
      987654321,
      expect.stringContaining('Telebirr'),
      expect.objectContaining({
        inlineKeyboard: [
          [
            expect.objectContaining({
              callbackData: 'match:link:0:interaction-uuid-1',
            }),
          ],
          [
            expect.objectContaining({
              callbackData: 'match:skip:interaction-uuid-1',
            }),
          ],
        ],
      }),
    );
  });

  it('triggers multi-candidate prompt when multiple matching bank payments exist', async () => {
    findMatchCandidates.mockResolvedValue([
      {
        id: 'draft-uuid-01',
        targetType: 'pending_interaction',
        amountEtb: '350.00',
        type: 'expense',
        category: 'uncategorized',
        note: null,
        bankSource: 'Telebirr',
        occurredAt: '2026-08-31T10:15:00.000Z',
      },
      {
        id: 'tx-uuid-02',
        targetType: 'transaction',
        amountEtb: '350.00',
        type: 'expense',
        category: 'uncategorized',
        note: 'ATM transfer',
        bankSource: 'CBE',
        occurredAt: '2026-08-31T14:30:00.000Z',
      },
    ]);

    const result = await service.log({
      telegramId: 123456789,
      chatId: 987654321,
      updateId: 101,
      messageId: 202,
      messageAt: new Date(),
      text: 'Lunch 350',
    });

    expect(result).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      987654321,
      expect.stringContaining('2'),
      expect.objectContaining({
        inlineKeyboard: [
          [
            expect.objectContaining({
              callbackData: 'match:link:0:interaction-uuid-1',
            }),
          ],
          [
            expect.objectContaining({
              callbackData: 'match:link:1:interaction-uuid-1',
            }),
          ],
          [
            expect.objectContaining({
              callbackData: 'match:skip:interaction-uuid-1',
            }),
          ],
        ],
      }),
    );
  });

  it('saves directly without Smart Match prompt when no match candidates are found', async () => {
    findMatchCandidates.mockResolvedValue([]);

    const result = await service.log({
      telegramId: 123456789,
      chatId: 987654321,
      updateId: 101,
      messageId: 202,
      messageAt: new Date(),
      text: 'Lunch 350',
    });

    expect(result).toBe(true);
    expect(logText).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(987654321, expect.any(String));
  });

  it('commits cash transaction when user chooses to Keep Separate (persistConfirmedSmartMatch)', async () => {
    findPending.mockResolvedValue({
      id: 'interaction-uuid-1',
      userId: 'user-uuid-1',
      state: 'PENDING',
      payload: {
        kind: 'confirm_smart_match',
        sourceUpdateId: 101,
        sourceMessageId: 202,
        messageAt: '2026-08-31T10:00:00.000Z',
        source: 'text',
        transactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '350.00',
            currency: 'ETB',
            category: 'food_dining',
            note: 'Lunch with team',
            confidence: 0.95,
          },
        ],
        candidates: [],
      },
    });

    const saved = await service.persistConfirmedSmartMatch(
      123456789,
      987654321,
      102,
      'interaction-uuid-1',
    );

    expect(saved).toBe(true);
    expect(cancelInteraction).toHaveBeenCalledWith('interaction-uuid-1', 'user-uuid-1');
    expect(logText).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-uuid-1',
        clarificationResolved: true,
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith(987654321, expect.any(String));
  });
});
