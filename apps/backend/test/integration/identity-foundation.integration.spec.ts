import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaClient } from '../../src/generated/prisma/client.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityBackfillService } from '../../src/identity/telegram-identity-backfill.service.js';

const firstTelegramId = 9_000_008_101n;
const secondTelegramId = 9_000_008_102n;
const telegramIds = [firstTelegramId, secondTelegramId];
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000, max: 4 }),
});
const repository = new IdentityRepository(prisma as unknown as PrismaService);
const service = new TelegramIdentityBackfillService(repository);

describe('unified identity foundation integration', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('backfills existing Telegram users without changing their account IDs', async () => {
    const created = await prisma.user.create({
      data: {
        telegramId: firstTelegramId,
        firstName: 'Identity',
        lastName: 'Fixture',
        username: 'identity_fixture',
      },
    });

    const dryRun = await service.run({
      dryRun: true,
      batchSize: 1000,
      onlyUserIds: [created.id],
    });
    expect(dryRun.wouldCreate).toBeGreaterThanOrEqual(1);
    expect(await prisma.userIdentity.count({ where: { telegramUserId: firstTelegramId } })).toBe(0);

    await service.run({ dryRun: false, batchSize: 1000, onlyUserIds: [created.id] });
    const identity = await prisma.userIdentity.findUniqueOrThrow({
      where: {
        provider_telegramUserId: { provider: 'TELEGRAM', telegramUserId: firstTelegramId },
      },
    });
    expect(identity.userId).toBe(created.id);
    expect(identity.providerSubject).toBe(firstTelegramId.toString());
    expect(identity.oidcSubject).toBeNull();
    expect(identity.profileDisplayName).toBe('Identity Fixture');
  });

  it('is idempotent and concurrency-safe under repeated apply runs', async () => {
    const user = await prisma.user.create({ data: { telegramId: secondTelegramId } });

    await Promise.all([
      service.run({ dryRun: false, batchSize: 1000, onlyUserIds: [user.id] }),
      service.run({ dryRun: false, batchSize: 1000, onlyUserIds: [user.id] }),
    ]);

    expect(await prisma.userIdentity.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.identityLinkEvent.count({
        where: { userId: user.id, eventType: 'CREATED', channel: 'BACKFILL' },
      }),
    ).toBe(1);

    const repeated = await service.run({
      dryRun: false,
      batchSize: 1000,
      onlyUserIds: [user.id],
    });
    expect(repeated.conflicts).toEqual([]);
    expect(await prisma.userIdentity.count({ where: { userId: user.id } })).toBe(1);
  });

  it('enforces canonical Telegram and refresh-token constraints in PostgreSQL', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: firstTelegramId } });
    await expect(
      prisma.userIdentity.create({
        data: {
          userId: user.id,
          provider: 'TELEGRAM',
          providerSubject: 'different-subject',
          telegramUserId: 9_000_008_199n,
          verifiedAt: new Date(),
          lastAuthenticatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();

    const identity = await prisma.userIdentity.findFirstOrThrow({ where: { userId: user.id } });
    const session = await prisma.customerSession.create({
      data: {
        userId: user.id,
        identityId: identity.id,
        clientType: 'FLUTTER_ANDROID',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.customerRefreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      prisma.customerRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow();
  });
});

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { telegramId: { in: telegramIds } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length > 0) {
    await prisma.identityLinkEvent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
