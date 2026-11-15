import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { InteractionRepository } from '../../src/interactions/interaction.repository.js';

const telegramIds = [9_300_000_001n, 9_300_000_002n] as const;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const repository = new InteractionRepository(prisma as unknown as PrismaService);

describe('Phase 4 interaction persistence', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: [...telegramIds] } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: [...telegramIds] } } });
    await prisma.$disconnect();
  });

  it('creates and reloads an amount clarification', async () => {
    const user = await prisma.user.create({
      data: {
        telegramId: telegramIds[0],
        status: 'ACTIVE',
        consentVersion: 'test-v1',
        consentAt: new Date(),
      },
    });
    const interaction = await repository.create(user.id, 'CLARIFY_AMOUNT', {
      kind: 'clarify_amount',
      sourceUpdateId: 100,
      sourceMessageId: 200,
      messageAt: '2026-08-01T06:00:00.000Z',
      model: 'rule-based-v1',
      promptVersion: 'phase4-v1',
      type: 'expense',
      category: 'food',
      note: 'lunch',
      clarificationCount: 1,
    });
    await expect(repository.findPending(interaction.id, user.id)).resolves.toMatchObject({
      id: interaction.id,
      payload: { kind: 'clarify_amount', category: 'food' },
    });
  });

  it('binds financial clarification to its owner and expires old buttons safely', async () => {
    const [owner, other] = await Promise.all(
      telegramIds.map((telegramId) =>
        prisma.user.create({
          data: {
            telegramId,
            status: 'ACTIVE',
            consentVersion: 'test-v1',
            consentAt: new Date(),
          },
        }),
      ),
    );
    if (!owner || !other) throw new Error('Test users were not created');
    const interaction = await repository.create(owner.id, 'CLARIFY_FINANCIAL', {
      kind: 'clarify_financial',
      sourceUpdateId: 101,
      sourceMessageId: 201,
      messageAt: '2026-08-13T06:00:00.000Z',
      model: 'gemini-test',
      promptVersion: 'classification-v1',
      source: 'voice',
      event: {
        amount: '5000.00',
        currency: 'ETB',
        note: 'from Hana',
        confidence: 0.7,
        clarificationReason: 'purpose',
      },
      readyTransactions: [],
      ignoredTransferCount: 0,
      clarificationCount: 1,
    });

    await expect(repository.findPending(interaction.id, other.id)).resolves.toBeNull();
    await prisma.pendingInteraction.update({
      where: { id: interaction.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(repository.findPending(interaction.id, owner.id)).resolves.toBeNull();
    await expect(
      prisma.pendingInteraction.findUniqueOrThrow({ where: { id: interaction.id } }),
    ).resolves.toMatchObject({ state: 'EXPIRED' });

    const metric = await prisma.event.findFirstOrThrow({
      where: { userId: owner.id, eventType: 'clarification_requested' },
    });
    expect(metric.metadata).toEqual({ source: 'voice', reason: 'clarify_financial' });
  });
});
