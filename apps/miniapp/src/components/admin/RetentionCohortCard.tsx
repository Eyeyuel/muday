import type { AdminAnalyticsReport } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';

export function RetentionCohortCard({ report }: { report: AdminAnalyticsReport; locale?: Locale }) {
  const { d7, d30 } = report.retention;

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-5 shadow-none">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-[var(--ink-charcoal)]">Retention Cohorts</h2>
        <p className="mt-0.5 text-[12px] text-[var(--slate-gray)]">
          Proportion of new users returning to log transactions on D7 & D30
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        {/* D7 Box */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--slate-gray)]">Day 7 (D7)</span>
            <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--electric-cobalt)]">
              {d7.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pure-white)] border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--electric-cobalt)] transition-all"
              style={{ width: `${Math.min(100, Number(d7.percentage))}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--slate-gray)] tabular-nums">
            <strong className="font-semibold text-[var(--ink-charcoal)]">{d7.retainedUsers}</strong>{' '}
            of {d7.eligibleCohortUsers} eligible users returned
          </p>
        </div>

        {/* D30 Box */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-ivory)] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--slate-gray)]">Day 30 (D30)</span>
            <span className="rounded-full bg-[var(--electric-cobalt)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--electric-cobalt)]">
              {d30.percentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pure-white)] border border-[var(--border-hairline)]">
            <div
              className="h-full rounded-full bg-[var(--deep-cobalt)] transition-all"
              style={{ width: `${Math.min(100, Number(d30.percentage))}%` }}
            />
          </div>
          <p className="text-[11px] text-[var(--slate-gray)] tabular-nums">
            <strong className="font-semibold text-[var(--ink-charcoal)]">
              {d30.retainedUsers}
            </strong>{' '}
            of {d30.eligibleCohortUsers} eligible users returned
          </p>
        </div>
      </div>
    </section>
  );
}
