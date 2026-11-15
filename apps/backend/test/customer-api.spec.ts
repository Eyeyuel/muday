import { describe, expect, it, vi } from 'vitest';

import type { CategoryRepository } from '../src/categories/category.repository.js';
import type { ConsentService } from '../src/consent/consent.service.js';
import { CustomerMediaController } from '../src/customer-api/customer-media.controller.js';
import { CustomerSummariesController } from '../src/customer-api/customer-summaries.controller.js';
import { CustomerTransactionsController } from '../src/customer-api/customer-transactions.controller.js';
import { MeController } from '../src/customer-api/me.controller.js';
import type { CustomerJwtPayload } from '../src/customer-auth/customer-session-types.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { TransactionExtractor } from '../src/extraction/transaction-extractor.interface.js';
import type { IdempotencyService } from '../src/idempotency/idempotency.service.js';
import type { SmsQueueService } from '../src/sms/sms-queue.service.js';
import type { SpeechToTextProvider } from '../src/stt/speech-to-text.interface.js';
import type { SummaryService } from '../src/summaries/summary.service.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { UsersService } from '../src/users/users.service.js';

describe('Customer API Controllers', () => {
  const customer: CustomerJwtPayload = {
    sub: 'user-uuid-1',
    sid: 'session-uuid-1',
    sessionId: 'session-uuid-1',
    identityId: 'identity-uuid-1',
    role: 'customer',
    iss: 'muday-api',
    aud: 'muday-customer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };

  describe('MeController', () => {
    it('returns customer profile', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        firstName: 'Abebe',
        lastName: 'Bikila',
        username: 'abebe',
        language: 'AM',
        status: 'ACTIVE',
        consentVersion: 'v1',
        consentAt: new Date('2026-08-01'),
        createdAt: new Date('2026-08-01'),
      };
      const mockPrisma = {
        user: { findUniqueOrThrow: vi.fn().mockResolvedValue(mockUser) },
      } as unknown as PrismaService;
      const mockUsersService = {} as UsersService;
      const mockConsentService = {} as ConsentService;

      const controller = new MeController(mockPrisma, mockUsersService, mockConsentService);
      const profile = await controller.getProfile(customer);

      expect(profile.id).toBe('user-uuid-1');
      expect(profile.firstName).toBe('Abebe');
      expect(profile.language).toBe('AM');
    });

    it('updates customer interface language preference', async () => {
      const changeLanguageByUserIdMock = vi.fn().mockResolvedValue(undefined);
      const mockPrisma = {} as PrismaService;
      const mockUsersService = {
        changeLanguageByUserId: changeLanguageByUserIdMock,
      } as unknown as UsersService;
      const mockConsentService = {} as ConsentService;

      const controller = new MeController(mockPrisma, mockUsersService, mockConsentService);
      const result = await controller.updateLanguage(customer, { language: 'en' });

      expect(result.success).toBe(true);
      expect(changeLanguageByUserIdMock).toHaveBeenCalledWith('user-uuid-1', 'en');
    });
  });

  describe('CustomerSummariesController', () => {
    it('returns daily totals and transaction count', async () => {
      const mockSummaryService = {
        get: vi.fn().mockResolvedValue({
          incomeCents: 50000n,
          expenseCents: 20000n,
          netCents: 30000n,
          transactionCount: 4,
          period: 'today',
        }),
      } as unknown as SummaryService;

      const controller = new CustomerSummariesController(mockSummaryService);
      const summary = await controller.getTodaySummary(customer);

      expect(summary.period).toBe('today');
      expect(summary.totalIncomeCents).toBe(50000);
      expect(summary.totalExpenseCents).toBe(20000);
      expect(summary.netBalanceCents).toBe(30000);
      expect(summary.transactionCount).toBe(4);
    });
  });

  describe('CustomerTransactionsController', () => {
    it('logs text transaction note', async () => {
      const logTextForUserMock = vi.fn().mockResolvedValue({
        success: true,
        groupId: 'group-uuid-1',
        message: 'Logged 250 ETB for lunch',
      });
      const mockTextService = {
        logTextForUser: logTextForUserMock,
      } as unknown as TextTransactionService;
      const mockPrisma = {} as PrismaService;
      const mockIdempotencyService = {
        execute: vi.fn().mockImplementation(({ fn }: { fn: () => Promise<unknown> }) => fn()),
      } as unknown as IdempotencyService;

      const controller = new CustomerTransactionsController(
        mockPrisma,
        mockTextService,
        mockIdempotencyService,
        {} as CategoryRepository,
        {} as unknown as SmsQueueService,
      );
      const result = await controller.logText(customer, { text: 'I spent 250 birr on lunch' });

      expect(result.status).toBe('persisted');
      expect(result.groupId).toBe('group-uuid-1');
      expect(logTextForUserMock).toHaveBeenCalled();
    });

    it('returns platform in bank-sms and transaction history', async () => {
      const mockPrisma = {
        transaction: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'tx-1',
              type: 'EXPENSE',
              amountEtb: '300.00',
              category: 'food',
              platform: 'telebirr',
              note: 'lunch',
              occurredAt: new Date('2026-08-01T10:00:00Z'),
              createdAt: new Date('2026-08-01T10:00:00Z'),
              group: { rawTranscript: 'SMS:TELEBIRR:123' },
            },
          ]),
        },
        pendingInteraction: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'pending-1',
              payload: {
                amount: 500,
                type: 'expense',
                platform: 'cbe',
                bankSource: 'CBE',
                note: 'grocery',
              },
              createdAt: new Date('2026-08-02T10:00:00Z'),
            },
          ]),
        },
      } as unknown as PrismaService;

      const controller = new CustomerTransactionsController(
        mockPrisma,
        {} as TextTransactionService,
        {} as IdempotencyService,
        {} as CategoryRepository,
        {} as unknown as SmsQueueService,
      );

      const bankSms = await controller.getBankSmsHistory(customer);
      expect(bankSms).toHaveLength(1);
      expect(bankSms[0]?.platform).toBe('telebirr');

      const history = await controller.getHistory(customer);
      expect(history).toHaveLength(2);
      expect(history[0]?.platform).toBe('cbe');
      expect(history[1]?.platform).toBe('telebirr');
    });

    it('updates transaction platform via PATCH /api/v1/transactions/:id', async () => {
      const updateMock = vi.fn().mockResolvedValue({});
      const mockPrisma = {
        transaction: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'tx-1',
            userId: 'user-uuid-1',
            type: 'EXPENSE',
            category: 'food',
            platform: 'telebirr',
          }),
          update: updateMock,
        },
        $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          return fn(mockPrisma);
        }),
      } as unknown as PrismaService;

      const controller = new CustomerTransactionsController(
        mockPrisma,
        {} as TextTransactionService,
        {} as IdempotencyService,
        { upsertAndIncrement: vi.fn().mockResolvedValue({}) } as unknown as CategoryRepository,
        {} as unknown as SmsQueueService,
      );

      const result = await controller.updateTransaction(customer, 'tx-1', {
        platform: 'cbe_birr',
      });
      expect(result.success).toBe(true);
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { platform: 'cbe_birr' },
      });
    });
  });

  describe('CustomerMediaController', () => {
    it('preserves receipt merchant/item description and platform in formatted text when logging transaction', async () => {
      const logTextForUserMock = vi.fn().mockResolvedValue({
        success: true,
        groupId: 'receipt-group-1',
        message:
          'Logged 340 ETB for food_groceries using telebirr (Shoa Supermarket - Milk, Bread)',
      });
      const mockTextService = {
        logTextForUser: logTextForUserMock,
      } as unknown as TextTransactionService;
      const mockPrisma = {} as PrismaService;
      const mockStt = {} as SpeechToTextProvider;
      const mockExtractor: TransactionExtractor = {
        model: 'gemini-test',
        promptVersion: 'v1',
        extract: vi.fn(),
        extractImage: vi.fn().mockResolvedValue({
          transactions: [
            {
              type: 'expense',
              amount: '340.00',
              currency: 'ETB',
              category: 'food_groceries',
              platform: 'telebirr',
              note: 'Shoa Supermarket - Milk, Bread',
              confidence: 0.98,
            },
          ],
        }),
      };

      const controller = new CustomerMediaController(
        mockPrisma,
        mockStt,
        mockExtractor,
        mockTextService,
        {} as any,
      );

      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const result = await controller.uploadReceipt(customer, {
        fieldname: 'file',
        originalname: 'receipt.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: jpegBuffer.length,
        buffer: jpegBuffer,
      });

      expect(result.status).toBe('saved');
      expect(logTextForUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '340.00 ETB for food_groceries using telebirr (Shoa Supermarket - Milk, Bread)',
          source: 'receipt',
        }),
      );
    });
  });
});
