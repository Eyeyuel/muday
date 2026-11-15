import type { AdminAnalyticsReport } from '../../api/admin-types';

export function AvgTicketByRailCard({ report }: { report?: AdminAnalyticsReport }) {
  const rails = report?.railBasketSizes ?? [];

  const parseCurrency = (val?: string | number) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
  };

  const formatCurrency = (val?: string | number) => {
    if (!val) return 'ETB 0';
    if (typeof val === 'string' && val.startsWith('ETB')) return val;
    return `ETB ${parseCurrency(val).toLocaleString()}`;
  };

  const maxAvgTicket = Math.max(...rails.map((r) => parseCurrency(r.avgTicketEtb)), 1);

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Average Ticket Size by Banking Rail
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">
            {rails.length} Rails
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Mean transaction basket size and volume share per payment method
        </p>

        {rails.length > 0 ? (
          <div className="mt-5 space-y-4">
            {rails.map((rail, idx) => {
              const avgNum = parseCurrency(rail.avgTicketEtb);
              const barPercent = Math.min(Math.round((avgNum / maxAvgTicket) * 100), 100);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: rail.color }}
                      />
                      <span className="font-medium text-[var(--ink-charcoal)]">{rail.name}</span>
                      <span className="text-[11px] text-[var(--slate-gray)]">
                        ({rail.transactionCount} txs)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="font-semibold text-[var(--ink-charcoal)]">
                        {formatCurrency(rail.avgTicketEtb)}
                      </span>
                      <span className="text-[11px] text-[var(--slate-gray)]">/ avg</span>
                    </div>
                  </div>

                  {/* Relative ticket size bar */}
                  <div className="h-1.5 w-full rounded-full bg-[var(--surface-ivory)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barPercent}%`,
                        backgroundColor: rail.color || '#10b981',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--slate-gray)]">
                    <span>Total: {formatCurrency(rail.totalVolumeEtb)}</span>
                    <span>{String(rail.sharePercent ?? '').replace(/%+$/, '')}% of volume</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 flex h-[160px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--slate-gray)]">
              No banking rail data available
            </p>
            <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
              Basket sizes will populate as transactions are linked to payment rails.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>Payment Rails: {rails.length}</span>
        <span className="font-medium">Data Intake Health</span>
      </div>
    </section>
  );
}
