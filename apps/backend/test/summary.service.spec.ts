import { describe, expect, it, vi } from 'vitest';

import type { SummaryRepository } from '../src/summaries/summary.repository.js';
import { SummaryService } from '../src/summaries/summary.service.js';
import type { SummaryTransactionRow } from '../src/summaries/summary.types.js';

const row = (
  id: string,
  type: 'income' | 'expense',
  amount: string,
  category: SummaryTransactionRow['category'],
): SummaryTransactionRow => ({
  id,
  type,
  kind: type,
  amount,
  category,
  occurredAt: new Date(`2026-08-03T1${id}:00:00.000Z`),
});

describe('SummaryService', () => {
  it('calculates exact totals, top three, comparison, largest expense, and insight', async () => {
    const current = [
      row('0', 'income', '5000.00', 'salary'),
      row('1', 'expense', '600.00', 'food'),
      row('2', 'expense', '450.00', 'transport'),
      row('3', 'expense', '300.00', 'utilities'),
      row('4', 'expense', '50.00', 'health'),
    ];
    const previous = [row('5', 'expense', '1600.00', 'rent')];
    const listActiveTransactions = vi
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(previous);
    const service = new SummaryService({ listActiveTransactions } as unknown as SummaryRepository);

    const summary = await service.get('user-1', 'week', new Date('2026-08-03T20:30:00.000Z'));

    expect(summary.incomeCents).toBe(500_000n);
    expect(summary.expenseCents).toBe(140_000n);
    expect(summary.netCents).toBe(360_000n);
    expect(summary.transactionCount).toBe(5);
    expect(summary.categories.map((category) => category.category)).toEqual([
      'food',
      'transport',
      'utilities',
    ]);
    expect(summary.categories[0]?.percentageHundredths).toBe(4_286n);
    expect(summary.largestExpense?.id).toBe('1');
    expect(summary.comparison).toEqual({
      direction: 'decreased',
      amountCents: 20_000n,
      percentageHundredths: 1_250n,
    });
    expect(summary.insight).toEqual({ kind: 'top_category', category: 'food' });
  });

  it('uses fixed category order for ties and never divides by zero', async () => {
    const listActiveTransactions = vi
      .fn()
      .mockResolvedValueOnce([
        row('1', 'expense', '100.00', 'transport'),
        row('2', 'expense', '100.00', 'food'),
      ])
      .mockResolvedValueOnce([]);
    const service = new SummaryService({ listActiveTransactions } as unknown as SummaryRepository);
    const summary = await service.get('user-1', 'today');
    expect(summary.categories.map((category) => category.category)).toEqual(['food', 'transport']);
    expect(summary.comparison).toEqual({
      direction: 'no_prior',
      amountCents: 20_000n,
      percentageHundredths: null,
    });
  });

  it('returns a stable empty summary', async () => {
    const listActiveTransactions = vi.fn().mockResolvedValue([]);
    const service = new SummaryService({ listActiveTransactions } as unknown as SummaryRepository);
    const summary = await service.get('user-1', 'month');
    expect(summary).toMatchObject({
      incomeCents: 0n,
      expenseCents: 0n,
      netCents: 0n,
      transactionCount: 0,
      categories: [],
      largestExpense: null,
      insight: { kind: 'no_activity' },
      comparison: { direction: 'unchanged' },
    });
  });

  it('separates earned activity from cash movement and handles recovery-heavy periods', async () => {
    const current: SummaryTransactionRow[] = [
      row('0', 'income', '10000.00', 'salary'),
      { ...row('1', 'income', '5000.00', 'borrowed_money'), kind: 'loan_received' },
      row('2', 'expense', '3000.00', 'food_groceries'),
      { ...row('3', 'expense', '1000.00', 'debt_repayment'), kind: 'loan_repayment' },
      { ...row('4', 'income', '300.00', 'refund'), kind: 'refund' },
      { ...row('5', 'income', '400.00', 'reimbursement'), kind: 'reimbursement' },
    ];
    const listActiveTransactions = vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce([]);
    const summary = await new SummaryService({
      listActiveTransactions,
    } as unknown as SummaryRepository).get('user-1', 'month');

    expect(summary).toMatchObject({
      earnedIncomeCents: 1_000_000n,
      grossOrdinaryExpenseCents: 300_000n,
      recoveredExpenseCents: 70_000n,
      ordinaryExpenseCents: 230_000n,
      earnedNetCents: 770_000n,
      cashInflowCents: 1_570_000n,
      cashOutflowCents: 400_000n,
      cashFlowNetCents: 1_170_000n,
    });
    expect(summary.specialMovements).toEqual([
      { kind: 'loan_received', amountCents: 500_000n },
      { kind: 'loan_repayment', amountCents: 100_000n },
      { kind: 'refund', amountCents: 30_000n },
      { kind: 'reimbursement', amountCents: 40_000n },
    ]);
  });

  it('keeps a refund-heavy period exact without unsigned underflow', async () => {
    const current: SummaryTransactionRow[] = [
      row('0', 'expense', '100.00', 'food_groceries'),
      { ...row('1', 'income', '250.00', 'refund'), kind: 'refund' },
    ];
    const listActiveTransactions = vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce([]);
    const summary = await new SummaryService({
      listActiveTransactions,
    } as unknown as SummaryRepository).get('user-1', 'week');

    expect(summary.ordinaryExpenseCents).toBe(-15_000n);
    expect(summary.earnedNetCents).toBe(15_000n);
    expect(summary.cashFlowNetCents).toBe(15_000n);
    expect(summary.comparison).toEqual({
      direction: 'recovery_exceeded',
      amountCents: 15_000n,
      percentageHundredths: null,
    });
  });
});
