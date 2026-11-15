import { describe, expect, it, vi } from 'vitest';

import { I18nService } from '../src/i18n/i18n.service.js';
import { NotificationMessageService } from '../src/notifications/notification-message.service.js';
import { SummaryFormatterService } from '../src/summaries/summary-formatter.service.js';
import type { SummaryService } from '../src/summaries/summary.service.js';
import type { FinancialSummary } from '../src/summaries/summary.types.js';

const baseSummary: FinancialSummary = {
  period: 'today',
  range: { start: new Date(), end: new Date() },
  incomeCents: 500_000n,
  expenseCents: 135_000n,
  netCents: 365_000n,
  earnedIncomeCents: 500_000n,
  grossOrdinaryExpenseCents: 135_000n,
  recoveredExpenseCents: 0n,
  ordinaryExpenseCents: 135_000n,
  earnedNetCents: 365_000n,
  cashInflowCents: 500_000n,
  cashOutflowCents: 135_000n,
  cashFlowNetCents: 365_000n,
  specialMovements: [],
  transactionCount: 4,
  categories: [{ category: 'food', amountCents: 60_000n, percentageHundredths: 4_444n }],
  largestExpense: {
    id: 'expense-1',
    type: 'expense',
    kind: 'expense',
    amount: '600.00',
    category: 'food',
    occurredAt: new Date(),
  },
  comparison: { direction: 'decreased', amountCents: 25_000n, percentageHundredths: 1_563n },
  insight: { kind: 'top_category', category: 'food' },
};

describe('NotificationMessageService', () => {
  const i18n = new I18nService();

  it('rotates morning templates deterministically by EAT date', async () => {
    const service = new NotificationMessageService(
      { get: vi.fn() } as unknown as SummaryService,
      new SummaryFormatterService(i18n),
      i18n,
    );
    const first = await service.build(
      'user-1',
      'morning_reminder',
      'en',
      new Date('2026-08-03T06:00:00.000Z'),
    );
    const same = await service.build(
      'user-1',
      'morning_reminder',
      'en',
      new Date('2026-08-03T18:00:00.000Z'),
    );
    expect(first).toBe(same);
    expect(first).toContain('☀️');
  });

  it('uses a gentle empty night state', async () => {
    const get = vi.fn().mockResolvedValue({ ...baseSummary, transactionCount: 0 });
    const service = new NotificationMessageService(
      { get } as unknown as SummaryService,
      new SummaryFormatterService(i18n),
      i18n,
    );
    await expect(service.build('user-1', 'night_status', 'en')).resolves.toContain(
      'Nothing was recorded today',
    );
  });

  it('builds weekly and completed-month summaries from the shared service', async () => {
    const get = vi.fn().mockResolvedValue(baseSummary);
    const service = new NotificationMessageService(
      { get } as unknown as SummaryService,
      new SummaryFormatterService(i18n),
      i18n,
    );
    await expect(service.build('user-1', 'weekly_summary', 'en')).resolves.toContain(
      'This week so far',
    );
    await expect(
      service.build('user-1', 'monthly_summary', 'en', new Date('2026-08-01T06:00:00.000Z')),
    ).resolves.toContain('Largest expense: Food - 600.00 ETB');
    expect(get).toHaveBeenLastCalledWith('user-1', 'month', new Date('2026-07-31T06:00:00.000Z'));
  });
});
