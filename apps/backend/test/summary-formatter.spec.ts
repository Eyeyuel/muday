import { describe, expect, it } from 'vitest';

import { I18nService } from '../src/i18n/i18n.service.js';
import { SummaryFormatterService } from '../src/summaries/summary-formatter.service.js';
import type { FinancialSummary } from '../src/summaries/summary.types.js';

const summary: FinancialSummary = {
  period: 'week',
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
  largestExpense: null,
  comparison: { direction: 'decreased', amountCents: 25_000n, percentageHundredths: 1_563n },
  insight: { kind: 'top_category', category: 'food' },
};

describe('SummaryFormatterService', () => {
  const formatter = new SummaryFormatterService(new I18nService());

  it('formats a complete English summary', () => {
    const message = formatter.format(summary, 'en');
    expect(message).toContain('This Week');
    expect(message).toContain('Earned income: 5,000.00 ETB');
    expect(message).toContain('Food - 600.00 ETB (44.44%)');
    expect(message).toContain('decreased by 250.00 ETB (15.63%)');
  });

  it('formats the same values in Amharic', () => {
    const message = formatter.format(summary, 'am');
    expect(message).toContain('ይህ ሳምንት');
    expect(message).toContain('የተገኘ ገቢ፦ 5,000.00 ብር');
    expect(message).toContain('Food - 600.00 ብር (44.44%)');
  });
});
