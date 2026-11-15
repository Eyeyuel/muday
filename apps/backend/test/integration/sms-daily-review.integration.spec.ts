import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoryRepository } from '../../src/categories/category.repository.js';
import type { Environment } from '../../src/config/environment.js';
import { CustomerTransactionsController } from '../../src/customer-api/customer-transactions.controller.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import {
  PrismaClient,
  InteractionKind,
  InteractionState,
  type User,
} from '../../src/generated/prisma/client.js';
import { IdempotencyService } from '../../src/idempotency/idempotency.service.js';
import { SmsReviewNotificationService } from '../../src/notifications/sms-review-notification.service.js';
import { TelegramUpdateRouterService } from '../../src/telegram/telegram-update-router.service.js';
import type {
  TelegramSendOptions,
  TelegramTransport,
} from '../../src/telegram/transport/telegram-transport.interface.js';
import type { TelegramUpdate } from '../../src/telegram/telegram.types.js';
import { UsersService } from '../../src/users/users.service.js';
import { UserRepository } from '../../src/users/user.repository.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { I18nService } from '../../src/i18n/i18n.service.js';
import { ConsentService } from '../../src/consent/consent.service.js';
import { ConsentRepository } from '../../src/consent/consent.repository.js';
import { ConsentGuard } from '../../src/consent/consent.guard.js';
import type { SmsBatchMessageItem } from '../../src/sms/sms-job.js';
import { SmsProcessingService } from '../../src/sms/sms-processing.service.js';
import type { SmsQueueService } from '../../src/sms/sms-queue.service.js';
import type { TextTransactionService } from '../../src/transactions/text-transaction.service.js';
import type { CustomerJwtPayload } from '../../src/customer-auth/customer-session-types.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const prismaService = prisma as unknown as PrismaService;

const config = {
  get: vi.fn((key: string) => {
    if (key === 'CONSENT_VERSION') return 'v1';
    if (key === 'FLUTTER_DEEP_LINK_BASE') return 'https://app.muday.et';
    return undefined;
  }),
} as unknown as ConfigService<Environment, true>;

const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() } as unknown as StructuredLogger;
const userRepo = new UserRepository(prismaService);
const identityRepo = new IdentityRepository(prismaService);
const identityResolver = new TelegramIdentityResolver(identityRepo, logger);
const usersService = new UsersService(userRepo, identityResolver);
const consentRepo = new ConsentRepository(prismaService);
const consentService = new ConsentService(consentRepo, config);
const consentGuard = new ConsentGuard(usersService, consentService);
const categoryRepo = new CategoryRepository(prismaService);

describe('8:00 PM Daily SMS Review and Categorization Flow (Integration)', () => {
  let testTelegramId: bigint;
  let testUser: User;
  let sentMessages: Array<{
    chatId: number;
    text: string;
    options?: TelegramSendOptions | undefined;
  }>;
  let transport: TelegramTransport;
  let smsReviewService: SmsReviewNotificationService;
  let controller: CustomerTransactionsController;
  let router: TelegramUpdateRouterService;

  beforeEach(async () => {
    testTelegramId = BigInt(Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 100000));
    sentMessages = [];
    transport = {
      sendMessage: vi.fn(
        (chatId: number, text: string, options?: TelegramSendOptions): Promise<void> => {
          sentMessages.push({ chatId, text, options });
          return Promise.resolve();
        },
      ),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    } as unknown as TelegramTransport;

    smsReviewService = new SmsReviewNotificationService(prismaService, categoryRepo, transport);

    const smsProcessingService = new SmsProcessingService(prismaService, logger);
    const mockSmsQueueService = {
      enqueueBatch: vi.fn(async (userId: string, messages: SmsBatchMessageItem[]) => {
        const res = await smsProcessingService.processBatch({
          userId,
          messages,
          enqueuedAt: new Date().toISOString(),
        });
        return {
          success: true,
          count: res.processed,
          saved: res.saved,
          drafts: res.drafts,
          duplicates: res.duplicates,
        };
      }),
    } as unknown as SmsQueueService;

    controller = new CustomerTransactionsController(
      prismaService,
      {} as unknown as TextTransactionService,
      new IdempotencyService(prismaService),
      categoryRepo,
      mockSmsQueueService,
    );

    router = new TelegramUpdateRouterService(
      transport,
      new I18nService(),
      usersService,
      consentService,
      consentGuard,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config,
      prismaService,
      categoryRepo,
      smsReviewService,
    );

    // Create a real active consented test user
    testUser = await prisma.user.create({
      data: {
        telegramId: testTelegramId,
        language: 'EN',
        status: 'ACTIVE',
        consentVersion: 'v1',
        consentAt: new Date(),
        userCategories: {
          create: [
            { label: 'groceries', type: 'expense', usedCount: 5 },
            { label: 'restaurants', type: 'expense', usedCount: 3 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs complete bulk sync -> 8 PM review -> one-by-one bot categorization -> completion', async () => {
    const customer: CustomerJwtPayload = {
      sub: testUser.id,
      sid: 'test-session-id',
      role: 'customer',
      iss: 'muday-api',
      aud: 'muday-customer',
      iat: 1_700_000_000,
      exp: 1_700_001_000,
    };

    // 1. Mobile app syncs 3 SMS: 1 already categorized, 2 uncategorized
    const syncRes = await controller.saveBankSms(customer, {
      messages: [
        {
          amount: 600,
          category: 'groceries', // Categorized directly
          bankSource: 'CBE',
          smsId: `cbe-direct-${Date.now()}`,
        },
        {
          amount: 250,
          category: 'uncategorized', // Draft 1
          bankSource: 'Telebirr',
          smsId: `telebirr-draft-${Date.now()}`,
        },
        {
          amount: 150, // Draft 2 (omitted category)
          bankSource: 'Awash',
          smsId: `awash-draft-${Date.now()}`,
        },
      ],
    });

    expect(syncRes.saved).toBe(1);
    expect(syncRes.drafts).toBe(2);

    // Verify 1 real transaction exists in DB
    const initialTxs = await prisma.transaction.findMany({ where: { userId: testUser.id } });
    expect(initialTxs).toHaveLength(1);
    expect(initialTxs[0]?.category).toBe('groceries');

    // Verify 2 drafts exist in PendingInteraction table
    const pendingDrafts = await prisma.pendingInteraction.findMany({
      where: {
        userId: testUser.id,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(pendingDrafts).toHaveLength(2);

    // 2. 8:00 PM Daily Review triggers
    await smsReviewService.sendNextPromptOrSummary(testUser.id, Number(testTelegramId), 'en');
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.text).toContain('Telebirr Bank SMS (1 of 2)');
    expect(sentMessages[0]?.text).toContain('250.00 ETB (Expense)');

    // Verify keyboard has user's top categories
    const keyboard = sentMessages[0]?.options?.inlineKeyboard;
    expect(keyboard).toBeDefined();
    const flatButtons = keyboard?.flat() ?? [];
    expect(
      flatButtons.some(
        (b) =>
          'callbackData' in b && b.callbackData === `sms_cat:${pendingDrafts[0]!.id}:groceries`,
      ),
    ).toBe(true);
    expect(
      flatButtons.some(
        (b) =>
          'callbackData' in b && b.callbackData === `sms_cat:${pendingDrafts[0]!.id}:restaurants`,
      ),
    ).toBe(true);

    // 3. User taps [ groceries ] for Draft 1 in Telegram
    sentMessages = [];
    const cb1 = {
      update_id: 101,
      callback_query: {
        id: 'cb-101',
        chat_instance: 'instance-1',
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test' },
        data: `sms_cat:${pendingDrafts[0]!.id}:groceries`,
        message: {
          message_id: 501,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(testTelegramId), type: 'private', first_name: 'Test' },
        },
      },
    } as unknown as TelegramUpdate;

    await router.route(cb1);

    // Draft 1 is resolved, confirmation is sent, and Draft 2 is prompted!
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0]?.text).toContain('250.00 ETB saved under "Groceries"');
    expect(sentMessages[1]?.text).toContain('Awash Bank SMS (1 of 1)');
    expect(sentMessages[1]?.text).toContain('150.00 ETB (Expense)');

    // 4. User taps [ restaurants ] for Draft 2 in Telegram
    sentMessages = [];
    const cb2 = {
      update_id: 102,
      callback_query: {
        id: 'cb-102',
        chat_instance: 'instance-2',
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test' },
        data: `sms_cat:${pendingDrafts[1]!.id}:restaurants`,
        message: {
          message_id: 502,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(testTelegramId), type: 'private', first_name: 'Test' },
        },
      },
    } as unknown as TelegramUpdate;

    await router.route(cb2);

    // Draft 2 is resolved and completion message is sent
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0]?.text).toContain('150.00 ETB saved under "Restaurants"');
    expect(sentMessages[1]?.text).toContain('All caught up!');

    // 5. Verify final DB state: 3 total transactions, 0 pending drafts
    const finalTxs = await prisma.transaction.findMany({ where: { userId: testUser.id } });
    expect(finalTxs).toHaveLength(3);

    const remainingDrafts = await prisma.pendingInteraction.findMany({
      where: { userId: testUser.id, state: InteractionState.PENDING },
    });
    expect(remainingDrafts).toHaveLength(0);
  });

  it('handles race condition gracefully when categorized on mobile app first', async () => {
    const customer: CustomerJwtPayload = {
      sub: testUser.id,
      sid: 'test-session-id',
      role: 'customer',
      iss: 'muday-api',
      aud: 'muday-customer',
      iat: 1_700_000_000,
      exp: 1_700_001_000,
    };

    // 1. Sync 1 uncategorized SMS
    await controller.saveBankSms(customer, {
      messages: [{ amount: 300, bankSource: 'CBE', smsId: `cbe-race-${Date.now()}` }],
    });

    const [draft] = await prisma.pendingInteraction.findMany({
      where: { userId: testUser.id, state: InteractionState.PENDING },
    });
    expect(draft).toBeDefined();

    // 2. User resolves it on mobile app first
    await controller.categorizeDraft(customer, draft!.id, { category: 'food' });

    // 3. User subsequently taps button in Telegram
    sentMessages = [];
    const cb = {
      update_id: 103,
      callback_query: {
        id: 'cb-103',
        chat_instance: 'instance-3',
        from: { id: Number(testTelegramId), is_bot: false, first_name: 'Test' },
        data: `sms_cat:${draft!.id}:shopping`,
        message: {
          message_id: 503,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(testTelegramId), type: 'private', first_name: 'Test' },
        },
      },
    } as unknown as TelegramUpdate;

    await router.route(cb);

    // Expect graceful response without duplicate transaction
    expect(sentMessages[0]?.text).toContain('already categorized on the mobile app');

    // Only 1 transaction in DB
    const txs = await prisma.transaction.findMany({ where: { userId: testUser.id } });
    expect(txs).toHaveLength(1);
    expect(txs[0]?.category).toBe('food');
  });
});
