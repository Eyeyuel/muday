import type { AdminAnalyticsReport } from '../../api/admin-types';

export function PaymentChannelsCard({ report }: { report?: AdminAnalyticsReport }) {
  const channels = (report?.paymentChannels ?? [])
    .map((ch) => ({
      name: ch.name,
      amount: ch.volumeEtb,
      percent: parseFloat(ch.percentage) || 0,
      color: ch.color,
    }))
    .sort((a, b) => b.percent - a.percent);

  return (
    <section className="flex flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none transition-colors">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink-charcoal)]">
            Banks & Payment Methods
          </h2>
          <span className="text-[11px] font-medium text-[var(--slate-gray)]">Share of Total</span>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Where the logged money came from (banks, apps, and cash)
        </p>

        {channels.length > 0 ? (
          <>
            {/* Multi-Segment Horizontal Progress Bar */}
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-ivory)]">
              {channels.map((ch, idx) => (
                <div
                  key={idx}
                  style={{ width: `${ch.percent}%`, backgroundColor: ch.color }}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  title={`${ch.name}: ${ch.percent}%`}
                />
              ))}
            </div>

            {/* Channel Breakdown List */}
            <div className="mt-5 space-y-3">
              {channels.map((ch, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: ch.color }} />
                    <span className="font-medium text-[var(--ink-charcoal)] truncate max-w-[140px] sm:max-w-[180px]">
                      {ch.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-[var(--slate-gray)] text-[11px] font-normal">
                      {ch.amount}
                    </span>
                    <span className="font-semibold text-[var(--ink-charcoal)] w-10 text-right">
                      {ch.percent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 flex h-[160px] w-full flex-col items-center justify-center rounded-[var(--radius-cards)] border border-dashed border-[var(--border-hairline)] p-6 text-center">
            <p className="text-[13px] font-medium text-[var(--slate-gray)]">
              No payment channels detected
            </p>
            <p className="mt-1 text-[11px] text-[var(--steel-gray)]">
              Payment channels will populate as transactions are linked to Telebirr, CBE, or cash.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--slate-gray)]">
        <span>Payment Methods: {channels.length}</span>
        <span className="font-medium">Live Ledger</span>
      </div>
    </section>
  );
}
