import type { AdminAnalyticsReport } from '../../api/admin-types';

export function EventKindBreakdownCard({ report }: { report?: AdminAnalyticsReport }) {
  const eventKinds = report?.eventKinds ?? [];
  const totalCount = eventKinds.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Types of Money Movement
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">
            {totalCount.toLocaleString()} total entries
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Expenses, income, loans, and refunds recorded by users
        </p>

        {eventKinds.length > 0 ? (
          <>
            {/* Multi-Segment Horizontal Progress Bar */}
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-ivory)]">
              {eventKinds.map((item, idx) => {
                const pct = parseFloat(item.percentage) || 0;
                return (
                  <div
                    key={idx}
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                    title={`${item.label}: ${item.percentage.endsWith('%') ? item.percentage : `${item.percentage}%`}`}
                  />
                );
              })}
            </div>

            {/* Event List Breakdown */}
            <div className="mt-5 space-y-3">
              {eventKinds.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium text-[var(--ink-charcoal)]">{item.label}</span>
                    <span className="text-[11px] text-[var(--slate-gray)]">({item.count} txs)</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-[var(--slate-gray)] text-[11px] font-normal">
                      {typeof item.volumeEtb === 'string' && item.volumeEtb.startsWith('ETB')
                        ? item.volumeEtb
                        : `ETB ${(parseFloat(String(item.volumeEtb).replace(/[^0-9.-]/g, '')) || 0).toLocaleString()}`}
                    </span>
                    <span className="font-semibold text-[var(--ink-charcoal)] w-12 text-right">
                      {item.percentage.endsWith('%') ? item.percentage : `${item.percentage}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Real Data Cash Flow Summary Box */}
            <div className="mt-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-ivory)]/40 p-2.5 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                  Total Spending & Outflows
                </span>
                <p className="mt-0.5 font-semibold text-red-600">
                  ETB{' '}
                  {Math.round(
                    eventKinds
                      .filter(
                        (k) =>
                          k.kind === 'EXPENSE' ||
                          k.kind === 'LOAN_PAYMENT' ||
                          k.label.toLowerCase().includes('expense') ||
                          k.label.toLowerCase().includes('loan payment'),
                      )
                      .reduce((acc, k) => {
                        const v =
                          typeof k.volumeEtb === 'number'
                            ? k.volumeEtb
                            : parseFloat(String(k.volumeEtb).replace(/[^0-9.-]/g, '')) || 0;
                        return acc + v;
                      }, 0),
                  ).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--slate-gray)] font-medium">
                  Total Income & Receipts
                </span>
                <p className="mt-0.5 font-semibold text-[#2f9e6e]">
                  ETB{' '}
                  {Math.round(
                    eventKinds
                      .filter(
                        (k) =>
                          !(
                            k.kind === 'EXPENSE' ||
                            k.kind === 'LOAN_PAYMENT' ||
                            k.label.toLowerCase().includes('expense') ||
                            k.label.toLowerCase().includes('loan payment')
                          ),
                      )
                      .reduce((acc, k) => {
                        const v =
                          typeof k.volumeEtb === 'number'
                            ? k.volumeEtb
                            : parseFloat(String(k.volumeEtb).replace(/[^0-9.-]/g, '')) || 0;
                        return acc + v;
                      }, 0),
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 flex h-[160px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--slate-gray)]">
              No financial events recorded
            </p>
            <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
              Event classifications (Expense, Income, Loan, Refund) will populate as entries are
              logged.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>Entry Types: {eventKinds.length}</span>
        <span className="font-medium">Live Ledger</span>
      </div>
    </section>
  );
}
