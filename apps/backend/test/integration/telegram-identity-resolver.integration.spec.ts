import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';

const telegramIds = [9_940_100_001n, 9_940_100_002n, 9_940_100_003n, 9_940_100_004n] as const;
const correlationPrefix = `phase2-${randomUUID()}`;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 12 }) });
const repository = new IdentityRepository(prisma as unknown as PrismaService);
const warnings: Array<Record<string, unknown>> = [];
const resolver = new TelegramIdentityResolver(repository, {
  warn: (_message: unknown, metadata?: Record<string, unknown>) => warnings.push(metadata ?? {}),
} as unknown as StructuredLogger);

describe('TelegramIdentityResolver integration', () => {
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('creates one account and identity atomically under concurrent first access', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        resolver.resolve({
          telegramUserId: telegramIds[0],
          channel: 'TELEGRAM_BOT',
          profile: { firstName: 'Hana', lastName: 'Tesfaye', username: 'hana_t' },
          correlationId: `${correlationPrefix}-race`,
        }),
      ),
    );

    expect(new Set(results.map(({ user }) => user.id))).toHaveLength(1);
    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(await prisma.user.count({ where: { telegramId: telegramIds[0] } })).toBe(1);
    expect(await prisma.userIdentity.count({ where: { telegramUserId: telegramIds[0] } })).toBe(1);
    expect(
      await prisma.event.count({
        where: { user: { telegramId: telegramIds[0] }, eventType: 'signup' },
      }),
    ).toBe(1);
  });

  it('repairs a legacy-only user and records dual-read telemetry without creating a new account', async () => {
    const legacy = await prisma.user.create({ data: { telegramId: telegramIds[1] } });
    const result = await resolver.resolve({
      telegramUserId: telegramIds[1],
      channel: 'TELEGRAM_MINIAPP',
      profile: { firstName: 'Sara', lastName: 'Bekele', username: 'sara_b' },
      correlationId: `${correlationPrefix}-legacy`,
    });

    expect(result.created).toBe(false);
    expect(result.user).toMatchObject({ id: legacy.id, firstName: 'Sara', lastName: 'Bekele' });
    expect(result.identity.userId).toBe(legacy.id);
    expect(warnings).toContainEqual(
      expect.objectContaining({ mismatchType: 'identity_missing_for_compatibility_user' }),
    );
  });

  it('fails closed and audits a disagreement between identity and compatibility ownership', async () => {
    const compatibilityOwner = await prisma.user.create({ data: { telegramId: telegramIds[2] } });
    const otherOwner = await prisma.user.create({ data: { telegramId: telegramIds[3] } });
    await prisma.userIdentity.create({
      data: {
        userId: otherOwner.id,
        provider: 'TELEGRAM',
        providerSubject: telegramIds[2].toString(),
        telegramUserId: telegramIds[2],
        verifiedAt: new Date(),
        lastAuthenticatedAt: new Date(),
      },
    });

    await expect(
      resolver.resolve({
        telegramUserId: telegramIds[2],
        channel: 'TELEGRAM_BOT',
        correlationId: `${correlationPrefix}-conflict`,
      }),
    ).rejects.toMatchObject({ code: 'identity_conflict' });
    expect(await prisma.user.findUnique({ where: { id: compatibilityOwner.id } })).not.toBeNull();
    expect(
      await prisma.identityLinkEvent.count({
        where: { correlationId: `${correlationPrefix}-conflict`, eventType: 'CONFLICT' },
      }),
    ).toBe(1);
  });

  it('rejects deleted users and keeps three Telegram identities strictly isolated', async () => {
    const ids = telegramIds.slice(0, 3);
    const resolved = await Promise.all(
      ids.map((telegramUserId, index) =>
        resolver.resolve({
          telegramUserId,
          channel: 'TELEGRAM_BOT',
          profile: { firstName: `Account ${index + 1}` },
          correlationId: `${correlationPrefix}-isolation-${index}`,
        }),
      ),
    );
    expect(new Set(resolved.map(({ user }) => user.id))).toHaveLength(3);
    for (const [index, result] of resolved.entries()) {
      expect(result.identity.userId).toBe(result.user.id);
      expect(result.user.telegramId).toBe(ids[index]);
    }

    await prisma.user.update({
      where: { id: resolved[0]!.user.id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    await expect(
      resolver.resolve({ telegramUserId: ids[0]!, channel: 'TELEGRAM_MINIAPP' }),
    ).rejects.toMatchObject({ code: 'identity_not_found' });
  });
});

async function clean(): Promise<void> {
  warnings.length = 0;
  await prisma.identityLinkEvent.deleteMany({
    where: { correlationId: { startsWith: correlationPrefix } },
  });
  await prisma.user.deleteMany({ where: { telegramId: { in: [...telegramIds] } } });
}
