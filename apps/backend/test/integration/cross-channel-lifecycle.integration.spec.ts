import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import { CustomerAuthGuard } from '../../src/customer-auth/customer-auth.guard.js';
import { CustomerJwtService } from '../../src/customer-auth/customer-jwt.service.js';
import { CustomerSessionService } from '../../src/customer-auth/customer-session.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { DeletionQueueService } from '../../src/deletion/deletion-queue.service.js';
import { DeletionService } from '../../src/deletion/deletion.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { I18nService } from '../../src/i18n/i18n.service.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import type { TelegramTransport } from '../../src/telegram/transport/telegram-transport.interface.js';
import type { UsersService } from '../../src/users/users.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const repository = new IdentityRepository(prisma as unknown as PrismaService);
const resolver = new TelegramIdentityResolver(repository, {
  warn: vi.fn(),
} as unknown as StructuredLogger);

const configValues: Record<string, unknown> = {
  CUSTOMER_JWT_SECRET: 'test_cross_channel_jwt_secret_32_chars_long!',
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
  CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
  DELETION_POLICY_VERSION: '2026-08-01',
};
const config = {
  get: vi.fn((key: string) => configValues[key]),
} as unknown as ConfigService<Environment, true>;

const jwtService = new CustomerJwtService(config);
const sessionService = new CustomerSessionService(
  prisma as unknown as PrismaService,
  config,
  jwtService,
);

describe('Cross-Channel Lifecycle Integration', () => {
  beforeEach(async () => {
    await prisma.customerRefreshToken.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.pendingInteraction.deleteMany();
    await prisma.identityLinkEvent.deleteMany();
    await prisma.userIdentity.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('revokes mobile customer sessions immediately when deletion is initiated from Telegram', async () => {
    // 1. User connects via Telegram
    const { user, identity } = await resolver.resolve({
      telegramUserId: 11112222n,
      channel: 'TELEGRAM_BOT',
      profile: { firstName: 'MultiChannelUser' },
    });

    // Mark user ACTIVE
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() },
    });

    // 2. User logs in via Mobile App and creates a session
    const session = await sessionService.createSession({
      userId: user.id,
      identityId: identity.id,
      clientType: 'FLUTTER_ANDROID',
      deviceName: 'Pixel 8',
      appVersion: '1.0.0',
    });

    // Verify session is active
    const initialSession = await prisma.customerSession.findUnique({
      where: { id: session.sessionId },
    });
    expect(initialSession?.revokedAt).toBeNull();

    // 3. User requests deletion from Telegram
    const dummyQueues = {
      removeForUser: () => Promise.resolve(),
    } as unknown as DeletionQueueService;
    const dummyI18n = {
      translate: () => 'Translated Text',
    } as unknown as I18nService;
    const dummyTransport = {
      sendMessage: () =>
        Promise.resolve({ messageId: 1, date: 1, chat: { id: 1, type: 'private' } }),
    } as unknown as TelegramTransport;
    const dummyUsers = {
      findByTelegramId: (id: number) =>
        prisma.user.findFirst({ where: { telegramId: BigInt(id) } }),
    } as unknown as UsersService;

    const deletionService = new DeletionService(
      prisma as unknown as PrismaService,
      dummyUsers,
      dummyQueues,
      dummyI18n,
      dummyTransport,
      config,
    );

    // Request Step 1
    await deletionService.request(11112222, 10001);
    const step1Interaction = await prisma.pendingInteraction.findFirst({
      where: { userId: user.id, kind: 'CONFIRM_DELETE_STEP_1' },
    });
    expect(step1Interaction).toBeDefined();

    // Confirm Step 1 -> creates Step 2
    await deletionService.handle(step1Interaction!.id, 'continue', 11112222, 10001, 2001);
    const step2Interaction = await prisma.pendingInteraction.findFirst({
      where: { userId: user.id, kind: 'CONFIRM_DELETE_STEP_2' },
    });
    expect(step2Interaction).toBeDefined();

    // Confirm Step 2 -> permanent deletion start
    await deletionService.handle(step2Interaction!.id, 'permanent', 11112222, 10001, 2002);

    // 4. Verify mobile session is revoked
    const revokedSession = await prisma.customerSession.findUnique({
      where: { id: session.sessionId },
    });
    expect(revokedSession).not.toBeNull();
    expect(revokedSession?.revokedAt).not.toBeNull();

    // 5. Verify CustomerAuthGuard rejects access
    const guard = new CustomerAuthGuard(jwtService, prisma as unknown as PrismaService);
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: `Bearer ${session.accessToken}` },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();
  });
});
