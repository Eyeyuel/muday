import { describe, expect, it, vi } from 'vitest';
import { validate } from 'class-validator';

import type { DashboardAccessService } from '../src/dashboard/dashboard-access.service.js';
import { DashboardQueryDto } from '../src/dashboard/dashboard.dto.js';
import type { DashboardRepository } from '../src/dashboard/dashboard.repository.js';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import type { SummaryService } from '../src/summaries/summary.service.js';

describe('DashboardService', () => {
  it('accepts valid today, week, month, all, and custom query values', async () => {
    for (const period of ['today', 'week', 'month', 'all', 'custom']) {
      const query = new DashboardQueryDto();
      query.period = period as 'today' | 'week' | 'month' | 'all' | 'custom';
      expect(await validate(query)).toHaveLength(0);
    }
    const invalid = new DashboardQueryDto();
    invalid.period = 'year' as 'week';
    expect(await validate(invalid)).toHaveLength(1);
  });

  it('maps shared summaries and only safe recent transaction fields', async () => {
    const range = {
      start: new Date('2026-08-03T21:00:00.000Z'),
      end: new Date('2026-08-10T21:00:00.000Z'),
    };
    const summaries = {
      get: vi.fn().mockResolvedValue({
        range,
        incomeCents: 1500000n,
        expenseCents: 55000n,
        netCents: 1445000n,
        earnedIncomeCents: 1500000n,
        ordinaryExpenseCents: 55000n,
        earnedNetCents: 1445000n,
        cashInflowCents: 1500000n,
        cashOutflowCents: 55000n,
        cashFlowNetCents: 1445000n,
        specialMovements: [],
        categories: [{ category: 'food', amountCents: 25000n, percentageHundredths: 4545n }],
      }),
    } as unknown as SummaryService;
    const listRecent = vi.fn().mockResolvedValue([
      {
        id: 'tx-123',
        kind: 'EXPENSE',
        type: 'EXPENSE',
        amountEtb: { toFixed: () => '250.00' },
        category: 'FOOD',
        note: 'lunch',
        platform: 'telebirr',
        group: { source: 'TEXT' },
        occurredAt: new Date('2026-08-04T10:00:00.000Z'),
        secret: 'must-not-leak',
      },
    ]);
    const countInPeriod = vi.fn().mockResolvedValue({
      totalCount: 1,
      uncategorizedCount: 0,
      bankCounts: {
        telebirr: 1,
        cbe: 0,
        abyssinia: 0,
        awash: 0,
        dashen: 0,
        coop: 0,
        wegagen: 0,
        hibret: 0,
        zemen: 0,
      },
    });
    const repository = { listRecent, countInPeriod } as unknown as DashboardRepository;
    const access = { check: vi.fn() } as unknown as DashboardAccessService;
    const result = await new DashboardService(summaries, repository, access).get(
      'user-a',
      'week',
      'en',
    );
    expect(result.locale).toBe('en');
    expect(result.bankCounts).toEqual({
      telebirr: 1,
      cbe: 0,
      abyssinia: 0,
      awash: 0,
      dashen: 0,
      coop: 0,
      wegagen: 0,
      hibret: 0,
      zemen: 0,
    });
    expect(result.summary).toEqual({
      incomeEtb: '15000.00',
      expenseEtb: '550.00',
      netEtb: '14450.00',
      earnedIncomeEtb: '15000.00',
      ordinaryExpenseEtb: '550.00',
      earnedNetEtb: '14450.00',
      cashInflowEtb: '15000.00',
      cashOutflowEtb: '550.00',
      cashFlowNetEtb: '14450.00',
    });
    expect(result.recentTransactions).toEqual([
      {
        id: 'tx-123',
        kind: 'expense',
        type: 'expense',
        amountEtb: '250.00',
        category: 'food',
        note: 'lunch',
        platform: 'telebirr',
        source: 'text',
        rawTranscript: null,
        receiptImagePath: null,
        occurredAt: '2026-08-04T10:00:00.000Z',
      },
    ]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(listRecent).toHaveBeenCalledWith('user-a', range, 20, undefined, undefined);
  });

  it('delegates findMatchCandidates and linkCandidate to repository', async () => {
    const findMatchCandidates = vi.fn().mockResolvedValue([
      {
        id: 'tx-match-1',
        targetType: 'transaction',
        amountEtb: '250.00',
        type: 'expense',
        category: 'uncategorized',
        note: 'Telebirr payment',
        bankSource: 'TELEBIRR',
        occurredAt: '2026-08-29T10:00:00.000Z',
      },
    ]);
    const linkCandidate = vi.fn().mockResolvedValue({
      id: 'tx-match-1',
      amountEtb: '250.00',
      category: 'food_groceries',
      type: 'expense',
      note: 'Telebirr payment (Lunch with team)',
      occurredAt: '2026-08-29T10:00:00.000Z',
      linked: true,
    });

    const repository = { findMatchCandidates, linkCandidate } as unknown as DashboardRepository;
    const summaries = {} as unknown as SummaryService;
    const access = { check: vi.fn() } as unknown as DashboardAccessService;

    const service = new DashboardService(summaries, repository, access);

    const candidates = await service.findMatchCandidates('user-1', { amountEtb: '250.00' });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.bankSource).toBe('TELEBIRR');
    expect(findMatchCandidates).toHaveBeenCalledWith('user-1', { amountEtb: '250.00' });

    const linked = await service.linkCandidate('user-1', {
      targetId: 'tx-match-1',
      targetType: 'transaction',
      category: 'food_groceries',
      note: 'Lunch with team',
    });
    expect(linked.linked).toBe(true);
    expect(linked.category).toBe('food_groceries');
    expect(linkCandidate).toHaveBeenCalledWith('user-1', {
      targetId: 'tx-match-1',
      targetType: 'transaction',
      category: 'food_groceries',
      note: 'Lunch with team',
    });
  });
});
