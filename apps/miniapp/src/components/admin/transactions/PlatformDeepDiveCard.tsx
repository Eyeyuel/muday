import { useState, useEffect } from 'react';
import {
  Landmark,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  LayoutGrid,
  Tag,
  Mic,
  MessageSquare,
  Receipt,
} from 'lucide-react';
import type {
  AdminBankingAnalyticsResponse,
  AdminPlatformDeepDiveProfile,
} from '../../../api/admin-types';
import { fetchAdminBankingAnalytics } from '../../../api/admin-api';
import type { Locale } from '../../../api/dashboard-types';
import { categoryLabels } from '../../../i18n/catalogs';
import { BankLogo } from '../BankLogo';

export function PlatformDeepDiveCard({
  locale,
  onSelectPlatform,
}: {
  locale: Locale;
  onSelectPlatform?: (platform: string) => void;
}) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<AdminBankingAnalyticsResponse | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('CBE');
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
          // If selected platform is not in results, select first available
          if (
            res.platformDeepDives &&
            !res.platformDeepDives[selectedPlatform] &&
            res.platformMarketShare[0]
          ) {
            setSelectedPlatform(res.platformMarketShare[0].platform);
          }
        }
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Failed to load platform deep dive');
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

  const getRailStyle = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('telebirr')) {
      return {
        color: '#06b6d4',
        bar: 'bg-[#06b6d4]',
        text: 'text-[#06b6d4]',
        border: 'border-[#06b6d4]/40',
        bg: 'bg-[#06b6d4]/10',
        pillActive: 'bg-[#06b6d4] text-white shadow-xs',
      };
    }
    if (p.includes('cbe')) {
      return {
        color: '#8b5cf6',
        bar: 'bg-[#8b5cf6]',
        text: 'text-[#8b5cf6]',
        border: 'border-[#8b5cf6]/40',
        bg: 'bg-[#8b5cf6]/10',
        pillActive: 'bg-[#8b5cf6] text-white shadow-xs',
      };
    }
    if (p.includes('dashen') || p.includes('amole')) {
      return {
        color: '#3b82f6',
        bar: 'bg-[#3b82f6]',
        text: 'text-[#3b82f6]',
        border: 'border-[#3b82f6]/40',
        bg: 'bg-[#3b82f6]/10',
        pillActive: 'bg-[#3b82f6] text-white shadow-xs',
      };
    }
    if (p.includes('awash')) {
      return {
        color: '#f59e0b',
        bar: 'bg-[#f59e0b]',
        text: 'text-[#f59e0b]',
        border: 'border-[#f59e0b]/40',
        bg: 'bg-[#f59e0b]/10',
        pillActive: 'bg-[#f59e0b] text-white shadow-xs',
      };
    }
    if (p.includes('abyssinia') || p.includes('boa')) {
      return {
        color: '#ef4444',
        bar: 'bg-[#ef4444]',
        text: 'text-[#ef4444]',
        border: 'border-[#ef4444]/40',
        bg: 'bg-[#ef4444]/10',
        pillActive: 'bg-[#ef4444] text-white shadow-xs',
      };
    }
    return {
      color: '#10b981',
      bar: 'bg-[#10b981]',
      text: 'text-[#10b981]',
      border: 'border-[#10b981]/40',
      bg: 'bg-[#10b981]/10',
      pillActive: 'bg-[#10b981] text-white shadow-xs',
    };
  };

  const currentProfile: AdminPlatformDeepDiveProfile | null =
    data?.platformDeepDives?.[selectedPlatform] ??
    (data?.platformMarketShare[0]
      ? (data?.platformDeepDives?.[data.platformMarketShare[0].platform] ?? null)
      : null);

  const currentStyle = getRailStyle(selectedPlatform);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-all">
      {/* 1. Header with Time Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]">
              <BarChart3 className="size-4" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--ink-charcoal)] flex items-center gap-2">
              <span>Banking Rail Deep-Dive Profiler</span>
              {isFetching ? (
                <span className="size-3 border-2 border-[var(--electric-cobalt)] border-t-transparent rounded-full animate-spin shrink-0" />
              ) : null}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--slate-gray)]">
            Forensic behavioral profile: what each rail is used for, peak transacting hours, and
            ticket size tiers
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

      {/* 2. Platform Navigation Strip */}
      {data?.platformMarketShare && data.platformMarketShare.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {data.platformMarketShare.map((p) => {
            const isSelected = selectedPlatform === p.platform;
            const style = getRailStyle(p.platform);
            return (
              <button
                key={p.platform}
                type="button"
                onClick={() => {
                  setSelectedPlatform(p.platform);
                  onSelectPlatform?.(p.platform);
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                  isSelected
                    ? `${style.pillActive} border-transparent shadow-xs`
                    : 'bg-[var(--surface-ivory)]/80 text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] border-[var(--border-hairline)] hover:bg-[var(--surface-ivory)]'
                }`}
              >
                <BankLogo
                  platform={p.platform}
                  className={`size-4 rounded-xs p-0.5 ${
                    isSelected
                      ? 'bg-white/20'
                      : 'bg-[var(--pure-white)] border border-[var(--border-hairline)]'
                  }`}
                />
                <span>{p.platform}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                    isSelected
                      ? 'bg-black/20 text-white'
                      : 'bg-[var(--border-hairline)] text-[var(--ink-charcoal)]'
                  }`}
                >
                  {p.sharePercentage}%
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* 3. Deep Dive Content Section */}
      {loading && !data ? (
        <div className="space-y-4 animate-pulse pt-2">
          <div className="h-20 w-full rounded-xl bg-[var(--surface-ivory)]" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="h-64 rounded-xl bg-[var(--surface-ivory)]" />
            <div className="h-64 rounded-xl bg-[var(--surface-ivory)]" />
            <div className="h-64 rounded-xl bg-[var(--surface-ivory)]" />
          </div>
        </div>
      ) : error ? (
        <div className="p-4 text-xs text-rose-500 bg-rose-500/10 rounded-xl">{error}</div>
      ) : currentProfile ? (
        <div
          className={`space-y-4 transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}
        >
          {/* A. Platform Quick KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/50">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--slate-gray)] block tracking-wider">
                Settled Volume
              </span>
              <span className="text-base font-bold text-[var(--ink-charcoal)] tabular-nums">
                {formatETB(currentProfile.volumeEtb)}
              </span>
              <span className="text-[10px] text-[var(--slate-gray)] block mt-0.5">
                {currentProfile.sharePercentage}% market share
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--slate-gray)] block tracking-wider">
                Total Activity
              </span>
              <span className="text-base font-bold text-[var(--ink-charcoal)] tabular-nums">
                {currentProfile.count.toLocaleString()} txs
              </span>
              <span className="text-[10px] text-[var(--slate-gray)] block mt-0.5">
                Logged in timeframe
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--slate-gray)] block tracking-wider">
                Average Ticket
              </span>
              <span className="text-base font-bold text-[var(--ink-charcoal)] tabular-nums">
                {formatETB(currentProfile.avgTicketSizeEtb)}
              </span>
              <span className="text-[10px] text-[var(--slate-gray)] block mt-0.5">
                Median: {formatETB(currentProfile.medianTicketSizeEtb)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--slate-gray)] block tracking-wider">
                Inflow vs Outflow
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-bold text-[#10b981] inline-flex items-center tabular-nums">
                  <ArrowDownRight className="size-3" />
                  {currentProfile.inflow.percentage}%
                </span>
                <span className="text-xs text-[var(--slate-gray)]">/</span>
                <span className="text-xs font-bold text-[#ef4444] inline-flex items-center tabular-nums">
                  <ArrowUpRight className="size-3" />
                  {currentProfile.outflow.percentage}%
                </span>
              </div>
              <span className="text-[10px] text-[var(--slate-gray)] block mt-0.5">
                Net: {formatETB(currentProfile.netCashflowEtb)}
              </span>
            </div>
          </div>

          {/* B. Three-Column Forensic Intelligence Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Primary Use Cases (Categories) */}
            <div className="flex flex-col justify-between p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                  <h3 className="text-xs font-bold text-[var(--ink-charcoal)] flex items-center gap-1.5">
                    <LayoutGrid className="size-3.5 text-[var(--slate-gray)]" />
                    <span>Top Use Cases for {selectedPlatform}</span>
                  </h3>
                  <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                    {currentProfile.topCategories.length} categories
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {currentProfile.topCategories.map((c) => {
                    const label =
                      categoryLabels[locale][c.category] ??
                      c.category.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
                    return (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink-charcoal)] truncate max-w-[140px]">
                            {label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[var(--ink-charcoal)] tabular-nums">
                              {formatETB(c.volumeEtb)}
                            </span>
                            <span className="text-[10px] text-[var(--slate-gray)] font-semibold w-8 text-right tabular-nums">
                              {c.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--surface-ivory)] overflow-hidden border border-[var(--border-hairline)]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${currentStyle.bar}`}
                            style={{ width: `${Math.max(4, c.percentage)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Column 2: 24-Hour EAT Activity Curve & Ticket Size Bands */}
            <div className="flex flex-col justify-between p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-4">
              {/* 24-Hour Curve */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                  <h3 className="text-xs font-bold text-[var(--ink-charcoal)] flex items-center gap-1.5">
                    <Clock className="size-3.5 text-[var(--slate-gray)]" />
                    <span>24-Hour Activity Peak (EAT UTC+3)</span>
                  </h3>
                  <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                    Hourly tx count
                  </span>
                </div>

                {/* Visual Bar Histogram */}
                <div className="mt-3 flex items-end justify-between gap-0.5 h-20 pt-2 px-1">
                  {currentProfile.hourlyCurve.map((h) => {
                    const maxCount = Math.max(...currentProfile.hourlyCurve.map((x) => x.count), 1);
                    const heightPct = Math.max(8, (h.count / maxCount) * 100);
                    const isPeak = h.count === maxCount && h.count > 0;
                    return (
                      <div
                        key={h.hour}
                        title={`${String(h.hour).padStart(2, '0')}:00 EAT — ${h.count} transactions (${formatETB(h.volumeEtb)})`}
                        className="flex-1 flex flex-col items-center group relative cursor-pointer"
                      >
                        <div
                          className={`w-full rounded-t-xs transition-all ${
                            isPeak
                              ? `${currentStyle.bar} opacity-100`
                              : h.count > 0
                                ? `${currentStyle.bar} opacity-60 hover:opacity-100`
                                : 'bg-[var(--border-hairline)] opacity-30'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[9px] text-[var(--slate-gray)] px-1 mt-1">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00 (Lunch)</span>
                  <span>18:00 (Commute)</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Amount Size Tiers */}
              <div className="pt-3 border-t border-[var(--border-hairline)]">
                <span className="text-[11px] font-bold text-[var(--ink-charcoal)] block mb-2">
                  Ticket Size Distribution
                </span>
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div className="p-1.5 rounded-lg bg-[var(--surface-ivory)]/70 border border-[var(--border-hairline)]">
                    <span className="text-[9px] text-[var(--slate-gray)] block">&lt;200</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.ticketSizeTiers.micro}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--surface-ivory)]/70 border border-[var(--border-hairline)]">
                    <span className="text-[9px] text-[var(--slate-gray)] block">200-1k</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.ticketSizeTiers.small}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--surface-ivory)]/70 border border-[var(--border-hairline)]">
                    <span className="text-[9px] text-[var(--slate-gray)] block">1k-5k</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.ticketSizeTiers.medium}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--surface-ivory)]/70 border border-[var(--border-hairline)]">
                    <span className="text-[9px] text-[var(--slate-gray)] block">5k-25k</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.ticketSizeTiers.large}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-[var(--surface-ivory)]/70 border border-[var(--border-hairline)]">
                    <span className="text-[9px] text-[var(--slate-gray)] block">&gt;25k</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.ticketSizeTiers.bulk}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Modality & Merchant Note Keywords */}
            <div className="flex flex-col justify-between p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-4">
              {/* Modality Split */}
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                  <h3 className="text-xs font-bold text-[var(--ink-charcoal)] flex items-center gap-1.5">
                    <Landmark className="size-3.5 text-[var(--slate-gray)]" />
                    <span>Ingestion Modality for {selectedPlatform}</span>
                  </h3>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
                    <Mic className="size-4 text-[var(--electric-cobalt)] mb-1" />
                    <span className="text-[10px] text-[var(--slate-gray)] font-medium">Voice</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.modalitySplit.voice.pct}%
                    </span>
                    <span className="text-[9px] text-[var(--slate-gray)]">
                      {currentProfile.modalitySplit.voice.count} txs
                    </span>
                  </div>

                  <div className="flex flex-col items-center p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
                    <MessageSquare className="size-4 text-emerald-600 mb-1" />
                    <span className="text-[10px] text-[var(--slate-gray)] font-medium">Text</span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.modalitySplit.text.pct}%
                    </span>
                    <span className="text-[9px] text-[var(--slate-gray)]">
                      {currentProfile.modalitySplit.text.count} txs
                    </span>
                  </div>

                  <div className="flex flex-col items-center p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/60">
                    <Receipt className="size-4 text-amber-600 mb-1" />
                    <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                      Receipt
                    </span>
                    <span className="text-xs font-bold text-[var(--ink-charcoal)] tabular-nums">
                      {currentProfile.modalitySplit.receipt.pct}%
                    </span>
                    <span className="text-[9px] text-[var(--slate-gray)]">
                      {currentProfile.modalitySplit.receipt.count} txs
                    </span>
                  </div>
                </div>
              </div>

              {/* Recurring Note Keywords */}
              <div className="pt-3 border-t border-[var(--border-hairline)]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="size-3.5 text-[var(--slate-gray)]" />
                  <span className="text-[11px] font-bold text-[var(--ink-charcoal)]">
                    Recurring Payees & Keywords
                  </span>
                </div>

                {currentProfile.topNoteKeywords && currentProfile.topNoteKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {currentProfile.topNoteKeywords.map((k) => (
                      <span
                        key={k.word}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-ivory)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--ink-charcoal)] capitalize"
                      >
                        <span>{k.word}</span>
                        <strong className="text-[10px] text-[var(--slate-gray)]">
                          ({k.count})
                        </strong>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--slate-gray)] italic">
                    No recurring keyword patterns recorded
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
