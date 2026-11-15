import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboard } from '../src/hooks/use-dashboard';

const firstPage = {
  locale: 'en',
  user: { firstName: 'Test', lastName: null, username: null },
  period: 'month',
  range: { start: '2026-08-01T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' },
  summary: {
    incomeEtb: '0.00',
    expenseEtb: '10.00',
    netEtb: '-10.00',
    earnedIncomeEtb: '0.00',
    ordinaryExpenseEtb: '10.00',
    earnedNetEtb: '-10.00',
    cashInflowEtb: '0.00',
    cashOutflowEtb: '10.00',
    cashFlowNetEtb: '-10.00',
  },
  expenseCategories: [],
  specialMovements: [],
  recentTransactions: [
    {
      type: 'expense',
      kind: 'expense',
      amountEtb: '10.00',
      category: 'food',
      note: 'test',
      occurredAt: '2026-08-01T10:00:00.000Z',
    },
  ],
  nextCursor: 'next-page',
  hasMore: true,
};

describe('useDashboard pagination', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ALLOW_LOCAL_DEV_AUTH', 'true');
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3001');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('exposes a retryable error when the next page fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useDashboard('month', { search: 'pagination-error-test' }));
    await waitFor(() => expect(result.current.data).toBeDefined());

    await act(async () => result.current.loadMore());

    expect(result.current.loadMoreError).toBe(true);
    expect(result.current.data?.recentTransactions).toHaveLength(1);
  });
});
