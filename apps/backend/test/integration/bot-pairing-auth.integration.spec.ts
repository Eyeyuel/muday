import { PrismaPg } from '@prisma/adapter-pg';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryRepository } from '../../src/categories/category.repository.js';
import type { Environment } from '../../src/config/environment.js';
import type { ConsentService } from '../../src/consent/consent.service.js';
import { CustomerTransactionsController } from '../../src/customer-api/customer-transactions.controller.js';
import { MeController } from '../../src/customer-api/me.controller.js';
import { AppCodeService } from '../../src/customer-auth/app-code.service.js';
import { CustomerAuthController } from '../../src/customer-auth/customer-auth.controller.js';
import { CustomerAuthGuard } from '../../src/customer-auth/customer-auth.guard.js';
import { CustomerJwtService } from '../../src/customer-auth/customer-jwt.service.js';
import { CustomerSessionService } from '../../src/customer-auth/customer-session.service.js';
import { ExchangeAppCodeDto } from '../../src/customer-auth/exchange-app-code.dto.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import { IdempotencyService } from '../../src/idempotency/idempotency.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { RedisService } from '../../src/redis/redis.service.js';
import type { SmsQueueService } from '../../src/sms/sms-queue.service.js';
import type { TextTransactionService } from '../../src/transactions/text-transaction.service.js';
import { UserRepository } from '../../src/users/user.repository.js';
import { UsersService } from '../../src/users/users.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const prismaService = prisma as unknown as PrismaService;

const configValues: Record<string, unknown> = {
  REDIS_URL: redisUrl,
  CUSTOMER_JWT_SECRET: 'test_pairing_auth_jwt_secret_min32chars_long_!',
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
  APP_CODE_PEPPER: 'test_pairing_app_code_pepper_min32chars_long_12345',
  APP_CODE_RATE_LIMIT_PER_HOUR: 5,
  CUSTOMER_AUTH_ENABLED: true,
  CONSENT_VERSION: 'v1',
  MAX_MESSAGE_CHARACTERS: 500,
};

const config = {
  get: vi.fn((key: string) => configValues[key]),
} as unknown as ConfigService<Environment, true>;

const logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() } as unknown as StructuredLogger;
const redis = new RedisService(config);
const identityRepo = new IdentityRepository(prismaService);
const identityResolver = new TelegramIdentityResolver(identityRepo, logger);
const userRepo = new UserRepository(prismaService);
const usersService = new UsersService(userRepo, identityResolver);
const appCodeService = new AppCodeService(prismaService, redis, config);
const jwtService = new CustomerJwtService(config);
const sessionService = new CustomerSessionService(prismaService, config, jwtService);
const authGuard = new CustomerAuthGuard(jwtService, prismaService);
const authController = new CustomerAuthController(config, appCodeService, sessionService);

const dummyConsentService = {} as unknown as ConsentService;
const meController = new MeController(prismaService, usersService, dummyConsentService);
const idempotencyService = new IdempotencyService(prismaService);
const dummyTextTxService = {} as unknown as TextTransactionService;
const transactionsController = new CustomerTransactionsController(
  prismaService,
  dummyTextTxService,
  idempotencyService,
  {} as unknown as CategoryRepository,
  {} as unknown as SmsQueueService,
);

const makeMockReq = (ip = '127.0.0.1'): Request =>
  ({
    ip,
    socket: { remoteAddress: ip },
    headers: {},
  }) as unknown as Request;

const makeMockExecutionContext = (authHeader?: string): ExecutionContext => {
  const req: Request & { user?: unknown } = {
    headers: {
      authorization: authHeader,
    },
  } as unknown as Request;

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
};

describe('Bot Pairing Authentication Integration Spec', () => {
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
    await redis.onModuleDestroy();
  });

  describe('Group 1: POST /api/v1/auth/code — valid code', () => {
    it('returns 200 with accessToken, refreshToken, sessionId, and user when code is valid', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880001n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'ValidUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      expect(code).toHaveLength(6);

      const response = await authController.exchangeAppCode(
        { code, clientType: 'FLUTTER_IOS', deviceName: 'iPhone 15' },
        makeMockReq('192.168.1.10'),
      );

      expect(response).toBeDefined();
      expect(response.accessToken).toBeDefined();
      expect(typeof response.accessToken).toBe('string');
      expect(response.refreshToken).toBeDefined();
      expect(typeof response.refreshToken).toBe('string');
      expect(response.sessionId).toBeDefined();
      expect(response.user).toBeDefined();
      expect(response.user.id).toBe(user.id);
    });

    it('accessToken is a valid JWT with sub, sid, role=customer, iss=muday-api, aud=muday-customer', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880002n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'JwtClaimsUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      const response = await authController.exchangeAppCode({ code }, makeMockReq('192.168.1.11'));

      const payload = jwtService.verifyAccessToken(response.accessToken);
      expect(payload.sub).toBe(user.id);
      expect(payload.sid).toBe(response.sessionId);
      expect(payload.role).toBe('customer');
      expect(payload.iss).toBe('muday-api');
      expect(payload.aud).toBe('muday-customer');
    });

    it('user object in response contains id, language, status', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880003n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'UserProfileUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', language: 'AM', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      const response = await authController.exchangeAppCode({ code }, makeMockReq('192.168.1.12'));

      expect(response.user).toMatchObject({
        id: user.id,
        language: 'AM',
        status: 'ACTIVE',
      });
    });
  });

  describe('Group 2: POST /api/v1/auth/code — invalid input', () => {
    it('returns 400 when code is only 5 characters', async () => {
      const dto = plainToInstance(ExchangeAppCodeDto, { code: 'aB3kX' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints?.isLength).toContain('exactly 6 characters');
    });

    it('returns 400 when code is 7 characters', async () => {
      const dto = plainToInstance(ExchangeAppCodeDto, { code: 'aB3kX99' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints?.isLength).toContain('exactly 6 characters');
    });

    it('returns 400 when code is empty string', async () => {
      const dto = plainToInstance(ExchangeAppCodeDto, { code: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns 400 when code contains special characters like @#$', async () => {
      const dto = plainToInstance(ExchangeAppCodeDto, { code: 'aB@#$1' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints?.matches).toContain('alphanumeric');
    });

    it('returns 400 when code contains spaces', async () => {
      const dto = plainToInstance(ExchangeAppCodeDto, { code: 'aB 3kX' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.constraints?.matches).toContain('alphanumeric');
    });
  });

  describe('Group 3: POST /api/v1/auth/code — auth failures', () => {
    it('returns 401 when code is wrong but correct length', async () => {
      await expect(
        authController.exchangeAppCode({ code: 'ZZZZZZ' }, makeMockReq('10.0.0.1')),
      ).rejects.toThrow('Invalid code');
    });

    it('returns 401 when user is deleted', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880004n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'DeletedUser' },
      });

      const code = await appCodeService.generateForUser(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'DELETED', deletedAt: new Date() },
      });

      await expect(
        authController.exchangeAppCode({ code }, makeMockReq('10.0.0.2')),
      ).rejects.toThrow('Invalid code');
    });

    it('returns 401 when user is PENDING_CONSENT (not yet onboarded)', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880005n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'PendingUser' },
      });

      expect(user.status).toBe('PENDING_CONSENT');
      const code = await appCodeService.generateForUser(user.id);

      await expect(
        authController.exchangeAppCode({ code }, makeMockReq('10.0.0.3')),
      ).rejects.toThrow('Invalid code');
    });
  });

  describe('Group 4: Removed endpoints', () => {
    it('returns 404 for POST /api/v1/auth/telegram/start', () => {
      expect(
        (CustomerAuthController.prototype as unknown as Record<string, unknown>)['startLogin'],
      ).toBeUndefined();
    });

    it('returns 404 for GET /api/v1/auth/telegram/callback', () => {
      expect(
        (CustomerAuthController.prototype as unknown as Record<string, unknown>)['handleCallback'],
      ).toBeUndefined();
    });

    it('returns 404 for POST /api/v1/auth/exchange', () => {
      expect(
        (CustomerAuthController.prototype as unknown as Record<string, unknown>)['exchangeCode'],
      ).toBeUndefined();
    });
  });

  describe('Group 5: Session works after code exchange', () => {
    it('returned accessToken works on GET /api/v1/me and returns 200', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880006n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'MeUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      const session = await authController.exchangeAppCode({ code }, makeMockReq('10.0.0.4'));

      const payload = jwtService.verifyAccessToken(session.accessToken);
      const profile = await meController.getProfile(payload);

      expect(profile).toBeDefined();
      expect(profile.id).toBe(user.id);
      expect(profile.status).toBe('ACTIVE');
    });

    it('returned accessToken works on GET /api/v1/transactions/history and returns 200', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880007n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'TxHistoryUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      // Insert transaction for user
      const group = await prisma.transactionGroup.create({
        data: {
          userId: user.id,
          source: 'TEXT',
          rawTranscript: 'Paid 300 ETB for lunch',
          transcriptExpiresAt: new Date(Date.now() + 86_400_000),
          telegramUpdateId: 10001n,
          telegramMessageId: 10002n,
          messageAt: new Date(),
          extractionModel: 'gemini-1.5-flash',
          promptVersion: 'v1',
        },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          groupId: group.id,
          type: 'EXPENSE',
          kind: 'EXPENSE',
          amountEtb: 300,
          category: 'FOOD',
          occurredAt: new Date(),
        },
      });

      const code = await appCodeService.generateForUser(user.id);
      const session = await authController.exchangeAppCode({ code }, makeMockReq('10.0.0.5'));

      const payload = jwtService.verifyAccessToken(session.accessToken);
      const history = await transactionsController.getHistory(payload, '10');

      expect(history).toBeDefined();
      expect(history).toHaveLength(1);
      expect(history[0]?.amount).toBe('300.00');
    });

    it('returned refreshToken works on POST /api/v1/auth/token/refresh and returns new tokens', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880008n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'RefreshUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      const session = await authController.exchangeAppCode({ code }, makeMockReq('10.0.0.6'));

      const rotated = await authController.refreshToken({ refreshToken: session.refreshToken });
      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(session.refreshToken);

      const payload = jwtService.verifyAccessToken(rotated.accessToken);
      expect(payload.sub).toBe(user.id);
    });
  });

  describe('Group 6: Logout', () => {
    it('POST /api/v1/auth/logout revokes session; using old token returns 401', async () => {
      const { user } = await identityResolver.resolve({
        telegramUserId: 88880009n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'LogoutUser' },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const code = await appCodeService.generateForUser(user.id);
      const session = await authController.exchangeAppCode({ code }, makeMockReq('10.0.0.7'));

      const payload = jwtService.verifyAccessToken(session.accessToken);

      // Verify token works before logout
      const ctxBefore = makeMockExecutionContext(`Bearer ${session.accessToken}`);
      await expect(authGuard.canActivate(ctxBefore)).resolves.toBe(true);

      // Logout
      const logoutResult = await authController.logout(payload);
      expect(logoutResult.success).toBe(true);

      // Verify token fails after logout
      const ctxAfter = makeMockExecutionContext(`Bearer ${session.accessToken}`);
      await expect(authGuard.canActivate(ctxAfter)).rejects.toThrow(
        'Customer session is invalid, expired, or revoked',
      );
    });
  });

  describe('Group 7: Cross-user isolation', () => {
    it('User A code does not authenticate as User B', async () => {
      const { user: userA } = await identityResolver.resolve({
        telegramUserId: 88880010n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'UserA' },
      });
      const { user: userB } = await identityResolver.resolve({
        telegramUserId: 88880011n,
        channel: 'TELEGRAM_BOT',
        profile: { firstName: 'UserB' },
      });

      await prisma.user.update({
        where: { id: userA.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });
      await prisma.user.update({
        where: { id: userB.id },
        data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
      });

      const codeA = await appCodeService.generateForUser(userA.id);
      const codeB = await appCodeService.generateForUser(userB.id);

      const sessionA = await authController.exchangeAppCode(
        { code: codeA },
        makeMockReq('10.0.0.8'),
      );
      const sessionB = await authController.exchangeAppCode(
        { code: codeB },
        makeMockReq('10.0.0.9'),
      );

      const payloadA = jwtService.verifyAccessToken(sessionA.accessToken);
      const payloadB = jwtService.verifyAccessToken(sessionB.accessToken);

      expect(payloadA.sub).toBe(userA.id);
      expect(payloadB.sub).toBe(userB.id);
      expect(payloadA.sub).not.toBe(payloadB.sub);

      const profileA = await meController.getProfile(payloadA);
      const profileB = await meController.getProfile(payloadB);

      expect(profileA.id).toBe(userA.id);
      expect(profileB.id).toBe(userB.id);
    });
  });

  describe('Group 8: Rate limiting', () => {
    it('after APP_CODE_RATE_LIMIT_PER_HOUR failed attempts, further attempts return 401', async () => {
      const ip = '198.51.100.99';
      await redis.delete(`muday:auth:attempts:${ip}`);

      // 5 failed attempts
      for (let i = 0; i < 5; i += 1) {
        await expect(
          authController.exchangeAppCode({ code: 'WRONG1' }, makeMockReq(ip)),
        ).rejects.toThrow('Invalid code');
      }

      // 6th attempt is rate-limited and throws 401
      await expect(
        authController.exchangeAppCode({ code: 'WRONG2' }, makeMockReq(ip)),
      ).rejects.toThrow('Invalid code');

      await redis.delete(`muday:auth:attempts:${ip}`);
    });
  });
});
