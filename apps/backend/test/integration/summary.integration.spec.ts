import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { SummaryRepository } from '../../src/summaries/summary.repository.js';
import { SummaryService } from '../../src/summaries/summary.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const telegramIdA = 9_500_000_001n;
const telegramIdB = 9_500_000_002n;
const telegramIds: bigint[] = [telegramIdA, telegramIdB];
const service = new SummaryService(new SummaryRepository(prisma as unknown as PrismaService));

describe('summary integration', () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    const first = await prisma.user.create({
      data: {
        telegramId: telegramIdA,
        status: 'ACTIVE',
        language: 'EN',
        consentVersion: 'summary-test-v1',
        consentAt: new Date(),
      },
    });
    const second = await prisma.user.create({
      data: {
        telegramId: telegramIdB,
        status: 'ACTIVE',
        language: 'AM',
        consentVersion: 'summary-test-v1',
        consentAt: new Date(),
      },
    });
    userA = first.id;
    userB = second.id;

    await createGroup(userA, 7_100_001n, false, [
      ['INCOME', '5000.00', 'SALARY'],
      ['EXPENSE', '600.00', 'FOOD'],
      ['EXPENSE', '450.00', 'TRANSPORT'],
      ['EXPENSE', '300.00', 'UTILITIES'],
    ]);
    await createGroup(userA, 7_100_002n, true, [['EXPENSE', '999.00', 'OTHER']]);
    await createGroup(
      userA,
      7_100_003n,
      false,
      [['EXPENSE', '1600.00', 'RENT']],
      new Date('2026-07-28T09:00:00.000Z'),
    );
    await createGroup(userB, 7_200_001n, false, [['EXPENSE', '9999.00', 'OTHER']]);
    await createSpecialGroup(userA, 7_100_004n, [
      ['LOAN_RECEIVED', 'INCOME', '5000.00', 'BORROWED_MONEY'],
      ['LOAN_REPAYMENT', 'EXPENSE', '1000.00', 'DEBT_REPAYMENT'],
      ['REFUND', 'INCOME', '300.00', 'REFUND'],
      ['REIMBURSEMENT', 'INCOME', '200.00', 'REIMBURSEMENT'],
    ]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    await prisma.$disconnect();
  });

  it('matches reviewed fixtures while excluding undone and other-user transactions', async () => {
    const summary = await service.get(userA, 'week', new Date('2026-08-03T20:30:00.000Z'));
    expect(summary.incomeCents).toBe(500_000n);
    expect(summary.expenseCents).toBe(85_000n);
    expect(summary.netCents).toBe(415_000n);
    expect(summary.transactionCount).toBe(8);
    expect(summary.cashInflowCents).toBe(1_050_000n);
    expect(summary.cashOutflowCents).toBe(235_000n);
    expect(summary.cashFlowNetCents).toBe(815_000n);
    expect(summary.specialMovements).toEqual([
      { kind: 'loan_received', amountCents: 500_000n },
      { kind: 'loan_repayment', amountCents: 100_000n },
      { kind: 'refund', amountCents: 30_000n },
      { kind: 'reimbursement', amountCents: 20_000n },
    ]);
    expect(summary.categories.map((category) => [category.category, category.amountCents])).toEqual(
      [
        ['food', 60_000n],
        ['transport', 45_000n],
        ['utilities', 30_000n],
      ],
    );
    expect(summary.largestExpense?.amount).toBe('600.00');
    expect(summary.comparison).toEqual({
      direction: 'decreased',
      amountCents: 75_000n,
      percentageHundredths: 4_688n,
    });
  });

  it('isolates summaries for a second user', async () => {
    const summary = await service.get(userB, 'week', new Date('2026-08-03T20:30:00.000Z'));
    expect(summary.incomeCents).toBe(0n);
    expect(summary.expenseCents).toBe(999_900n);
    expect(summary.transactionCount).toBe(1);
  });
});

async function createGroup(
  userId: string,
  messageId: bigint,
  undone: boolean,
  transactions: Array<
    ['INCOME' | 'EXPENSE', string, 'SALARY' | 'FOOD' | 'TRANSPORT' | 'UTILITIES' | 'RENT' | 'OTHER']
  >,
  occurredAt = new Date('2026-08-03T09:00:00.000Z'),
): Promise<void> {
  await prisma.transactionGroup.create({
    data: {
      userId,
      telegramUpdateId: messageId,
      telegramMessageId: messageId,
      source: 'TEXT',
      messageAt: occurredAt,
      extractionModel: 'integration-fixture',
      promptVersion: 'test-v1',
      ...(undone ? { undoneAt: new Date('2026-08-03T10:00:00.000Z') } : {}),
      transactions: {
        create: transactions.map(([type, amountEtb, category]) => ({
          userId,
          type,
          kind: type,
          amountEtb,
          category,
          occurredAt,
        })),
      },
    },
  });
}

async function createSpecialGroup(
  userId: string,
  messageId: bigint,
  transactions: Array<
    [
      'LOAN_RECEIVED' | 'LOAN_REPAYMENT' | 'REFUND' | 'REIMBURSEMENT',
      'INCOME' | 'EXPENSE',
      string,
      'BORROWED_MONEY' | 'DEBT_REPAYMENT' | 'REFUND' | 'REIMBURSEMENT',
    ]
  >,
): Promise<void> {
  const occurredAt = new Date('2026-08-03T11:00:00.000Z');
  await prisma.transactionGroup.create({
    data: {
      userId,
      telegramUpdateId: messageId,
      telegramMessageId: messageId,
      source: 'TEXT',
      messageAt: occurredAt,
      extractionModel: 'integration-fixture',
      promptVersion: 'test-v1',
      transactions: {
        create: transactions.map(([kind, type, amountEtb, category]) => ({
          userId,
          kind,
          type,
          amountEtb,
          category,
          occurredAt,
        })),
      },
    },
  });
}
