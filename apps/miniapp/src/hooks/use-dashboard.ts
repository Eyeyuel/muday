import { useEffect, useState } from 'react';

import { fetchDashboard } from '../api/dashboard-api';
import {
  DashboardApiError,
  type DashboardFilterOptions,
  type DashboardPeriod,
  type DashboardResponse,
} from '../api/dashboard-types';

const cacheMap = new Map<string, DashboardResponse>();

function cacheKey(period: DashboardPeriod, filters?: DashboardFilterOptions): string {
  return `${period}:${filters?.startDate ?? ''}:${filters?.endDate ?? ''}:${filters?.category ?? ''}:${filters?.source ?? ''}:${filters?.search ?? ''}`;
}

export function useDashboard(
  period: DashboardPeriod,
  filters?: DashboardFilterOptions,
  enabled = true,
) {
  const key = cacheKey(period, filters);
  const [state, setState] = useState<{
    data?: DashboardResponse;
    error?: DashboardApiError;
    loading: boolean;
    loadingMore: boolean;
    loadMoreError: boolean;
    development: boolean;
  }>(() => {
    const cached = cacheMap.get(key);
    return {
      data: cached,
      loading: !cached,
      loadingMore: false,
      loadMoreError: false,
      development: false,
    };
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, loading: false, loadingMore: false }));
      return;
    }
    const controller = new AbortController();
    const cached = cacheMap.get(key);
    setState((current) => ({
      ...current,
      data: cached ?? current.data,
      loading: !cached && !current.data,
      error: undefined,
      loadMoreError: false,
    }));

    void fetchDashboard(period, filters, undefined, 20, controller.signal)
      .then(({ data, development }) => {
        if (controller.signal.aborted) return;
        cacheMap.set(key, data);
        setState({
          data,
          loading: false,
          loadingMore: false,
          loadMoreError: false,
          development,
        });
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error as { name?: string })?.name === 'AbortError'
        ) {
          return;
        }
        setState((current) => ({
          ...current,
          error: error instanceof DashboardApiError ? error : new DashboardApiError('network'),
          loading: false,
          loadingMore: false,
          development: false,
        }));
      });

    return () => controller.abort();
  }, [enabled, period, key, revision]);

  const loadMore = async () => {
    if (state.loadingMore || !state.data?.hasMore || !state.data?.nextCursor) return;
    setState((current) => ({ ...current, loadingMore: true, loadMoreError: false }));
    try {
      const { data: nextPage } = await fetchDashboard(period, filters, state.data.nextCursor, 20);
      setState((current) => {
        if (!current.data) return current;
        const currentData = current.data;
        const seenIds = new Set(currentData.recentTransactions.map((t) => t.id).filter(Boolean));
        const uniqueNext = nextPage.recentTransactions.filter((t) => !t.id || !seenIds.has(t.id));
        const updatedTransactions = [...currentData.recentTransactions, ...uniqueNext];
        const updatedData: DashboardResponse = {
          ...currentData,
          recentTransactions: updatedTransactions,
          nextCursor: nextPage.nextCursor,
          hasMore: nextPage.hasMore,
        };
        cacheMap.set(key, updatedData);
        return {
          ...current,
          data: updatedData,
          loadingMore: false,
          loadMoreError: false,
        };
      });
    } catch {
      setState((current) => ({ ...current, loadingMore: false, loadMoreError: true }));
    }
  };

  return {
    ...state,
    loadMore,
    retry: () => {
      cacheMap.clear();
      setRevision((value) => value + 1);
    },
  };
}
