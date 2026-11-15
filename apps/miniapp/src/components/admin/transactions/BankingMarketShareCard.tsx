import { useState, useEffect } from 'react';
import { Landmark, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { AdminBankingAnalyticsResponse } from '../../../api/admin-types';
import { fetchAdminBankingAnalytics } from '../../../api/admin-api';
import type { Locale } from '../../../api/dashboard-types';
import { BankLogo } from '../BankLogo';

export function BankingMarketShareCard({
  locale,
  onSelectPlatform,
}: {
  locale: Locale;
  onSelectPlatform?: (platform: string) => void;
}) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<AdminBankingAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!data) {
      setLoading(true);
    } else {
      setIsFetching(true);
    }

    fetchAdminBankingAnalytics(timeRange)
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Failed to load banking analytics');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setIsFetching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [timeRange]);

  const formatETB = (val: number) => {
    return `${new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(val)} ETB`;
  };

  const getRailColor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('telebirr'))
      return {
        bar: 'bg-[#06b6d4]',
        text: 'text-[#06b6d4]',
        border: 'border-[#06b6d4]/30',
        bg: 'bg-[#06b6d4]/10',
      };
    if (p.includes('cbe'))
      return {
        bar: 'bg-[#8b5cf6]',
        text: 'text-[#8b5cf6]',
        border: 'border-[#8b5cf6]/30',
        bg: 'bg-[#8b5cf6]/10',
      };
    if (p.includes('dashen') || p.includes('amole'))
      return {
        bar: 'bg-[#3b82f6]',
        text: 'text-[#3b82f6]',
        border: 'border-[#3b82f6]/30',
        bg: 'bg-[#3b82f6]/10',
      };
    if (p.includes('awash'))
      return {
        bar: 'bg-[#f59e0b]',
        text: 'text-[#f59e0b]',
        border: 'border-[#f59e0b]/30',
        bg: 'bg-[#f59e0b]/10',
      };
    if (p.includes('abyssinia') || p.includes('boa'))
      return {
        bar: 'bg-[#ef4444]',
        text: 'text-[#ef4444]',
        border: 'border-[#ef4444]/30',
        bg: 'bg-[#ef4444]/10',
      };
    if (p.includes('cash'))
      return {
        bar: 'bg-[#10b981]',
        text: 'text-[#10b981]',
        border: 'border-[#10b981]/30',
        bg: 'bg-[#10b981]/10',
      };
    return {
      bar: 'bg-[var(--electric-cobalt)]',
      text: 'text-[var(--electric-cobalt)]',
      border: 'border-[var(--electric-cobalt)]/30',
      bg: 'bg-[var(--electric-cobalt)]/10',
    };
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-all">
      {/* 1. Header with Time Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]">
              <Landmark className="size-4" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--ink-charcoal)] flex items-center gap-2">
              <span>Ethiopian Banking Rails Market Share</span>
              {isFetching ? (
                <span className="size-3 border-2 border-[var(--electric-cobalt)] border-t-transparent rounded-full animate-spin shrink-0" />
              ) : null}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--slate-gray)]">
            Aggregated consumer settlement volume across Telebirr, CBE, and private commercial banks
          </p>
        </div>

        {/* Time range pills */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/70 p-1">
          {(
            [
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeRange(t.id)}
              disabled={isFetching}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeRange === t.id
                  ? 'bg-[var(--pure-white)] text-[var(--ink-charcoal)] shadow-xs border border-[var(--border-hairline)]'
                  : 'text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-4 animate-pulse">
          {/* Quick High-Level Metrics Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`metric-skel-${idx}`}
                className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60 space-y-2"
              >
                <div className="h-3 w-24 rounded bg-[var(--surface-ivory)]" />
                <div className="h-6 w-32 rounded bg-[var(--surface-ivory)]" />
                <div className="h-2.5 w-20 rounded bg-[var(--surface-ivory)]" />
              </div>
            ))}
          </div>

          {/* Platform Share Skeleton Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`rail-skel-${idx}`}
                className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-[var(--surface-ivory)]" />
                  <div className="h-4 w-10 rounded bg-[var(--surface-ivory)]" />
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--surface-ivory)]" />
                <div className="pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2">
                  <div className="h-6 rounded bg-[var(--surface-ivory)]" />
                  <div className="h-6 rounded bg-[var(--surface-ivory)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="p-4 text-xs text-rose-500 bg-rose-500/10 rounded-xl">{error}</div>
      ) : data ? (
        <div
          className={`space-y-4 transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}
        >
          {/* Quick High-Level Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
              <span className="text-[11px] font-medium text-[var(--slate-gray)]">
                Total Settled Volume
              </span>
              <p className="mt-1 text-base font-bold text-[var(--ink-charcoal)] tabular-nums">
                {formatETB(data.summary.totalVolumeEtb)}
              </p>
              <span className="text-[10px] text-[var(--steel-gray)]">Logged in timeframe</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
              <span className="text-[11px] font-medium text-[var(--slate-gray)]">
                Total Transactions
              </span>
              <p className="mt-1 text-base font-bold text-[var(--ink-charcoal)] tabular-nums">
                {data.summary.totalCount.toLocaleString()}
              </p>
              <span className="text-[10px] text-[var(--steel-gray)]">Across all users</span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
              <span className="text-[11px] font-medium text-[var(--slate-gray)]">
                Leading Payment Rail
              </span>
              <div className="mt-1 flex items-center gap-1.5 min-w-0">
                <BankLogo platform={data.summary.leadingPlatform} className="size-4" />
                <p className="text-base font-bold text-[var(--electric-cobalt)] truncate">
                  {data.summary.leadingPlatform}
                </p>
              </div>
              <span className="text-[10px] text-[var(--steel-gray)]">
                {data.platformMarketShare[0]?.sharePercentage ?? 0}% volume share
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
              <span className="text-[11px] font-medium text-[var(--slate-gray)]">
                Top Spending Category
              </span>
              <p className="mt-1 text-base font-bold text-[var(--ink-charcoal)] capitalize truncate">
                {data.summary.leadingCategory.replace('_', ' ')}
              </p>
              <span className="text-[10px] text-[var(--steel-gray)]">Highest consumer volume</span>
            </div>
          </div>

          {/* Platform Share Visual Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {data.platformMarketShare.map((p) => {
              const colors = getRailColor(p.platform);
              return (
                <div
                  key={p.platform}
                  onClick={() => onSelectPlatform?.(p.platform)}
                  className="flex flex-col justify-between p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] hover:border-[var(--electric-cobalt)]/40 hover:bg-[var(--surface-ivory)]/40 transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BankLogo
                          platform={p.platform}
                          className="size-5 rounded-md bg-[var(--surface-ivory)] p-0.5 border border-[var(--border-hairline)]"
                        />
                        <h4 className="text-xs font-bold text-[var(--ink-charcoal)] group-hover:text-[var(--electric-cobalt)] transition-colors">
                          {p.platform}
                        </h4>
                      </div>
                      <span className={`text-xs font-bold ${colors.text} tabular-nums`}>
                        {p.sharePercentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-ivory)] border border-[var(--border-hairline)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                        style={{ width: `${Math.max(4, p.sharePercentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-[var(--border-hairline)] grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[10px] text-[var(--slate-gray)] block">
                        Total Volume
                      </span>
                      <span className="font-semibold text-[var(--ink-charcoal)] tabular-nums">
                        {formatETB(p.volumeEtb)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--slate-gray)] block">Avg Ticket</span>
                      <span className="font-semibold text-[var(--ink-charcoal)] tabular-nums">
                        {formatETB(p.avgTicketSizeEtb)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--slate-gray)] block">
                        Transactions
                      </span>
                      <span className="font-medium text-[var(--ink-charcoal)] tabular-nums">
                        {p.count} txs
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[var(--slate-gray)] block">
                        Inflow / Outflow
                      </span>
                      <div className="flex items-center gap-1 font-medium text-[var(--ink-charcoal)] tabular-nums">
                        <span className="text-[#10b981] inline-flex items-center">
                          <ArrowDownRight className="size-2.5" />
                          {p.incomeCount}
                        </span>
                        <span className="text-[var(--steel-gray)]">/</span>
                        <span className="text-[#ef4444] inline-flex items-center">
                          <ArrowUpRight className="size-2.5" />
                          {p.expenseCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
