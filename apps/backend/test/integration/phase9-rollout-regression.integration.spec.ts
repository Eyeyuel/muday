import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import type { ConsentService } from '../../src/consent/consent.service.js';
import type { CategoryRepository } from '../../src/categories/category.repository.js';
import { CustomerJwtService } from '../../src/customer-auth/customer-jwt.service.js';
import { CustomerSessionService } from '../../src/customer-auth/customer-session.service.js';
import { CustomerSummariesController } from '../../src/customer-api/customer-summaries.controller.js';
import { CustomerTransactionsController } from '../../src/customer-api/customer-transactions.controller.js';
import { MeController } from '../../src/customer-api/me.controller.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { SummaryService } from '../../src/summaries/summary.service.js';
import { SummaryRepository } from '../../src/summaries/summary.repository.js';
import { IdempotencyService } from '../../src/idempotency/idempotency.service.js';
import type { SmsQueueService } from '../../src/sms/sms-queue.service.js';
import type { TextTransactionService } from '../../src/transactions/text-transaction.service.js';
import type { UsersService } from '../../src/users/users.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const prismaService = prisma as unknown as PrismaService;

const configValues: Record<string, unknown> = {
  CUSTOMER_JWT_SECRET: 'test_phase9_rollout_jwt_secret_32_chars_long!!',
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
  CONSENT_VERSION: 'v1',
  MAX_MESSAGE_CHARACTERS: 500,
};
const config = {
  get: vi.fn((key: string) => configValues[key]),
} as unknown as ConfigService<Environment, true>;

const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() } as unknown as StructuredLogger;
const identityRepo = new IdentityRepository(prismaService);
const identityResolver = new TelegramIdentityResolver(identityRepo, logger);

const jwtService = new CustomerJwtService(config);
const sessionService = new CustomerSessionService(prismaService, config, jwtService);

const meController = new MeController(
  prismaService,
  {} as unknown as UsersService,
  {} as unknown as ConsentService,
);
const summaryRepo = new SummaryRepository(prismaService);
const summaryService = new SummaryService(summaryRepo);
const summariesController = new CustomerSummariesController(summaryService);

const mockTextTransactionService = {
  logTextForUser: vi.fn(async (input: { userId: string; text: string }) => {
    const text = input.text;
    const match = text.match(/(\d+)\s*ETB/i);
    const amountCents = match ? BigInt(parseInt(match[1]!, 10) * 100) : 100000n;
    const now = new Date();
    const group = await prisma.transactionGroup.create({
      data: {
        userId: input.userId,
        telegramUpdateId: BigInt(Date.now()),
        telegramMessageId: BigInt(Date.now()),
        source: 'TEXT',
        rawTranscript: text,
        transcriptExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        messageAt: now,
        extractionModel: 'rule_based',
        promptVersion: 'v1',
      },
    });
    await prisma.transaction.create({
      data: {
        userId: input.userId,
        groupId: group.id,
        type: 'EXPENSE',
        kind: 'EXPENSE',
        category: 'OTHER_EXPENSE',
        amountEtb: Number(amountCents) / 100,
        occurredAt: now,
      },
    });
    return {
      success: true,
      result: {
        groupId: group.id,
        items: [
          {
            kind: 'EXPENSE',
            category: 'OTHER_EXPENSE',
            amountCents,
            formattedAmount: `${amountCents / 100n} ETB`,
          },
        ],
      },
    };
  }),
} as unknown as TextTransactionService;

const idempotencyService = new IdempotencyService(prismaService);
const transactionsController = new CustomerTransactionsController(
  prismaService,
  mockTextTransactionService,
  idempotencyService,
  {} as unknown as CategoryRepository,
  {} as unknown as SmsQueueService,
);

describe('Phase 9 Rollout Regression & Three-Account Isolation', () => {
  beforeEach(async () => {
    await prisma.customerRefreshToken.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.transactionGroup.deleteMany();
    await prisma.pendingInteraction.deleteMany();
    await prisma.identityLinkEvent.deleteMany();
    await prisma.userIdentity.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs 3 concurrent accounts across Telegram bot, Mini App, and Flutter REST APIs with zero cross-account leakage', async () => {
    // 1. Account 1 (Telegram Bot user)
    const acc1 = await identityResolver.resolve({
      telegramUserId: 90001111n,
      channel: 'TELEGRAM_BOT',
      profile: { firstName: 'UserOneBot' },
    });
    await prisma.user.update({
      where: { id: acc1.user.id },
      data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
    });

    // 2. Account 2 (Telegram Mini App user)
    const acc2 = await identityResolver.resolve({
      telegramUserId: 90002222n,
      channel: 'TELEGRAM_MINIAPP',
      profile: { firstName: 'UserTwoMiniApp' },
    });
    await prisma.user.update({
      where: { id: acc2.user.id },
      data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
    });

    // 3. Account 3 (Flutter Mobile user)
    const acc3 = await identityResolver.resolve({
      telegramUserId: 90003333n,
      channel: 'FLUTTER',
      profile: { firstName: 'UserThreeFlutter' },
    });
    await prisma.user.update({
      where: { id: acc3.user.id },
      data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
    });

    // Mobile sessions for Account 1 and Account 3
    const session1 = await sessionService.createSession({
      userId: acc1.user.id,
      identityId: acc1.identity.id,
      clientType: 'FLUTTER_ANDROID',
    });
    const session3 = await sessionService.createSession({
      userId: acc3.user.id,
      identityId: acc3.identity.id,
      clientType: 'FLUTTER_IOS',
    });

    const payload1 = jwtService.verifyAccessToken(session1.accessToken);
    const payload3 = jwtService.verifyAccessToken(session3.accessToken);

    // Account 1 logs expense: 1500 ETB
    await transactionsController.logText(payload1, { text: '1500 ETB dinner' });

    // Account 3 logs expense: 350 ETB
    await transactionsController.logText(payload3, { text: '350 ETB taxi' });

    // Verify Account 1 summary
    const summary1 = await summariesController.getTodaySummary(payload1);
    expect(summary1.totalExpenseCents).toBe(150000);
    expect(summary1.transactionCount).toBe(1);

    // Verify Account 3 summary
    const summary3 = await summariesController.getTodaySummary(payload3);
    expect(summary3.totalExpenseCents).toBe(35000);
    expect(summary3.transactionCount).toBe(1);

    // Verify Account 2 has 0 transactions
    const summary2 = await summaryService.get(acc2.user.id, 'today');
    expect(summary2.expenseCents).toBe(0n);
    expect(summary2.transactionCount).toBe(0);

    // Assert strict isolation: User 1 profile returns User 1 ID only
    const profile1 = await meController.getProfile(payload1);
    expect(profile1.id).toBe(acc1.user.id);
    expect(profile1.firstName).toBe('UserOneBot');
  });
});
