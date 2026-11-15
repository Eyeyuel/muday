import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';

export function CategoryVarianceTableCard({ report }: { report?: AdminAnalyticsReport }) {
  const variances = report?.categoryVariances ?? [];

  return (
    <section className="flex flex-col rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
          Category Spending Variance (30d Trend)
        </h2>
        <span className="text-[11px] font-medium text-[var(--slate-gray)]">
          {variances.length} Categories Analyzed
        </span>
      </div>
      <p className="text-[12px] text-[var(--slate-gray)] mb-4">
        Spending volume comparison between current 30-day period and prior 30-day period
      </p>

      {variances.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-[11px] font-medium text-[var(--slate-gray)]">
                <th className="pb-2.5">Category</th>
                <th className="pb-2.5 text-right">Current 30d</th>
                <th className="pb-2.5 text-right">Prior 30d</th>
                <th className="pb-2.5 text-right">Shift %</th>
                <th className="pb-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {variances.map((item, idx) => {
                const isNew = item.isNewCategory;
                const isPositive = item.variancePercent > 0;
                const isZero = item.variancePercent === 0;

                return (
                  <tr key={idx} className="hover:bg-[var(--surface-ivory)]/40 transition-colors">
                    <td className="py-2.5 font-medium text-[var(--ink-charcoal)]">
                      {item.category}
                      {isNew && (
                        <span className="ml-1.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                          NEW
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium text-[var(--ink-charcoal)] tabular-nums">
                      {typeof item.currentVolumeEtb === 'string' &&
                      item.currentVolumeEtb.startsWith('ETB')
                        ? item.currentVolumeEtb
                        : `ETB ${(parseFloat(String(item.currentVolumeEtb).replace(/[^0-9.-]/g, '')) || 0).toLocaleString()}`}
                    </td>
                    <td className="py-2.5 text-right text-[var(--slate-gray)] tabular-nums">
                      {typeof item.priorVolumeEtb === 'string' &&
                      item.priorVolumeEtb.startsWith('ETB')
                        ? item.priorVolumeEtb
                        : `ETB ${(parseFloat(String(item.priorVolumeEtb).replace(/[^0-9.-]/g, '')) || 0).toLocaleString()}`}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {isNew ? (
                        <span className="text-[var(--slate-gray)]">—</span>
                      ) : isZero ? (
                        <span className="text-[var(--slate-gray)]">0.0%</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-0.5 ${
                            item.isFavorable ? 'text-[#2f9e6e]' : 'text-red-600'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="size-3" />
                          ) : (
                            <ArrowDownRight className="size-3" />
                          )}
                          {isPositive ? `+${item.variancePercent}%` : `${item.variancePercent}%`}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {isNew ? (
                        <span className="text-[11px] text-[var(--slate-gray)]">New Activity</span>
                      ) : (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            item.isFavorable
                              ? 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                              : 'bg-red-500/15 text-red-600'
                          }`}
                        >
                          {item.isFavorable ? 'Favorable' : 'Increased Burn'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex h-[160px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
          <p className="text-[13px] font-medium text-[var(--slate-gray)]">
            No category variance data recorded
          </p>
          <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
            30-day shift analysis will calculate automatically as monthly transactions accumulate.
          </p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>Window: 30-Day Trailing vs Prior 30-Day Window</span>
        <span className="font-medium">Continuous Ledger Variance</span>
      </div>
    </section>
  );
}
