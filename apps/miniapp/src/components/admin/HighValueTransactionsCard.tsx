import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { AdminAnalyticsReport } from '../../api/admin-types';

export function HighValueTransactionsCard({ report }: { report?: AdminAnalyticsReport }) {
  const items = report?.highValueTransactions ?? [];

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Large Transactions (≥ 2,000 ETB)
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">
            {items.length} Entries
          </span>
        </div>
        <p className="text-[12px] text-[var(--slate-gray)] mb-4">
          Transactions meeting or exceeding the 2,000 ETB threshold
        </p>

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/40 hover:bg-[var(--surface-ivory)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-7 items-center justify-center rounded-lg ${
                      item.isDebit ? 'bg-red-500/10 text-red-600' : 'bg-[#5ecf9a]/15 text-[#2f9e6e]'
                    }`}
                  >
                    {item.isDebit ? (
                      <ArrowDownLeft className="size-3.5" />
                    ) : (
                      <ArrowUpRight className="size-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[var(--ink-charcoal)] truncate max-w-[150px]">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[var(--slate-gray)]">
                      {item.entity} · {item.time}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    item.isDebit ? 'text-red-600' : 'text-[#2f9e6e]'
                  }`}
                >
                  {item.amountEtb}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[180px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--slate-gray)]">
              No transactions ≥ 2,000 ETB
            </p>
            <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
              Large single transfers and high-value expenses will appear here automatically.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>Threshold: ETB 2,000</span>
        <span className="font-medium">Audit Outliers</span>
      </div>
    </section>
  );
}
