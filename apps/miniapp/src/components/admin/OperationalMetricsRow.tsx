import type { AdminAnalyticsReport } from '../../api/admin-types';

export function OperationalMetricsRow({ report }: { report?: AdminAnalyticsReport }) {
  const usersCount = report?.userDirectory?.totalUsers ?? 0;
  const transactionsCount = report?.transactions?.loggedTransactions ?? 0;
  const voiceLatency = report?.voicePerformance?.avgTotalLatencyMs
    ? `${Math.round(report.voicePerformance.avgTotalLatencyMs)}ms`
    : '0ms';
  const resolutionRate = report?.clarifications?.resolutionRate?.percentage
    ? `${report.clarifications.resolutionRate.percentage}%`
    : '0%';

  const METRICS = [
    {
      title: 'Total Registered Users',
      value: usersCount.toLocaleString(),
      subtext: 'All-time signups',
    },
    {
      title: 'Logged Transactions',
      value: transactionsCount.toLocaleString(),
      subtext: 'Database entries',
    },
    {
      title: 'Voice Pipeline Latency',
      value: voiceLatency,
      subtext: 'STT + AI extraction',
    },
    {
      title: 'Clarification Resolution',
      value: resolutionRate,
      subtext: 'Resolved / Requested',
    },
  ];

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((item, idx) => (
        <div
          key={idx}
          className="flex min-w-0 flex-col justify-between rounded-[var(--radius-cards)] border border-[var(--border-hairline)] bg-[var(--pure-white)] p-4 shadow-none transition-colors hover:bg-[var(--surface-ivory)]"
        >
          <div>
            <span className="text-[12px] font-medium text-[var(--slate-gray)]">{item.title}</span>
            <p className="mt-1.5 text-[22px] font-semibold tracking-tight text-[var(--ink-charcoal)] tabular-nums">
              {item.value}
            </p>
          </div>
          <div className="mt-3 text-[11px] text-[var(--slate-gray)]">
            <span>{item.subtext}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
