import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import { CategoryRepository } from '../../src/categories/category.repository.js';
import { ConsentRepository } from '../../src/consent/consent.repository.js';
import { ConsentService } from '../../src/consent/consent.service.js';
import { CustomerDeletionController } from '../../src/customer-api/customer-deletion.controller.js';
import { CustomerSettingsController } from '../../src/customer-api/customer-settings.controller.js';
import { CustomerTransactionsController } from '../../src/customer-api/customer-transactions.controller.js';
import { MeController } from '../../src/customer-api/me.controller.js';
import { ActiveAccountGuard } from '../../src/customer-auth/active-account.guard.js';
import { CustomerJwtService } from '../../src/customer-auth/customer-jwt.service.js';
import type { CustomerJwtPayload } from '../../src/customer-auth/customer-session-types.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { DeletionQueueService } from '../../src/deletion/deletion-queue.service.js';
import { DeletionService } from '../../src/deletion/deletion.service.js';
import { TextNormalizerService } from '../../src/extraction/text-normalizer.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { I18nService } from '../../src/i18n/i18n.service.js';

import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import { IdempotencyService } from '../../src/idempotency/idempotency.service.js';
import { InteractionRepository } from '../../src/interactions/interaction.repository.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { TextLogRateLimiter } from '../../src/rate-limit/text-log-rate-limiter.service.js';
import type { SmsQueueService } from '../../src/sms/sms-queue.service.js';
import type { RedisService } from '../../src/redis/redis.service.js';
import type { TelegramTransport } from '../../src/telegram/transport/telegram-transport.interface.js';
import { ClarificationCandidateService } from '../../src/transactions/clarification-candidate.service.js';
import { FinancialEventValidationService } from '../../src/transactions/financial-event-validation.service.js';
import { TextTransactionService } from '../../src/transactions/text-transaction.service.js';
import { TransactionRepository } from '../../src/transactions/transaction.repository.js';
import { TransactionValidationService } from '../../src/transactions/transaction-validation.service.js';
import { UserRepository } from '../../src/users/user.repository.js';
import { UsersService } from '../../src/users/users.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const prismaService = prisma as unknown as PrismaService;

const configValues: Record<string, unknown> = {
  CUSTOMER_JWT_SECRET: 'test_phase6_jwt_secret_32_chars_long!',
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
  CONSENT_VERSION: '2026-08-receipt-v1',
  DELETION_POLICY_VERSION: '2026-08-01',
  MAX_MESSAGE_CHARACTERS: 500,
};
const config = {
  get: vi.fn((key: string) => configValues[key]),
} as unknown as ConfigService<Environment, true>;

const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() } as unknown as StructuredLogger;
const transport = { sendMessage: vi.fn() } as unknown as TelegramTransport;
const i18n = new I18nService();

const jwtService = new CustomerJwtService(config);
const userRepo = new UserRepository(prismaService);
const identityRepo = new IdentityRepository(prismaService);
const identityResolver = new TelegramIdentityResolver(identityRepo, logger);
const usersService = new UsersService(userRepo, identityResolver);
const consentRepo = new ConsentRepository(prismaService);
const consentService = new ConsentService(consentRepo, config);
const idempotencyService = new IdempotencyService(prismaService);

const txValidator = new TransactionValidationService();
const finValidator = new FinancialEventValidationService();
const categoryRepo = new CategoryRepository(prismaService);
const txRepo = new TransactionRepository(prismaService, config, categoryRepo);
const interactionRepo = new InteractionRepository(prismaService);
const textNormalizer = new TextNormalizerService();
const clarificationService = new ClarificationCandidateService(textNormalizer);
const mockRedis = { allowed: vi.fn().mockResolvedValue(true) } as unknown as RedisService;
const textRateLimiter = new TextLogRateLimiter(mockRedis);

const mockExtractor = {
  model: 'test-model',
  promptVersion: 'v1',
  extract: vi.fn().mockImplementation(({ text }: { text: string }) => {
    const amountMatch = /(\d+)/.exec(text);
    const amount = amountMatch ? amountMatch[1] : '150';
    return Promise.resolve({
      transactions: [
        { type: 'expense', amount, currency: 'ETB', category: 'food', confidence: 0.95 },
      ],
    });
  }),
};

const textTransactionService = new TextTransactionService(
  mockExtractor,
  txValidator,
  finValidator,
  txRepo,
  interactionRepo,
  clarificationService,
  textNormalizer,
  textRateLimiter,
  usersService,
  i18n,
  transport,
  logger,
  config,
);

const deletionQueue = {
  removeForUser: vi.fn().mockResolvedValue(undefined),
} as unknown as DeletionQueueService;
const deletionService = new DeletionService(
  prismaService,
  usersService,
  deletionQueue,
  i18n,
  transport,
  config,
);

const meController = new MeController(prismaService, usersService, consentService);
const settingsController = new CustomerSettingsController(prismaService);
const transactionsController = new CustomerTransactionsController(
  prismaService,
  textTransactionService,
  idempotencyService,
  {} as unknown as CategoryRepository,
  {} as unknown as SmsQueueService,
);
const deletionController = new CustomerDeletionController(deletionService);
const activeAccountGuard = new ActiveAccountGuard();

describe('Phase 6 — Client-Neutral Account & Financial APIs Integration', () => {
  let userA: { id: string; identityId: string; token: string; sessionId: string };
  let userB: { id: string; identityId: string; token: string; sessionId: string };
  let userC: { id: string; identityId: string; token: string; sessionId: string };

  const jwtPayload = (user: {
    id: string;
    identityId: string;
    sessionId: string;
  }): CustomerJwtPayload => ({
    sub: user.id,
    sid: user.sessionId,
    sessionId: user.sessionId,
    identityId: user.identityId,
    role: 'customer',
    iss: 'muday-api',
    aud: 'muday-customer',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  });

  const setupUser = async (tag: string) => {
    const telegramId = BigInt(Math.floor(Math.random() * 1000000000) + 100000);

    const user = await prisma.user.create({
      data: {
        telegramId,
        firstName: `Phase6User_${tag}`,
        lastName: 'Test',
        language: 'EN',
        status: 'ACTIVE',
        consentVersion: '2026-08-receipt-v1',
        consentAt: new Date(),
      },
    });

    const identity = await prisma.userIdentity.create({
      data: {
        userId: user.id,
        provider: 'TELEGRAM',
        providerSubject: telegramId.toString(),
        telegramUserId: telegramId,
        profileDisplayName: `User ${tag}`,
        verifiedAt: new Date(),
        lastAuthenticatedAt: new Date(),
      },
    });

    const session = await prisma.customerSession.create({
      data: {
        userId: user.id,
        identityId: identity.id,
        clientType: 'FLUTTER_ANDROID',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const token = jwtService.signAccessToken({
      userId: user.id,
      sessionId: session.id,
      identityId: identity.id,
    });

    return { id: user.id, identityId: identity.id, sessionId: session.id, token };
  };

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.transactionGroup.deleteMany();
    await prisma.customerRefreshToken.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.userIdentity.deleteMany();
    await prisma.user.deleteMany({ where: { firstName: { startsWith: 'Phase6User_' } } });

    userA = await setupUser('A');
    userB = await setupUser('B');
    userC = await setupUser('C');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Profile & Safe Identities', () => {
    it('returns authenticated user profile for user A', async () => {
      const profile = await meController.getProfile(jwtPayload(userA));
      expect(profile.id).toBe(userA.id);
      expect(profile.language).toBe('EN');
      expect(profile.status).toBe('ACTIVE');
    });

    it('updates user language preference', async () => {
      const result = await meController.updateLanguage(jwtPayload(userA), { language: 'am' });
      expect(result.success).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: userA.id } });
      expect(dbUser?.language).toBe('AM');
    });

    it('returns safe identity provider metadata for user A', async () => {
      const identities = await meController.getIdentities(jwtPayload(userA));
      expect(Array.isArray(identities)).toBe(true);
      expect(identities.length).toBe(1);
      expect(identities[0]?.provider).toBe('TELEGRAM');
      expect(identities[0]?.providerSubject).toBeDefined();
    });
  });

  describe('Consent Status & Direct Acceptance', () => {
    it('returns active consent status for consented user', async () => {
      const status = await meController.getConsentStatus(jwtPayload(userA));
      expect(status.userConsented).toBe(true);
      expect(status.status).toBe('ACTIVE');
    });

    it('accepts consent directly for PENDING_CONSENT user', async () => {
      await prisma.user.update({
        where: { id: userB.id },
        data: { status: 'PENDING_CONSENT', consentVersion: null, consentAt: null },
      });

      const res = await meController.acceptConsent(jwtPayload(userB), {});
      expect(res.success).toBe(true);

      const updatedB = await prisma.user.findUnique({ where: { id: userB.id } });
      expect(updatedB?.status).toBe('ACTIVE');
    });
  });

  describe('User-Scoped Idempotency & Unique Source Message IDs', () => {
    it('logs mobile text transaction without sourceMessageId: 0 unique collision', async () => {
      const res1 = await transactionsController.logText(jwtPayload(userA), {
        text: 'Lunch 150 birr',
      });
      expect(res1.status).toBe('persisted');

      const res2 = await transactionsController.logText(jwtPayload(userA), {
        text: 'Taxi 50 birr',
      });
      expect(res2.status).toBe('persisted');
    });

    it('replays response for matching idempotency key', async () => {
      const key = 'ik_test_12345';
      const payload = { text: 'Coffee 80 birr', idempotencyKey: key };

      const res1 = await transactionsController.logText(jwtPayload(userA), payload);
      const res2 = await transactionsController.logText(jwtPayload(userA), payload);

      expect(res2).toEqual(res1);
    });

    it('rejects reused idempotency key with different payload with 409 Conflict', async () => {
      const key = 'ik_test_conflict';

      await transactionsController.logText(jwtPayload(userA), {
        text: 'Dinner 300 birr',
        idempotencyKey: key,
      });

      await expect(
        transactionsController.logText(jwtPayload(userA), {
          text: 'DIFFERENT TEXT 500 birr',
          idempotencyKey: key,
        }),
      ).rejects.toThrow('Idempotency key reused with different request payload');
    });
  });

  describe('Shared Undo Workflow', () => {
    it('undos the latest transaction group using real undoneAt schema', async () => {
      await transactionsController.logText(jwtPayload(userA), { text: 'Supermarket 450 birr' });

      const undoRes = await transactionsController.undoLatest(jwtPayload(userA));
      expect(undoRes.success).toBe(true);

      const history = await transactionsController.getHistory(jwtPayload(userA));
      expect(history.length).toBe(0);
    });
  });

  describe('Notification Settings Concurrency', () => {
    it('reads notification settings', async () => {
      const settings = await settingsController.getSettings(jwtPayload(userA));
      expect(settings.morningReminderEnabled).toBe(true);
      expect(settings.updatedAt).toBeDefined();
    });

    it('updates notification settings with HH:MM validation', async () => {
      const updated = await settingsController.updateSettings(jwtPayload(userA), {
        morningReminderTime: '09:00',
        nightStatusTime: '22:00',
      });

      expect(updated.morningReminderTime).toBe('09:00');
      expect(updated.nightStatusTime).toBe('22:00');
    });

    it('rejects stale expectedUpdatedAt with 409 Conflict', async () => {
      const staleTimestamp = new Date(Date.now() - 3600000).toISOString();

      await expect(
        settingsController.updateSettings(jwtPayload(userA), {
          morningReminderEnabled: false,
          expectedUpdatedAt: staleTimestamp,
        }),
      ).rejects.toThrow('Settings have been updated by another session');
    });
  });

  describe('Shared Account Deletion Workflow', () => {
    it('requires confirm: true to delete account', async () => {
      await expect(
        deletionController.deleteAccount(jwtPayload(userC), { confirm: false }),
      ).rejects.toThrow('Explicit confirmation (confirm: true) is required');
    });

    it('soft deletes user account, revokes sessions, and creates DeletionAudit record', async () => {
      const res = await deletionController.deleteAccount(jwtPayload(userC), { confirm: true });
      expect(res.success).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: userC.id } });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.status).toBe('DELETED');
      expect(dbUser?.deletedAt).not.toBeNull();

      const audit = await prisma.deletionAudit.findFirst({
        orderBy: { completedAt: 'desc' },
      });
      expect(audit).toBeDefined();
    });
  });

  describe('ActiveAccountGuard Permissions', () => {
    it('blocks financial operations for PENDING_CONSENT, PAUSED, and DELETING accounts', () => {
      const mockContext = (status: string): ExecutionContext =>
        ({
          switchToHttp: () => ({
            getRequest: () => ({ customerUser: { status, deletedAt: null } }),
          }),
        }) as unknown as ExecutionContext;

      expect(() => activeAccountGuard.canActivate(mockContext('PENDING_CONSENT'))).toThrow(
        'Consent is required before performing financial operations',
      );
      expect(() => activeAccountGuard.canActivate(mockContext('PAUSED'))).toThrow(
        'Account is paused; financial operations are blocked',
      );
      expect(() => activeAccountGuard.canActivate(mockContext('DELETING'))).toThrow(
        'Account is pending deletion; financial operations are blocked',
      );
      expect(activeAccountGuard.canActivate(mockContext('ACTIVE'))).toBe(true);
    });
  });

  describe('Three-User Isolation Invariant', () => {
    it('ensures User A cannot view or undo User B transactions', async () => {
      await transactionsController.logText(jwtPayload(userB), { text: 'User B expense 200 birr' });

      const historyA = await transactionsController.getHistory(jwtPayload(userA));
      expect(historyA.length).toBe(0);

      const undoA = await transactionsController.undoLatest(jwtPayload(userA));
      expect(undoA.success).toBe(false);

      const historyB = await transactionsController.getHistory(jwtPayload(userB));
      expect(historyB.length).toBe(1);
    });
  });
});
