import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';
import { categoryLabels } from '../../i18n/catalogs';

const CHANNEL_CONFIG = [
  { name: 'Telebirr', share: 44, color: '#0068f9', amountEtb: '651,200 ETB' },
  { name: 'CBE Birr / CBE', share: 32, color: '#3d8bfd', amountEtb: '473,600 ETB' },
  { name: 'Bank of Abyssinia', share: 14, color: '#024bb1', amountEtb: '207,200 ETB' },
  { name: 'Cash', share: 7, color: '#6babff', amountEtb: '103,600 ETB' },
  { name: 'Other / Custom', share: 3, color: '#9bc5ff', amountEtb: '44,400 ETB' },
];

export function FinancialVolumeCard({
  report,
  locale = 'en',
}: {
  report: AdminAnalyticsReport;
  locale?: Locale;
}) {
  const { financials } = report;
  const [viewMode, setViewMode] = useState<'LIST' | 'BAR'>('LIST');

  const formatETB = (val: string | number) =>
    `${new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(val))} ETB`;

  const topCategories = financials?.topCategories ?? [];

  const chartData = topCategories.map((item) => ({
    name: categoryLabels[locale][item.category] ?? item.category,
    amount: Number(item.amountEtb),
    percentage: Number(item.percentage),
  }));

  return (
    <div className="space-y-4">
      {/* 1. Macro Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Total Volume Processed</p>
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {formatETB(financials.totalVolumeEtb)}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">All platforms & accounts</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Avg Volume per User</p>
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
            {formatETB(financials.avgVolumePerUserEtb)}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">Active monthly cohorts</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">Telebirr Intake</p>
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--electric-cobalt)] tabular-nums">
            44%
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">Primary mobile wallet</p>
        </div>

        <div className="rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none">
          <p className="text-[12px] font-medium text-[var(--slate-gray)]">CBE & Bank Intake</p>
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--electric-cobalt)] tabular-nums">
            46%
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--steel-gray)]">Institutional banking</p>
        </div>
      </div>

      {/* 2. Multi-Channel Breakdown & Category Progress Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Payment Channels (FinCore style) */}
        <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none lg:col-span-5">
          <div className="mb-4">
            <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
              Payment Channels
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
              Share of transaction volume this period
            </p>
          </div>

          <div className="min-h-0 flex-1 flex flex-col justify-between">
            {/* Horizontal Multi-Segment Bar */}
            <div className="flex h-6 w-full overflow-hidden rounded-full border border-[var(--border-hairline)] bg-[var(--surface-ivory)]">
              {CHANNEL_CONFIG.map((c) => (
                <div
                  key={c.name}
                  className="h-full transition-all"
                  style={{ width: `${c.share}%`, backgroundColor: c.color }}
                  title={`${c.name}: ${c.share}%`}
                />
              ))}
            </div>

            {/* Channel Legend List */}
            <ul className="mt-5 space-y-3">
              {CHANNEL_CONFIG.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 text-[var(--ink-charcoal)]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--slate-gray)] tabular-nums">
                      {c.amountEtb}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--ink-charcoal)] w-9 text-right">
                      {c.share}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Top Expense Drivers */}
        <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">
                Top Expense Drivers
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
                Aggregated category outflows across all accounts
              </p>
            </div>

            <div className="flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-[var(--electric-cobalt)] text-white shadow-xs'
                    : 'text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('BAR')}
                className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  viewMode === 'BAR'
                    ? 'bg-[var(--electric-cobalt)] text-white shadow-xs'
                    : 'text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]'
                }`}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {viewMode === 'LIST' ? (
              <div className="space-y-3">
                {topCategories.map((item, idx) => {
                  const label = categoryLabels[locale][item.category] ?? item.category;
                  const pct = Math.min(100, Math.max(8, Number(item.percentage)));
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="truncate text-[var(--ink-charcoal)] font-medium">
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--slate-gray)]">
                            {item.percentage}%
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold text-[var(--ink-charcoal)]">
                            {formatETB(item.amountEtb)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-ivory)] border border-[var(--border-hairline)]">
                        <div
                          className="h-full rounded-full bg-[var(--electric-cobalt)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <XAxis
                      dataKey="name"
                      stroke="var(--slate-gray)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--slate-gray)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        const first = payload?.[0];
                        if (active && first && first.payload) {
                          const data = first.payload as { name?: string; amount?: number };
                          return (
                            <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-2.5 shadow-sm text-xs">
                              <p className="font-semibold text-[var(--ink-charcoal)]">
                                {data.name}
                              </p>
                              <p className="mt-1 text-[var(--slate-gray)]">
                                Amount:{' '}
                                <span className="font-semibold text-[var(--ink-charcoal)]">
                                  ETB {Number(data.amount ?? 0).toLocaleString()}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
