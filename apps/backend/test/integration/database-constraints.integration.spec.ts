import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  Language,
  PrismaClient,
  FinancialEventKind,
  TransactionSource,
  TransactionType,
  UserStatus,
} from '../../src/generated/prisma/client.js';

const testTelegramId = 9_000_000_001n;
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    max: 2,
  }),
});

describe('database domain constraints', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: {
        telegramId: testTelegramId,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        telegramId: testTelegramId,
      },
    });
    await prisma.$disconnect();
  });

  it('accepts a valid active user and expense transaction', async () => {
    const user = await prisma.user.create({
      data: {
        telegramId: testTelegramId,
        language: Language.AM,
        status: UserStatus.ACTIVE,
        consentVersion: 'test-v1',
        consentAt: new Date(),
      },
    });
    const group = await prisma.transactionGroup.create({
      data: {
        userId: user.id,
        telegramUpdateId: 1001n,
        telegramMessageId: 501n,
        source: TransactionSource.TEXT,
        messageAt: new Date(),
        extractionModel: 'fake',
        promptVersion: 'test-v1',
      },
    });

    const transaction = await prisma.transaction.create({
      data: {
        groupId: group.id,
        userId: user.id,
        type: TransactionType.EXPENSE,
        kind: 'EXPENSE',
        amountEtb: '250.00',
        category: 'food',
        note: 'lunch',
        occurredAt: new Date(),
      },
    });

    expect(transaction.amountEtb.toFixed(2)).toBe('250.00');
  });

  it('rejects an amount outside the MVP range', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: {
        telegramId: testTelegramId,
      },
    });
    const group = await prisma.transactionGroup.create({
      data: {
        userId: user.id,
        telegramUpdateId: 1003n,
        telegramMessageId: 503n,
        source: TransactionSource.TEXT,
        messageAt: new Date(),
        extractionModel: 'fake',
        promptVersion: 'test-v1',
      },
    });

    await expect(
      prisma.transaction.create({
        data: {
          groupId: group.id,
          userId: user.id,
          type: TransactionType.EXPENSE,
          kind: 'EXPENSE',
          amountEtb: '1000000.00',
          category: 'other',
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it('persists special-kind transactions in PostgreSQL', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: testTelegramId } });
    const group = await prisma.transactionGroup.create({
      data: {
        userId: user.id,
        telegramUpdateId: 1004n,
        telegramMessageId: 504n,
        source: TransactionSource.TEXT,
        messageAt: new Date(),
        extractionModel: 'gemini-test',
        promptVersion: 'classification-v1',
      },
    });
    const loan = await prisma.transaction.create({
      data: {
        groupId: group.id,
        userId: user.id,
        type: TransactionType.INCOME,
        kind: FinancialEventKind.LOAN_RECEIVED,
        amountEtb: '5000.00',
        category: 'borrowed_money',
        occurredAt: new Date(),
      },
    });
    expect(loan.kind).toBe(FinancialEventKind.LOAN_RECEIVED);
  });
});
