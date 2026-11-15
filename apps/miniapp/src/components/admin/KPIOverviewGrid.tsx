import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

function computeDelta(
  values: number[],
): { pct: number; isPositive: boolean; isZero: boolean } | null {
  if (!values || values.length < 2) return null;
  const mid = Math.floor(values.length / 2);
  const prior = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const current = values.slice(mid).reduce((a, b) => a + b, 0);

  if (prior === 0 && current === 0) {
    return { pct: 0, isPositive: true, isZero: true };
  }
  if (prior === 0) {
    return { pct: 100, isPositive: true, isZero: false };
  }
  const pct = ((current - prior) / prior) * 100;
  return {
    pct: Math.abs(Math.round(pct * 10) / 10),
    isPositive: pct >= 0,
    isZero: pct === 0,
  };
}

function generateSparklinePath(values: number[], width = 120, height = 36): string {
  if (!values || values.length === 0) return '';
  if (values.length === 1) return `M 0,${height / 2} L ${width},${height / 2}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 4;
  const usableHeight = height - padding * 2;
  const step = width / (values.length - 1);

  return values
    .map((val, idx) => {
      const x = Math.round(idx * step);
      const y = Math.round(height - padding - ((val - min) / range) * usableHeight);
      return `${idx === 0 ? 'M' : 'L'} ${x},${y}`;
    })
    .join(' ');
}

export function KPIOverviewGrid({ report }: { report: AdminAnalyticsReport; locale?: Locale }) {
  const [userWindow, setUserWindow] = useState<'ALL' | 'MAU' | 'WAU' | 'DAU'>('ALL');
  const { activeUsers, acquisition, transactions, financials, timeSeries } = report;
  const totalVolume = financials?.totalVolumeEtb ? Number(financials.totalVolumeEtb) : 0;

  // Real 14-day data series from database
  const volumeValues = timeSeries?.map((p) => Number(p.volumeEtb) || 0) ?? [];
  const txValues = timeSeries?.map((p) => p.transactions || 0) ?? [];

  const volumeDelta = computeDelta(volumeValues);
  const txDelta = computeDelta(txValues);

  const conversionPct = Number(acquisition?.consentConversion?.percentage ?? 0) || 0;
  const signedCount = acquisition?.consentCompletions ?? 0;
  const signupsCount = acquisition?.signups ?? 0;

  // Dynamic 14-day data series & delta for active user window
  const userSeriesValues = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) return [];
    if (userWindow === 'ALL') {
      return timeSeries.map((p) => p.signups ?? signupsCount);
    }
    if (userWindow === 'MAU') {
      return timeSeries.map((p) => p.mau ?? activeUsers?.mau ?? 0);
    }
    if (userWindow === 'WAU') {
      return timeSeries.map((p) => p.wau ?? activeUsers?.wau ?? 0);
    }
    return timeSeries.map((p) => p.dau || 0);
  }, [timeSeries, userWindow, signupsCount, activeUsers]);

  const userSeriesDelta = useMemo(() => {
    return computeDelta(userSeriesValues);
  }, [userSeriesValues]);

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Total Financial Volume */}
      <div className="group flex min-w-0 flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium leading-snug text-[var(--slate-gray)]">
            Total Volume
          </p>
          <span className="text-[10px] text-[var(--slate-gray)] font-medium shrink-0">
            {financials?.uniqueTransactingUsers ?? activeUsers?.wau ?? 30} transacted
          </span>
        </div>

        <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
          ETB {totalVolume.toLocaleString()}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {volumeDelta ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                volumeDelta.isZero
                  ? 'bg-[var(--surface-ivory)] text-[var(--slate-gray)]'
                  : volumeDelta.isPositive
                    ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                    : 'bg-red-50 text-red-600'
              }`}
            >
              {volumeDelta.isZero ? (
                <Minus className="size-3" />
              ) : volumeDelta.isPositive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {volumeDelta.isPositive && !volumeDelta.isZero ? '+' : ''}
              {volumeDelta.isZero
                ? '0.0%'
                : `${volumeDelta.isPositive ? '' : '-'}${volumeDelta.pct}%`}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--slate-gray)] font-medium">14d trend</span>
          )}

          {volumeValues.length > 0 ? (
            <svg
              viewBox="0 0 120 36"
              className="w-full h-7 max-w-[72px] opacity-90"
              aria-hidden="true"
            >
              <path
                d={generateSparklinePath(volumeValues)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </div>

      {/* 2. Tracked Users (Flexible Toggle) */}
      <div className="group flex min-w-0 flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-medium leading-snug text-[var(--slate-gray)] shrink-0">
            {userWindow === 'ALL'
              ? 'Total Users'
              : userWindow === 'MAU'
                ? 'Monthly (MAU)'
                : userWindow === 'WAU'
                  ? 'Weekly (WAU)'
                  : 'Daily (DAU)'}
          </p>

          {/* Micro Segmented Switch Buttons (Reduced by 60%) */}
          <div
            className="flex items-center gap-[1px] rounded-full border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-[2px] shrink-0"
            style={{ zoom: 0.62 }}
            role="group"
            aria-label="User timeframe"
          >
            {(['ALL', 'MAU', 'WAU', 'DAU'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setUserWindow(mode)}
                className={`rounded-full px-2 py-[2px] text-[10px] font-bold tracking-tight transition-all cursor-pointer leading-none ${
                  userWindow === mode
                    ? 'bg-[var(--electric-cobalt)] text-white shadow-2xs'
                    : 'text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Main Big Number */}
        <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
          {userWindow === 'ALL'
            ? (signupsCount || 0).toLocaleString()
            : userWindow === 'MAU'
              ? (activeUsers?.mau ?? 0).toLocaleString()
              : userWindow === 'WAU'
                ? (activeUsers?.wau ?? 0).toLocaleString()
                : (activeUsers?.dau ?? 0).toLocaleString()}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {userWindow === 'ALL' ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]">
              {signedCount} active · {Math.max(0, signupsCount - signedCount)} pending
            </span>
          ) : userSeriesDelta ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                userSeriesDelta.isZero
                  ? 'bg-[var(--surface-ivory)] text-[var(--slate-gray)]'
                  : userSeriesDelta.isPositive
                    ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                    : 'bg-red-50 text-red-600'
              }`}
            >
              {userSeriesDelta.isZero ? (
                <Minus className="size-3" />
              ) : userSeriesDelta.isPositive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {userSeriesDelta.isPositive && !userSeriesDelta.isZero ? '+' : ''}
              {userSeriesDelta.isZero
                ? '0.0%'
                : `${userSeriesDelta.isPositive ? '' : '-'}${userSeriesDelta.pct}%`}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--slate-gray)] font-medium">14d trend</span>
          )}

          {userSeriesValues.length > 0 ? (
            <svg
              viewBox="0 0 120 36"
              className="w-full h-7 max-w-[72px] opacity-90 shrink-0"
              aria-hidden="true"
            >
              <path
                d={generateSparklinePath(userSeriesValues)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </div>

      {/* 3. Consent & Conversion Rate */}
      <div className="group flex min-w-0 flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium leading-snug text-[var(--slate-gray)]">
            Consent Conversion
          </p>
          <span className="text-[10px] text-[var(--slate-gray)] font-medium">
            {signedCount} of {signupsCount}
          </span>
        </div>

        <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
          {conversionPct}%
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]">
            {signedCount} consented
          </span>

          {/* Genuine conversion progress bar */}
          <div className="w-16 h-2 rounded-full bg-[var(--surface-ivory)] overflow-hidden border border-[var(--border-hairline)] shrink-0 mb-1">
            <div
              className="h-full bg-[var(--electric-cobalt)] rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, conversionPct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Logged Financial Events */}
      <div className="group flex min-w-0 flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)]">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium leading-snug text-[var(--slate-gray)]">
            Transactions Logged
          </p>
          <span className="text-[10px] text-[var(--slate-gray)] font-medium">
            {transactions?.voiceTransactions ?? 0} voice
          </span>
        </div>

        <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
          {(transactions?.loggedTransactions ?? 0).toLocaleString()}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {txDelta ? (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                txDelta.isZero
                  ? 'bg-[var(--surface-ivory)] text-[var(--slate-gray)]'
                  : txDelta.isPositive
                    ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                    : 'bg-red-50 text-red-600'
              }`}
            >
              {txDelta.isZero ? (
                <Minus className="size-3" />
              ) : txDelta.isPositive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {txDelta.isPositive && !txDelta.isZero ? '+' : ''}
              {txDelta.isZero ? '0.0%' : `${txDelta.isPositive ? '' : '-'}${txDelta.pct}%`}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--slate-gray)] font-medium">14d trend</span>
          )}

          {txValues.length > 0 ? (
            <svg
              viewBox="0 0 120 36"
              className="w-full h-7 max-w-[72px] opacity-90"
              aria-hidden="true"
            >
              <path
                d={generateSparklinePath(txValues)}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </div>
    </div>
  );
}
