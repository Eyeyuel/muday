import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { Environment } from '../../src/config/environment.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { TransactionRepository } from '../../src/transactions/transaction.repository.js';
import { CategoryRepository } from '../../src/categories/category.repository.js';

const telegramId = 9_200_000_001n;
const updateIds = [8_200_000_001n, 8_200_000_002n, 8_200_000_003n] as const;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 4 }) });
const config = { get: () => 'test-v1' } as unknown as ConfigService<Environment, true>;
const categoryRepo = new CategoryRepository(prisma as unknown as PrismaService);
const repository = new TransactionRepository(
  prisma as unknown as PrismaService,
  config,
  categoryRepo,
);

describe('text transaction persistence integration', () => {
  beforeEach(async () => {
    await prisma.processedUpdate.deleteMany({
      where: { telegramUpdateId: { in: [...updateIds] } },
    });
    await prisma.user.deleteMany({ where: { telegramId } });
  });

  afterAll(async () => {
    await prisma.processedUpdate.deleteMany({
      where: { telegramUpdateId: { in: [...updateIds] } },
    });
    await prisma.user.deleteMany({ where: { telegramId } });
    await prisma.$disconnect();
  });

  it('atomically commits the group, ledger row, update completion, and safe metric', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[0]);
    const messageAt = new Date('2026-08-01T05:30:00.000Z');

    await repository.logText({
      userId: user.id,
      sourceUpdateId: Number(updateIds[0]),
      sourceMessageId: 7001,
      processedUpdateId: Number(updateIds[0]),
      messageAt,
      model: 'rule-based-v1',
      promptVersion: 'phase3-v1',
      transactions: [
        {
          type: 'expense',
          amount: '250.00',
          currency: 'ETB',
          category: 'food',
          note: 'lunch',
          confidence: 0.95,
        },
      ],
    });

    const group = await prisma.transactionGroup.findFirstOrThrow({
      where: { userId: user.id },
      include: { transactions: true },
    });
    expect(group.source).toBe('TEXT');
    expect(group.rawTranscript).toBeNull();
    expect(group.messageAt.getTime()).toBe(messageAt.getTime());
    expect(group.extractionModel).toBe('rule-based-v1');
    expect(group.promptVersion).toBe('phase3-v1');
    expect(group.transactions).toHaveLength(1);
    expect(group.transactions[0]?.amountEtb.toFixed(2)).toBe('250.00');
    expect(group.transactions[0]?.category).toBe('food');
    expect(group.transactions[0]?.occurredAt.getTime()).toBe(messageAt.getTime());

    const update = await prisma.processedUpdate.findUniqueOrThrow({
      where: { telegramUpdateId: updateIds[0] },
    });
    expect(update.status).toBe('COMPLETED');
    expect(update.userId).toBe(user.id);
    expect(update.completedAt).not.toBeNull();

    const metric = await prisma.event.findFirstOrThrow({
      where: { userId: user.id, eventType: 'transaction_logged' },
    });
    expect(metric.metadata).toEqual({
      source: 'text',
      transactionCount: 1,
      kindCounts: { expense: 1 },
      otherCount: 0,
    });
  });

  it('persists redesigned special events with explicit kind and keeps isolation metadata', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[2]);
    await repository.logText({
      userId: user.id,
      sourceUpdateId: Number(updateIds[2]),
      sourceMessageId: 7099,
      processedUpdateId: Number(updateIds[2]),
      messageAt: new Date('2026-08-13T08:00:00.000Z'),
      model: 'gemini-test',
      promptVersion: 'classification-v1',
      transactions: [
        {
          kind: 'loan_received',
          direction: 'inflow',
          type: 'income',
          amount: '5000.00',
          currency: 'ETB',
          category: 'borrowed_money',
          note: 'From Hana',
          confidence: 0.96,
        },
      ],
    });
    const transaction = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id } });
    expect(transaction).toMatchObject({
      kind: 'LOAN_RECEIVED',
      type: 'INCOME',
      category: 'borrowed_money',
      note: 'From Hana',
    });
  });

  it('rejects a duplicate source message without a second row or metric', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[0]);
    await createProcessedUpdate(updateIds[1]);
    const base = {
      userId: user.id,
      sourceMessageId: 7002,
      messageAt: new Date(),
      model: 'rule-based-v1',
      promptVersion: 'phase3-v1',
      transactions: [
        {
          type: 'income' as const,
          amount: '15000.00',
          currency: 'ETB' as const,
          category: 'salary' as const,
          confidence: 0.95,
        },
      ],
    };
    await repository.logText({
      ...base,
      sourceUpdateId: Number(updateIds[0]),
      processedUpdateId: Number(updateIds[0]),
    });
    await expect(
      repository.logText({
        ...base,
        sourceUpdateId: Number(updateIds[1]),
        processedUpdateId: Number(updateIds[1]),
      }),
    ).rejects.toThrow();

    expect(await prisma.transactionGroup.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.transaction.count({ where: { userId: user.id } })).toBe(1);
    expect(
      await prisma.event.count({ where: { userId: user.id, eventType: 'transaction_logged' } }),
    ).toBe(1);
    expect(
      await prisma.processedUpdate
        .findUniqueOrThrow({
          where: { telegramUpdateId: updateIds[1] },
        })
        .then((update) => update.status),
    ).toBe('PROCESSING');
  });

  it('commits a multi-transaction group and soft-undoes it exactly once', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[0]);
    await createProcessedUpdate(updateIds[1]);
    const result = await repository.logText({
      userId: user.id,
      sourceUpdateId: Number(updateIds[0]),
      sourceMessageId: 7003,
      processedUpdateId: Number(updateIds[0]),
      messageAt: new Date(),
      model: 'gemini-2.5-flash',
      promptVersion: 'gemini-financial-v1',
      transactions: [
        {
          type: 'expense',
          amount: '200.00',
          currency: 'ETB',
          category: 'food',
          confidence: 0.95,
        },
        {
          type: 'expense',
          amount: '100.00',
          currency: 'ETB',
          category: 'transport',
          confidence: 0.95,
        },
      ],
    });
    expect(result.firstLog).toBe(true);
    expect(await prisma.transaction.count({ where: { groupId: result.groupId } })).toBe(2);
    const interaction = await prisma.pendingInteraction.create({
      data: {
        userId: user.id,
        kind: 'CONFIRM_UNDO',
        payload: { kind: 'confirm_undo', groupId: result.groupId },
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await repository.undo(user.id, result.groupId, interaction.id, Number(updateIds[1]));
    expect(
      await prisma.transactionGroup
        .findUniqueOrThrow({ where: { id: result.groupId } })
        .then((group) => group.undoneAt),
    ).not.toBeNull();
    expect(await prisma.transaction.count({ where: { groupId: result.groupId } })).toBe(2);
    await expect(
      repository.undo(user.id, result.groupId, interaction.id, Number(updateIds[1])),
    ).rejects.toThrow('INTERACTION_NOT_PENDING');
    expect(
      await prisma.event.count({
        where: { userId: user.id, eventType: 'transaction_group_undone' },
      }),
    ).toBe(1);
  });

  it('persists voice provenance without retaining a transcript', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[0]);
    const result = await repository.logText({
      userId: user.id,
      sourceUpdateId: Number(updateIds[0]),
      sourceMessageId: 7004,
      processedUpdateId: Number(updateIds[0]),
      messageAt: new Date(),
      model: 'gemini-2.5-flash',
      promptVersion: 'gemini-financial-v1',
      source: 'VOICE',
      sttProvider: 'hasab',
      sttModel: 'hasab-transcription-v1',
      transactions: [
        {
          type: 'expense',
          amount: '250.00',
          currency: 'ETB',
          category: 'food',
          confidence: 0.95,
        },
      ],
    });
    const group = await prisma.transactionGroup.findUniqueOrThrow({
      where: { id: result.groupId },
    });
    expect(group).toMatchObject({
      source: 'VOICE',
      sttProvider: 'hasab',
      sttModel: 'hasab-transcription-v1',
      extractionModel: 'gemini-2.5-flash',
      promptVersion: 'gemini-financial-v1',
      rawTranscript: null,
      transcriptExpiresAt: null,
    });
    const metric = await prisma.event.findFirstOrThrow({
      where: { userId: user.id, eventType: 'transaction_logged' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(metric.metadata).toEqual({
      source: 'voice',
      transactionCount: 1,
      kindCounts: { expense: 1 },
      otherCount: 0,
    });
  });

  it('persists a confirmed receipt as receipt provenance without image data', async () => {
    const user = await createActiveUser();
    await createProcessedUpdate(updateIds[0]);
    const result = await repository.logText({
      userId: user.id,
      sourceUpdateId: Number(updateIds[0]),
      sourceMessageId: 7005,
      processedUpdateId: Number(updateIds[0]),
      messageAt: new Date(),
      model: 'gemini-test',
      promptVersion: 'receipt-v1',
      source: 'RECEIPT',
      transactions: [
        {
          type: 'expense',
          amount: '350.00',
          currency: 'ETB',
          category: 'food',
          note: 'test groceries',
          confidence: 0.95,
        },
      ],
    });
    const group = await prisma.transactionGroup.findUniqueOrThrow({
      where: { id: result.groupId },
    });
    expect(group).toMatchObject({
      source: 'RECEIPT',
      extractionModel: 'gemini-test',
      promptVersion: 'receipt-v1',
      rawTranscript: null,
    });
    const metric = await prisma.event.findFirstOrThrow({
      where: { userId: user.id, eventType: 'transaction_logged' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(metric.metadata).toEqual({
      source: 'receipt',
      transactionCount: 1,
      kindCounts: { expense: 1 },
      otherCount: 0,
    });
  });
});

async function createActiveUser() {
  return prisma.user.create({
    data: {
      telegramId,
      status: 'ACTIVE',
      consentVersion: 'test-v1',
      consentAt: new Date(),
    },
  });
}

async function createProcessedUpdate(updateId: bigint) {
  await prisma.processedUpdate.create({
    data: {
      telegramUpdateId: updateId,
      updateType: 'message',
      status: 'PROCESSING',
      attemptCount: 1,
    },
  });
}
