import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ConsentRepository } from '../../src/consent/consent.repository.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { IdentityRepository } from '../../src/identity/identity.repository.js';
import { TelegramIdentityResolver } from '../../src/identity/telegram-identity-resolver.service.js';
import type { StructuredLogger } from '../../src/observability/structured-logger.service.js';
import { UserRepository } from '../../src/users/user.repository.js';
import { UsersService } from '../../src/users/users.service.js';

const telegramId = 9_100_000_001;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 8 }) });
const prismaService = prisma as unknown as PrismaService;
const identityRepository = new IdentityRepository(prismaService);
const identityResolver = new TelegramIdentityResolver(identityRepository, {
  warn: () => undefined,
} as unknown as StructuredLogger);
const users = new UsersService(new UserRepository(prismaService), identityResolver);
const consent = new ConsentRepository(prismaService);

describe('onboarding and consent lifecycle integration', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { telegramId: { in: [BigInt(telegramId), BigInt(telegramId + 1)] } },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { telegramId: { in: [BigInt(telegramId), BigInt(telegramId + 1)] } },
    });
    await prisma.$disconnect();
  });

  it('creates one pending Amharic user and one signup event across repeated starts', async () => {
    const first = await users.findOrCreate(telegramId);
    const second = await users.findOrCreate(telegramId);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.user.id).toBe(second.user.id);
    expect(first.user.language).toBe('AM');
    expect(first.user.status).toBe('PENDING_CONSENT');
    expect(
      await prisma.event.count({ where: { userId: first.user.id, eventType: 'signup' } }),
    ).toBe(1);
  });

  it('persists language before consent and atomically records one acceptance', async () => {
    const { user } = await users.findOrCreate(telegramId);
    await users.changeLanguage(telegramId, 'en');
    const interaction = await consent.createInteraction(user.id, '2026-07', 101);

    await expect(consent.accept(interaction.id, telegramId, '2026-07')).resolves.toBe('accepted');
    await expect(consent.accept(interaction.id, telegramId, '2026-07')).resolves.toBe(
      'already_accepted',
    );

    const active = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const record = await prisma.consentRecord.findFirstOrThrow({ where: { userId: user.id } });
    expect(active.language).toBe('EN');
    expect(active.status).toBe('ACTIVE');
    expect(active.consentVersion).toBe('2026-07');
    expect(active.consentAt?.getTime()).toBe(record.recordedAt.getTime());
    expect(record.version).toBe('2026-07');
    expect(await prisma.consentRecord.count({ where: { userId: user.id } })).toBe(1);
    const consentEvents = await prisma.event.findMany({
      where: { userId: user.id, eventType: 'consent_completed' },
    });
    expect(consentEvents).toHaveLength(1);
    expect(consentEvents[0]?.metadata).toBeNull();

    await users.changeLanguage(telegramId, 'am');
    expect(
      await prisma.user
        .findUniqueOrThrow({ where: { id: user.id } })
        .then((value) => value.language),
    ).toBe('AM');
  });

  it('cancels the previous pending button when onboarding is repeated', async () => {
    const { user } = await users.findOrCreate(telegramId);
    const first = await consent.createInteraction(user.id, '2026-07', 106);
    const second = await consent.createInteraction(user.id, '2026-07', 107);

    expect(
      await prisma.pendingInteraction
        .findUniqueOrThrow({ where: { id: first.id } })
        .then((value) => value.state),
    ).toBe('CANCELLED');
    await expect(consent.accept(first.id, telegramId, '2026-07')).resolves.toBe('invalid');
    await expect(consent.accept(second.id, telegramId, '2026-07')).resolves.toBe('accepted');
  });

  it('allows exactly one acceptance under concurrent callback delivery', async () => {
    const { user } = await users.findOrCreate(telegramId);
    const interaction = await consent.createInteraction(user.id, '2026-07', 102);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => consent.accept(interaction.id, telegramId, '2026-07')),
    );

    expect(results.filter((result) => result === 'accepted')).toHaveLength(1);
    expect(await prisma.consentRecord.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.event.count({ where: { userId: user.id, eventType: 'consent_completed' } }),
    ).toBe(1);
  });

  it('rejects a wrong user and expires an old interaction without activating the user', async () => {
    const { user } = await users.findOrCreate(telegramId);
    const interaction = await consent.createInteraction(user.id, '2026-07', 103);
    await expect(consent.accept(interaction.id, telegramId + 1, '2026-07')).resolves.toBe(
      'invalid',
    );
    await prisma.pendingInteraction.update({
      where: { id: interaction.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(consent.accept(interaction.id, telegramId, '2026-07')).resolves.toBe('expired');

    const pending = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(pending.status).toBe('PENDING_CONSENT');
    expect(await prisma.consentRecord.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects a stale consent version and permits re-consent with the current version', async () => {
    const { user } = await users.findOrCreate(telegramId);
    const stale = await consent.createInteraction(user.id, 'old-version', 104);
    await expect(consent.accept(stale.id, telegramId, '2026-07')).resolves.toBe('outdated');

    const current = await consent.createInteraction(user.id, '2026-07', 105);
    await expect(consent.accept(current.id, telegramId, '2026-07')).resolves.toBe('accepted');
  });
});
