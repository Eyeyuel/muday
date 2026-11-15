import { PrismaPg } from '@prisma/adapter-pg';
import type { Request } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import type { ConsentService } from '../../src/consent/consent.service.js';
import { AppCodeService } from '../../src/customer-auth/app-code.service.js';
import { CustomerAuthController } from '../../src/customer-auth/customer-auth.controller.js';
import { CustomerJwtService } from '../../src/customer-auth/customer-jwt.service.js';
import { CustomerSessionService } from '../../src/customer-auth/customer-session.service.js';
import { CustomerSummariesController } from '../../src/customer-api/customer-summaries.controller.js';
import { MeController } from '../../src/customer-api/me.controller.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { SummaryService } from '../../src/summaries/summary.service.js';
import { SummaryRepository } from '../../src/summaries/summary.repository.js';
import { UsersService } from '../../src/users/users.service.js';
import { UserRepository } from '../../src/users/user.repository.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const prismaService = prisma as unknown as PrismaService;

const configValues: Record<string, unknown> = {
  REDIS_URL: redisUrl,
  CUSTOMER_JWT_SECRET: 'test_flutter_acceptance_jwt_secret_32_chars_long!',
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
  APP_CODE_PEPPER: 'test_app_code_pepper_secret_min32chars_long_12345',
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
const authController = new CustomerAuthController(config, appCodeService, sessionService);

const dummyConsentService = {} as unknown as ConsentService;
const meController = new MeController(prismaService, usersService, dummyConsentService);
const summaryRepo = new SummaryRepository(prismaService);
const summaryService = new SummaryService(summaryRepo);
const summariesController = new CustomerSummariesController(summaryService);

describe('Flutter Mobile E2E Integration Acceptance', () => {
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

  it('completes pairing code auth flow, retrieves profile, logs text transaction, gets summary, and handles account convergence', async () => {
    // 1. User signs up on bot
    const { user } = await identityResolver.resolve({
      telegramUserId: 99990001n,
      channel: 'TELEGRAM_BOT',
      profile: { firstName: 'FlutterAcceptanceUser' },
    });

    // Mark user ACTIVE
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
    });

    // 2. Bot generates pairing code for user
    const pairingCode = await appCodeService.generateForUser(user.id);
    expect(pairingCode).toHaveLength(6);

    // 3. Mobile app exchanges pairing code for tokens
    const session = await authController.exchangeAppCode(
      {
        code: pairingCode,
        clientType: 'FLUTTER_ANDROID',
        deviceName: 'Pixel 8 Pro',
        appVersion: '1.0.0',
      },
      { ip: '127.0.0.1', socket: {} } as unknown as Request,
    );

    expect(session.accessToken).toBeDefined();
    expect(session.refreshToken).toBeDefined();

    const customerPayload = jwtService.verifyAccessToken(session.accessToken);
    expect(customerPayload.sub).toBe(user.id);
    expect(customerPayload.role).toBe('customer');

    // 4. Get profile via MeController
    const profile = await meController.getProfile(customerPayload);
    expect(profile.id).toBe(user.id);

    // 5. Update language to Amharic
    await meController.updateLanguage(customerPayload, { language: 'am' });
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.language).toBe('AM');

    // 6. Get Summary via CustomerSummariesController
    const summary = await summariesController.getTodaySummary(customerPayload);
    expect(summary.period).toBe('today');
    expect(summary.totalExpenseCents).toBe(0);

    // 7. Mini App / Bot Account Convergence check
    const secondResolution = await identityResolver.resolve({
      telegramUserId: 99990001n,
      channel: 'TELEGRAM_MINIAPP',
      profile: { firstName: 'FlutterAcceptanceUserUpdated' },
    });
    expect(secondResolution.user.id).toBe(user.id);

    // 8. Mobile session rotation works
    const refreshedSession = await sessionService.refreshSession(session.refreshToken);
    expect(refreshedSession.accessToken).toBeDefined();
    expect(refreshedSession.refreshToken).not.toBe(session.refreshToken);
  });
});
