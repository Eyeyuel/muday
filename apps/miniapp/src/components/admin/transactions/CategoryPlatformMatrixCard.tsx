import { useState, useEffect } from 'react';
import { LayoutGrid, ChevronRight, Zap } from 'lucide-react';
import type {
  AdminBankingAnalyticsResponse,
  AdminCategoryPlatformMatrixItem,
} from '../../../api/admin-types';
import { fetchAdminBankingAnalytics } from '../../../api/admin-api';
import type { Locale } from '../../../api/dashboard-types';
import { categoryLabels } from '../../../i18n/catalogs';
import { BankLogo } from '../BankLogo';

export function CategoryPlatformMatrixCard({
  locale,
  onSelectCategory,
}: {
  locale: Locale;
  onSelectCategory?: (category: string) => void;
}) {
  const [data, setData] = useState<AdminBankingAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminBankingAnalytics('30d')
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
          if (res.categoryByPlatformMatrix?.length && !selectedCategory) {
            setSelectedCategory(res.categoryByPlatformMatrix[0]?.category ?? null);
          }
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load category matrix');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const formatETB = (val: number) => {
    return `${new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(val)} ETB`;
  };

  const getRailBadgeClass = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('telebirr')) return 'bg-[#06b6d4]/15 text-[#0891b2] border-[#06b6d4]/30';
    if (p.includes('cbe')) return 'bg-[#8b5cf6]/15 text-[#7c3aed] border-[#8b5cf6]/30';
    if (p.includes('dashen') || p.includes('amole'))
      return 'bg-[#3b82f6]/15 text-[#2563eb] border-[#3b82f6]/30';
    if (p.includes('awash')) return 'bg-[#f59e0b]/15 text-[#d97706] border-[#f59e0b]/30';
    if (p.includes('abyssinia') || p.includes('boa'))
      return 'bg-[#ef4444]/15 text-[#dc2626] border-[#ef4444]/30';
    if (p.includes('cash')) return 'bg-[#10b981]/15 text-[#059669] border-[#10b981]/30';
    return 'bg-[var(--electric-cobalt)]/15 text-[var(--electric-cobalt)] border-[var(--electric-cobalt)]/30';
  };

  const getRailBarColor = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('telebirr')) return 'bg-[#06b6d4]';
    if (p.includes('cbe')) return 'bg-[#8b5cf6]';
    if (p.includes('dashen') || p.includes('amole')) return 'bg-[#3b82f6]';
    if (p.includes('awash')) return 'bg-[#f59e0b]';
    if (p.includes('abyssinia') || p.includes('boa')) return 'bg-[#ef4444]';
    if (p.includes('cash')) return 'bg-[#10b981]';
    return 'bg-[var(--electric-cobalt)]';
  };

  const activeCategoryItem: AdminCategoryPlatformMatrixItem | undefined =
    data?.categoryByPlatformMatrix.find((c) => c.category === selectedCategory) ??
    data?.categoryByPlatformMatrix[0];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-all">
      {/* Header */}
      <div className="border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--electric-cobalt)]/10 text-[var(--electric-cobalt)]">
            <LayoutGrid className="size-4" />
          </div>
          <h2 className="text-[16px] font-bold text-[var(--ink-charcoal)]">
            Category × Banking Rail Dominance Matrix
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-[var(--slate-gray)]">
          Reveals which bank or mobile wallet consumers use most for specific spending categories
          (e.g. Telebirr for Food/Taxi, CBE for Rent)
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-pulse">
          {/* Left Column Skeleton */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`cat-skel-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] space-y-1"
              >
                <div className="space-y-1">
                  <div className="h-3.5 w-28 rounded bg-[var(--surface-ivory)]" />
                  <div className="h-2.5 w-20 rounded bg-[var(--surface-ivory)]" />
                </div>
                <div className="h-5 w-16 rounded bg-[var(--surface-ivory)]" />
              </div>
            ))}
          </div>

          {/* Right Column Skeleton */}
          <div className="lg:col-span-7 p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/50 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div className="space-y-1">
                <div className="h-2.5 w-32 rounded bg-[var(--surface-ivory)]" />
                <div className="h-4 w-40 rounded bg-[var(--surface-ivory)]" />
              </div>
              <div className="h-6 w-24 rounded bg-[var(--surface-ivory)]" />
            </div>
            <div className="h-4 w-full rounded bg-[var(--surface-ivory)]" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`p-skel-${idx}`} className="h-8 rounded-lg bg-[var(--pure-white)]" />
              ))}
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 text-xs text-rose-500 bg-rose-500/10 rounded-xl">{error}</div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Interactive Categories List */}
          <div className="lg:col-span-5 flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
            {data.categoryByPlatformMatrix.map((item) => {
              const isSelected = item.category === activeCategoryItem?.category;
              const label =
                categoryLabels[locale][item.category] ??
                item.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div
                  key={item.category}
                  onClick={() => setSelectedCategory(item.category)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/5 shadow-2xs'
                      : 'border-[var(--border-hairline)] bg-[var(--pure-white)] hover:border-[var(--electric-cobalt)]/30 hover:bg-[var(--surface-ivory)]/40'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-[var(--ink-charcoal)] truncate capitalize">
                      {label}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--slate-gray)] mt-0.5">
                      <span className="tabular-nums font-medium text-[var(--ink-charcoal)]">
                        {formatETB(item.totalVolumeEtb)}
                      </span>
                      <span>•</span>
                      <span>{item.totalCount} txs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${getRailBadgeClass(
                        item.topPlatform,
                      )}`}
                    >
                      <BankLogo platform={item.topPlatform} className="size-3.5" />
                      <span>{item.topPlatform}</span>
                    </span>
                    <ChevronRight
                      className={`size-3.5 transition-transform ${
                        isSelected
                          ? 'text-[var(--electric-cobalt)] translate-x-0.5'
                          : 'text-[var(--steel-gray)]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Platform Breakdown for Selected Category */}
          {activeCategoryItem ? (
            <div className="lg:col-span-7 flex flex-col justify-between p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                  <div>
                    <span className="text-[10px] font-semibold text-[var(--slate-gray)] uppercase tracking-wider">
                      Selected Category Insights
                    </span>
                    <h3 className="text-sm font-bold text-[var(--ink-charcoal)] capitalize">
                      {categoryLabels[locale][activeCategoryItem.category] ??
                        activeCategoryItem.category.replace('_', ' ')}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(activeCategoryItem.category)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-2.5 py-1 text-[11px] font-semibold text-[var(--electric-cobalt)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>View in Ledger</span>
                    <ChevronRight className="size-3" />
                  </button>
                </div>

                {/* Stacked Multi-Color Segment Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--slate-gray)]">Payment Rail Share</span>
                    <span className="font-semibold text-[var(--ink-charcoal)]">
                      {formatETB(activeCategoryItem.totalVolumeEtb)}
                    </span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full border border-[var(--border-hairline)] bg-[var(--pure-white)]">
                    {Object.entries(activeCategoryItem.breakdown).map(([platform, stats]) => (
                      <div
                        key={platform}
                        title={`${platform}: ${stats.percentage}% (${formatETB(stats.volumeEtb)})`}
                        className={`h-full transition-all duration-300 ${getRailBarColor(platform)}`}
                        style={{ width: `${Math.max(1, stats.percentage)}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Platform List Breakdown */}
                <div className="space-y-2 pt-2">
                  {Object.entries(activeCategoryItem.breakdown)
                    .sort(([, a], [, b]) => b.volumeEtb - a.volumeEtb)
                    .map(([platform, stats]) => (
                      <div
                        key={platform}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--pure-white)] border border-[var(--border-hairline)] text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BankLogo
                            platform={platform}
                            className="size-4.5 rounded-md p-0.5 bg-[var(--surface-ivory)] border border-[var(--border-hairline)]"
                          />
                          <span className="font-semibold text-[var(--ink-charcoal)] truncate">
                            {platform}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 tabular-nums">
                          <span className="text-[11px] text-[var(--slate-gray)]">
                            {stats.count} txs
                          </span>
                          <span className="font-semibold text-[var(--ink-charcoal)]">
                            {formatETB(stats.volumeEtb)}
                          </span>
                          <span className="w-12 text-right font-bold text-[var(--electric-cobalt)]">
                            {stats.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center gap-2 text-[11px] text-[var(--slate-gray)]">
                <Zap className="size-3.5 text-amber-500" />
                <span>
                  <strong>{activeCategoryItem.topPlatform}</strong> is the primary payment channel
                  for{' '}
                  <span className="capitalize">
                    {activeCategoryItem.category.replace('_', ' ')}
                  </span>{' '}
                  spending.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
